import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { db } from '../../database/pg.js';
import { z } from 'zod';
import { supabase } from '../../database/supabase.js';
import { cache } from '../../cache/redis.js';

const employeeSchema = z.object({
  userId: z.string().uuid().optional(), // Referência ao ID do Supabase Auth (opcional)
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional(), // Senha opcional para auto-criação
  phone: z.string().optional(),
  commissionPercentage: z.number().min(0).max(100),
  hiringDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
});

const shiftSchema = z.array(z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  breakStartTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format").optional(),
  breakEndTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format").optional(),
  isWorkingDay: z.boolean().default(true),
}));

const timeoffSchema = z.object({
  employeeProfileId: z.string().uuid(),
  type: z.enum(['day_off', 'vacation', 'sick_leave', 'temporary_absence']),
  startDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  endDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  reason: z.string().optional(),
});

export const employeesController = {
  // Listar funcionários e seus perfis
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      let tenantId = req.user?.tenantId;
      if (req.user?.role === 'client' && req.query.tenantId) {
        tenantId = req.query.tenantId as string;
      }
      
      const query = `
        SELECT ep.id as profile_id, u.id as user_id, u.name, u.email, u.phone, u.avatar_url, u.is_active, ep.hiring_date, ep.commission_percentage
        FROM employee_profiles ep
        INNER JOIN users u ON ep.user_id = u.id
        WHERE ep.tenant_id = $1
        ORDER BY u.name ASC
      `;
      
      const result = await db.query(query, [tenantId]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Cadastrar funcionário
  async create(req: AuthenticatedRequest, res: Response) {
    const client = await db.connect();
    let createdAuthUserId: string | null = null;
    try {
      const tenantId = req.user?.tenantId;
      const parsed = employeeSchema.parse(req.body);

      let authUserId = parsed.userId;

      // Se não passar userId, cria a conta no Supabase Auth usando o Admin SDK
      if (!authUserId) {
        const password = parsed.password || 'Mudar@123';
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: parsed.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            role: 'employee',
            name: parsed.name,
            tenantId: tenantId
          }
        });

        if (authError || !authUser.user) {
          return res.status(400).json({ error: `Erro ao criar credenciais de autenticação: ${authError?.message || 'Erro desconhecido'}` });
        }

        authUserId = authUser.user.id;
        createdAuthUserId = authUser.user.id;
      }

      await client.query('BEGIN');

      // 1. Inserir ou atualizar na tabela users com role employee
      const userInsert = await client.query(
        `INSERT INTO users (id, tenant_id, name, email, phone, role, is_active)
         VALUES ($1, $2, $3, $4, $5, 'employee', true)
         ON CONFLICT (tenant_id, email) DO UPDATE 
         SET role = 'employee', phone = EXCLUDED.phone, name = EXCLUDED.name
         RETURNING *`,
        [authUserId, tenantId, parsed.name, parsed.email, parsed.phone]
      );

      const userId = userInsert.rows[0].id;

      // 2. Criar perfil do funcionário
      const profileInsert = await client.query(
        `INSERT INTO employee_profiles (user_id, tenant_id, hiring_date, commission_percentage)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE 
         SET commission_percentage = EXCLUDED.commission_percentage, hiring_date = EXCLUDED.hiring_date
         RETURNING *`,
        [userId, tenantId, parsed.hiringDate, parsed.commissionPercentage]
      );

      const profile = profileInsert.rows[0];

      // 3. Inicializar escalas padrão para o funcionário (Seg-Sex, 08:00 - 18:00)
      for (let day = 1; day <= 5; day++) {
        await client.query(
          `INSERT INTO shift_schedules (employee_profile_id, tenant_id, day_of_week, start_time, end_time, break_start_time, break_end_time, is_working_day)
           VALUES ($1, $2, $3, '08:00:00', '18:00:00', '12:00:00', '13:00:00', true)
           ON CONFLICT DO NOTHING`,
          [profile.id, tenantId, day]
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({ user: userInsert.rows[0], profile });
    } catch (err: any) {
      await client.query('ROLLBACK');
      
      // Limpeza de recursos em caso de falha na transação do banco
      if (createdAuthUserId) {
        await supabase.auth.admin.deleteUser(createdAuthUserId);
      }

      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  },

  // Atualizar escala semanal do funcionário
  async updateShift(req: AuthenticatedRequest, res: Response) {
    const client = await db.connect();
    try {
      const tenantId = req.user?.tenantId;
      const { profileId } = req.params;
      const parsedShifts = shiftSchema.parse(req.body);

      // Verificar se o perfil pertence ao tenant
      const checkProfile = await client.query(
        'SELECT id FROM employee_profiles WHERE id = $1 AND tenant_id = $2',
        [profileId, tenantId]
      );

      if (checkProfile.rowCount === 0) {
        return res.status(404).json({ error: 'Employee profile not found or unauthorized' });
      }

      await client.query('BEGIN');

      for (const shift of parsedShifts) {
        await client.query(
          `INSERT INTO shift_schedules (employee_profile_id, tenant_id, day_of_week, start_time, end_time, break_start_time, break_end_time, is_working_day)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (employee_profile_id, day_of_week) DO UPDATE
           SET start_time = EXCLUDED.start_time,
               end_time = EXCLUDED.end_time,
               break_start_time = EXCLUDED.break_start_time,
               break_end_time = EXCLUDED.break_end_time,
               is_working_day = EXCLUDED.is_working_day`,
          [
            profileId, 
            tenantId, 
            shift.dayOfWeek, 
            shift.startTime, 
            shift.endTime, 
            shift.breakStartTime || null, 
            shift.breakEndTime || null, 
            shift.isWorkingDay
          ]
        );
      }

      await client.query('COMMIT');
      
      // Invalidar cache do redis para este barbeiro, pois a escala mudou
      // Utilizaremos a chave padronizada no Redis
      // Ex: tenant:{tenantId}:employee:{employeeId}:availability:*
      if (req.user?.tenantId) {
        // Obter user_id associado ao perfil
        const userRes = await db.query('SELECT user_id FROM employee_profiles WHERE id = $1', [profileId]);
        const employeeUserId = userRes.rows[0]?.user_id;
        if (employeeUserId) {
          // Deletar cache de disponibilidade do barbeiro no redis
          // Nota: Como não sabemos a data exata da alteração (afeta todas), deletamos via pattern
          const pattern = `tenant:${tenantId}:employee:${profileId}:availability:*`;
          await cache.delByPattern(pattern);
        }
      }

      return res.json({ message: 'Shift schedule updated successfully' });
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  },

  async getShifts(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { profileId } = req.params;

      const checkProfile = await db.query(
        'SELECT id FROM employee_profiles WHERE id = $1 AND tenant_id = $2',
        [profileId, tenantId]
      );

      if (checkProfile.rowCount === 0) {
        return res.status(404).json({ error: 'Employee profile not found or unauthorized' });
      }

      const result = await db.query(
        `SELECT day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime",
                break_start_time AS "breakStartTime", break_end_time AS "breakEndTime", is_working_day AS "isWorkingDay"
         FROM shift_schedules
         WHERE employee_profile_id = $1 AND tenant_id = $2
         ORDER BY day_of_week ASC`,
        [profileId, tenantId]
      );

      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Registrar folga, férias ou licença
  async createTimeoff(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const parsed = timeoffSchema.parse(req.body);

      // Verificar se o perfil pertence ao tenant
      const checkProfile = await db.query(
        'SELECT id FROM employee_profiles WHERE id = $1 AND tenant_id = $2',
        [parsed.employeeProfileId, tenantId]
      );

      if (checkProfile.rowCount === 0) {
        return res.status(404).json({ error: 'Employee profile not found or unauthorized' });
      }

      const result = await db.query(
        `INSERT INTO employee_timeoffs (employee_profile_id, tenant_id, type, start_date, end_date, reason, is_approved)
         VALUES ($1, $2, $3, $4, $5, $6, true) -- Como dono/gerente cadastra, já fica aprovado por padrão
         RETURNING *`,
        [parsed.employeeProfileId, tenantId, parsed.type, parsed.startDate, parsed.endDate]
      );

      // Invalida cache de disponibilidade do barbeiro
      const pattern = `tenant:${tenantId}:employee:${parsed.employeeProfileId}:availability:*`;
      await cache.delByPattern(pattern);

      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  // Listar folgas cadastradas
  async listTimeoffs(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const result = await db.query(
        `SELECT et.*, u.name as employee_name
         FROM employee_timeoffs et
         INNER JOIN employee_profiles ep ON et.employee_profile_id = ep.id
         INNER JOIN users u ON ep.user_id = u.id
         WHERE et.tenant_id = $1
         ORDER BY et.start_date DESC`,
        [tenantId]
      );
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
};

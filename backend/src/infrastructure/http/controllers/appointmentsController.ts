import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { db } from '../../database/pg.js';
import { z } from 'zod';
import { cache } from '../../cache/redis.js';
import { notificationService } from '../../services/notificationService.js';

const appointmentCreateSchema = z.object({
  clientProfileId: z.string().uuid(),
  employeeProfileId: z.string().uuid(),
  serviceId: z.string().uuid(),
  scheduledTime: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Invalid datetime format' }),
});

export const appointmentsController = {
  // Criar agendamento com tratamento anticonflito concorrente (Serializable Transaction)
  async create(req: AuthenticatedRequest, res: Response) {
    const pgClient = await db.connect();
    try {
      const tenantId = req.user?.tenantId;
      const parsed = appointmentCreateSchema.parse(req.body);
      
      const scheduledTimeDate = new Date(parsed.scheduledTime);
      
      // 1. Obter duração do serviço e tenant correspondente sem travar no tenant do token do usuário se ele for cliente
      const serviceRes = await pgClient.query(
        'SELECT duration_minutes, name, tenant_id FROM services WHERE id = $1',
        [parsed.serviceId]
      );
      if (serviceRes.rowCount === 0) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const serviceDuration = serviceRes.rows[0].duration_minutes;
      const targetTenantId = serviceRes.rows[0].tenant_id;

      // Se não for cliente e o tenant_id do serviço não bater com o do usuário logado, barra a operação
      if (req.user?.role !== 'client' && targetTenantId !== tenantId) {
        return res.status(403).json({ error: 'Unauthorized: Staff can only book for their own barbershop.' });
      }
      
      const endTimeDate = new Date(scheduledTimeDate.getTime() + serviceDuration * 60000);

      // Iniciar transação serializável
      await pgClient.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

      // 2. Verificar sobreposição imediata de agendamentos para o barbeiro
      const overlapQuery = `
        SELECT id FROM appointments
        WHERE employee_profile_id = $1 
          AND tenant_id = $2 
          AND status != 'cancelled'
          AND (
            (scheduled_time < $4 AND end_time > $3) -- Sobreposição parcial ou total
          )
      `;
      const overlapRes = await pgClient.query(overlapQuery, [
        parsed.employeeProfileId,
        targetTenantId,
        scheduledTimeDate.toISOString(),
        endTimeDate.toISOString()
      ]);

      if (overlapRes.rowCount && overlapRes.rowCount > 0) {
        await pgClient.query('ROLLBACK');
        return res.status(409).json({ 
          error: 'Time slot conflict: The selected barber is already booked for this time range' 
        });
      }

      // 3. Verificar conflitos de horário do próprio cliente com intervalo de 30 minutos de segurança (para evitar sabotagem)
      const bufferMinutes = 30;
      const clientOverlapQuery = `
        SELECT id, scheduled_time, end_time FROM appointments
        WHERE client_profile_id = $1
          AND status != 'cancelled'
          AND (
            (scheduled_time - INTERVAL '${bufferMinutes} minutes' < $3 AND end_time + INTERVAL '${bufferMinutes} minutes' > $2)
          )
      `;
      const clientOverlapRes = await pgClient.query(clientOverlapQuery, [
        parsed.clientProfileId,
        scheduledTimeDate.toISOString(),
        endTimeDate.toISOString()
      ]);

      if (clientOverlapRes.rowCount && clientOverlapRes.rowCount > 0) {
        await pgClient.query('ROLLBACK');
        return res.status(409).json({
          error: `Conflito de agenda do cliente: Você já possui um agendamento muito próximo deste horário. Por favor, deixe um intervalo mínimo de ${bufferMinutes} minutos entre seus agendamentos.`
        });
      }

      // 4. Inserir o agendamento
      const insertQuery = `
        INSERT INTO appointments (tenant_id, client_profile_id, employee_profile_id, service_id, scheduled_time, end_time, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
        RETURNING *
      `;
      const result = await pgClient.query(insertQuery, [
        targetTenantId,
        parsed.clientProfileId,
        parsed.employeeProfileId,
        parsed.serviceId,
        scheduledTimeDate.toISOString(),
        endTimeDate.toISOString()
      ]);

      await pgClient.query('COMMIT');
      
      const appointment = result.rows[0];

      // 5. Invalidação do cache Redis para o barbeiro e data correspondente
      const dateStr = scheduledTimeDate.toISOString().substring(0, 10);
      const pattern = `tenant:${targetTenantId}:employee:${parsed.employeeProfileId}:availability:${dateStr}:*`;
      await cache.delByPattern(pattern);

      // 5. Emitir evento Websocket para atualização em tempo real (caso o WebSocket esteja acoplado no app)
      // Usaremos o emissor global se disponível (configuraremos no server.ts)
      const io = req.app.get('io');
      if (io) {
        io.to(`tenant:${targetTenantId}`).emit('appointment_created', {
          appointment,
          message: 'Novo agendamento criado'
        });
      }

      // 6. Criar notificações em segundo plano para cliente, barbeiro e administradores
      try {
        const detailsRes = await pgClient.query(
          `SELECT 
            cp.user_id as client_user_id, cp.name as client_name,
            u_emp.id as employee_user_id, u_emp.name as employee_name,
            s.name as service_name,
            t.name as tenant_name
           FROM client_profiles cp
           CROSS JOIN employee_profiles ep
           INNER JOIN users u_emp ON ep.user_id = u_emp.id
           CROSS JOIN services s
           INNER JOIN tenants t ON t.id = $4
           WHERE cp.id = $1 AND ep.id = $2 AND s.id = $3`,
          [parsed.clientProfileId, parsed.employeeProfileId, parsed.serviceId, targetTenantId]
        );

        if (detailsRes.rows.length > 0) {
          const { client_user_id, client_name, employee_user_id, employee_name, service_name, tenant_name } = detailsRes.rows[0];
          
          const timeStr = scheduledTimeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const dateStrFormat = scheduledTimeDate.toLocaleDateString('pt-BR');

          // Notificação do Cliente
          if (client_user_id) {
            await notificationService.createNotification({
              userId: client_user_id,
              tenantId: targetTenantId,
              title: 'Reserva Agendada',
              message: `Sua reserva para ${service_name} na barbearia "${tenant_name}" em ${dateStrFormat} às ${timeStr} foi criada.`,
              type: 'appointment_created_client',
              io
            });
          }

          // Notificação do Barbeiro
          if (employee_user_id) {
            await notificationService.createNotification({
              userId: employee_user_id,
              tenantId: targetTenantId,
              title: 'Nova Reserva Recebida',
              message: `Você tem um novo agendamento com o cliente ${client_name} para ${service_name} em ${dateStrFormat} às ${timeStr}.`,
              type: 'appointment_created_employee',
              io
            });
          }

          // Notificação dos Administradores
          const adminsRes = await pgClient.query(
            `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('owner', 'manager')`,
            [targetTenantId]
          );
          for (const admin of adminsRes.rows) {
            await notificationService.createNotification({
              userId: admin.id,
              tenantId: targetTenantId,
              title: 'Novo Agendamento na Barbearia',
              message: `O cliente ${client_name} agendou ${service_name} com ${employee_name} para ${dateStrFormat} às ${timeStr}.`,
              type: 'appointment_created_admin',
              io
            });
          }
        }
      } catch (err) {
        console.error('Erro ao processar notificações do agendamento:', err);
      }

      return res.status(201).json(appointment);
    } catch (err: any) {
      await pgClient.query('ROLLBACK');
      
      // Tratar erro do nível serializável (40001: serialization_failure)
      if (err.code === '40001') {
        return res.status(409).json({ 
          error: 'Booking conflict: Parallel transaction collision. Please try again.' 
        });
      }

      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    } finally {
      pgClient.release();
    }
  },

  // Listar agendamentos do tenant (com filtros opcionais de data/barbeiro)
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { employeeId, date } = req.query;
      
      let query = `
        SELECT a.*, c.name as client_name, c.phone as client_phone, u.name as employee_name, s.name as service_name, t.name as barbershop_name
        FROM appointments a
        INNER JOIN client_profiles c ON a.client_profile_id = c.id
        INNER JOIN employee_profiles ep ON a.employee_profile_id = ep.id
        INNER JOIN users u ON ep.user_id = u.id
        INNER JOIN services s ON a.service_id = s.id
        INNER JOIN tenants t ON a.tenant_id = t.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Se não for super admin e não for cliente, restringe ao tenant do usuário logado
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'client') {
        query += ` AND a.tenant_id = $${paramIndex}`;
        params.push(tenantId);
        paramIndex++;
      } else if (req.user?.role === 'client') {
        // Se for cliente e passou tenantId na query, filtra por ele. Senão, mostra de todas as barbearias.
        if (req.query.tenantId) {
          query += ` AND a.tenant_id = $${paramIndex}`;
          params.push(req.query.tenantId);
          paramIndex++;
        }
        query += ` AND c.user_id = $${paramIndex}`;
        params.push(req.user.id);
        paramIndex++;
      }

      if (employeeId) {
        query += ` AND a.employee_profile_id = $${paramIndex}`;
        params.push(employeeId);
        paramIndex++;
      }

      if (date) {
        const startOfDay = `${date}T00:00:00.000Z`;
        const endOfDay = `${date}T23:59:59.999Z`;
        query += ` AND a.scheduled_time >= $${paramIndex} AND a.scheduled_time <= $${paramIndex + 1}`;
        params.push(startOfDay, endOfDay);
        paramIndex += 2;
      }

      query += ' ORDER BY a.scheduled_time ASC';

      const result = await db.query(query, params);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Atualizar status (Confirmado, Finalizado, Cancelado)
  async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;
      const { status } = req.body;

      const allowedStatuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of ${allowedStatuses.join(', ')}` });
      }

      // Buscar agendamento antes de atualizar para invalidar cache correto
      const checkRes = await db.query(
        'SELECT employee_profile_id, scheduled_time FROM appointments WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      if (checkRes.rowCount === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      const appointmentObj = checkRes.rows[0];

      const result = await db.query(
        'UPDATE appointments SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *',
        [status, id, tenantId]
      );

      // Invalida cache de slots do barbeiro daquela data
      const dateStr = new Date(appointmentObj.scheduled_time).toISOString().substring(0, 10);
      const pattern = `tenant:${tenantId}:employee:${appointmentObj.employee_profile_id}:availability:${dateStr}:*`;
      await cache.delByPattern(pattern);

      // Notificar via WebSocket
      const io = req.app.get('io');
      if (io) {
        io.to(`tenant:${tenantId}`).emit('appointment_updated', result.rows[0]);
      }

      // Notificações de alteração de status
      try {
        const detailsRes = await db.query(
          `SELECT 
            cp.user_id as client_user_id, cp.name as client_name,
            u_emp.id as employee_user_id, u_emp.name as employee_name,
            s.name as service_name,
            t.name as tenant_name,
            a.scheduled_time
           FROM appointments a
           INNER JOIN client_profiles cp ON a.client_profile_id = cp.id
           INNER JOIN employee_profiles ep ON a.employee_profile_id = ep.id
           INNER JOIN users u_emp ON ep.user_id = u_emp.id
           INNER JOIN services s ON a.service_id = s.id
           INNER JOIN tenants t ON a.tenant_id = t.id
           WHERE a.id = $1`,
          [id]
        );

        if (detailsRes.rows.length > 0) {
          const { client_user_id, client_name, employee_user_id, employee_name, service_name, tenant_name, scheduled_time } = detailsRes.rows[0];
          const timeStr = new Date(scheduled_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const dateStrFormat = new Date(scheduled_time).toLocaleDateString('pt-BR');

          if (status === 'cancelled') {
            // Notificar Cliente
            if (client_user_id) {
              await notificationService.createNotification({
                userId: client_user_id,
                tenantId,
                title: 'Reserva Cancelada',
                message: `Sua reserva para ${service_name} na barbearia "${tenant_name}" em ${dateStrFormat} às ${timeStr} foi cancelada.`,
                type: 'appointment_cancelled_client',
                io
              });
            }

            // Notificar Barbeiro
            if (employee_user_id) {
              await notificationService.createNotification({
                userId: employee_user_id,
                tenantId,
                title: 'Reserva Cancelada',
                message: `O agendamento do cliente ${client_name} para ${service_name} em ${dateStrFormat} às ${timeStr} foi cancelado.`,
                type: 'appointment_cancelled_employee',
                io
              });
            }

            // Notificar Admins
            const adminsRes = await db.query(
              `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('owner', 'manager')`,
              [tenantId]
            );
            for (const admin of adminsRes.rows) {
              await notificationService.createNotification({
                userId: admin.id,
                tenantId,
                title: 'Reserva Cancelada na Barbearia',
                message: `O agendamento do cliente ${client_name} com ${employee_name} para ${service_name} em ${dateStrFormat} às ${timeStr} foi cancelado.`,
                type: 'appointment_cancelled_admin',
                io
              });
            }
          } else if (status === 'confirmed') {
            // Notificar Cliente
            if (client_user_id) {
              await notificationService.createNotification({
                userId: client_user_id,
                tenantId,
                title: 'Reserva Confirmada!',
                message: `Sua reserva para ${service_name} na barbearia "${tenant_name}" em ${dateStrFormat} às ${timeStr} foi confirmada pela barbearia.`,
                type: 'appointment_confirmed_client',
                io
              });
            }
          }
        }
      } catch (err) {
        console.error('Erro ao processar notificações de status do agendamento:', err);
      }

      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
};

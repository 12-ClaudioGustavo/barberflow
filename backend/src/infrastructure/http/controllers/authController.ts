import { Request, Response } from 'express';
import { supabase } from '../../database/supabase.js';
import { z } from 'zod';

const signupSchema = z.object({
  role: z.enum(['owner', 'client']),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  phone: z.string().optional(),
  // Campos obrigatórios se role === 'owner'
  barbershopName: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug inválido').optional(),
  // Campo obrigatório se role === 'client'
  tenantId: z.string().uuid().optional(),
});

export const authController = {
  // Registrar novo usuário e tenant associado (Onboarding) usando Conexão Tradicional (SDK)
  async signup(req: Request, res: Response) {
    let createdAuthUserId: string | null = null;
    try {
      const parsed = signupSchema.parse(req.body);
      const { role, email, password, name, phone, barbershopName, slug, tenantId } = parsed;

      let targetTenantId = tenantId;

      // 1. Validar se o cadastro for de Dono
      if (role === 'owner') {
        if (!barbershopName || !slug) {
          return res.status(400).json({ error: 'Nome da barbearia e slug são obrigatórios para cadastro do dono' });
        }

        // Verificar se o slug já existe usando o SDK
        const { data: existingTenant, error: tenantCheckErr } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (tenantCheckErr) {
          return res.status(500).json({ error: `Erro ao validar slug: ${tenantCheckErr.message}` });
        }

        if (existingTenant) {
          return res.status(409).json({ error: 'Slug da barbearia já está em uso' });
        }

        // Criar o Tenant com status PENDING usando o SDK
        const { data: newTenant, error: tenantInsertErr } = await supabase
          .from('tenants')
          .insert([{ name: barbershopName, slug, status: 'pending', owner_email: email, owner_name: name }])
          .select()
          .single();

        if (tenantInsertErr || !newTenant) {
          return res.status(500).json({ error: `Erro ao criar barbearia: ${tenantInsertErr?.message}` });
        }

        targetTenantId = newTenant.id;
      }

      // Validar se o tenantId do cliente existe
      if (role === 'client') {
        if (!targetTenantId) {
          return res.status(400).json({ error: 'tenantId é obrigatório para cadastro de cliente' });
        }

        const { data: tenantCheck, error: tenantCheckErr } = await supabase
          .from('tenants')
          .select('id')
          .eq('id', targetTenantId)
          .maybeSingle();

        if (tenantCheckErr || !tenantCheck) {
          return res.status(404).json({ error: 'A barbearia selecionada não existe' });
        }
      }

      // 2. Criar credenciais no Supabase Auth via Admin SDK (Bypass de confirmação por email)
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role,
          name,
          tenantId: targetTenantId
        }
      });

      if (authError || !authUser.user) {
        // Se criou o tenant e falhou a criação do Auth, remove o tenant criado para manter consistência
        if (role === 'owner' && targetTenantId) {
          await supabase.from('tenants').delete().eq('id', targetTenantId);
        }
        return res.status(400).json({ error: authError?.message || 'Falha ao criar credenciais do usuário' });
      }

      createdAuthUserId = authUser.user.id;

      // 3. Inserir perfil de usuário local
      const { error: userInsertErr } = await supabase
        .from('users')
        .insert([{
          id: createdAuthUserId,
          tenant_id: targetTenantId,
          name,
          email,
          phone: phone || null,
          role,
          is_active: true
        }]);

      if (userInsertErr) {
        throw new Error(`Erro ao criar perfil de usuário: ${userInsertErr.message}`);
      }

      // 4. Inserir nas tabelas específicas de perfil
      if (role === 'owner') {
        // Cadastrar perfil de funcionário administrador
        const { data: newEmployee, error: employeeInsertErr } = await supabase
          .from('employee_profiles')
          .insert([{
            user_id: createdAuthUserId,
            tenant_id: targetTenantId,
            hiring_date: new Date().toISOString().split('T')[0],
            commission_percentage: 50.00
          }])
          .select()
          .single();

        if (employeeInsertErr || !newEmployee) {
          throw new Error(`Erro ao criar perfil de funcionário do dono: ${employeeInsertErr?.message}`);
        }

        // Criar escalas padrão de trabalho (Segunda a Sábado, 09:00 - 18:00)
        const shifts = [];
        for (let day = 1; day <= 6; day++) {
          shifts.push({
            employee_profile_id: newEmployee.id,
            tenant_id: targetTenantId,
            day_of_week: day,
            start_time: '09:00:00',
            end_time: '18:00:00',
            break_start_time: '12:00:00',
            break_end_time: '13:00:00',
            is_working_day: true
          });
        }

        const { error: shiftInsertErr } = await supabase
          .from('shift_schedules')
          .insert(shifts);

        if (shiftInsertErr) {
          throw new Error(`Erro ao cadastrar escalas de horário do dono: ${shiftInsertErr.message}`);
        }
      } else if (role === 'client') {
        // Cadastrar perfil de cliente final
        const { error: clientInsertErr } = await supabase
          .from('client_profiles')
          .insert([{
            user_id: createdAuthUserId,
            tenant_id: targetTenantId,
            name,
            phone: phone || null,
            visits_count: 0,
            total_spent: 0.00
          }]);

        if (clientInsertErr) {
          throw new Error(`Erro ao criar perfil de cliente: ${clientInsertErr.message}`);
        }
      }

      // Para donos de barbearia, retornar mensagem de cadastro pendente
      if (role === 'owner') {
        return res.status(201).json({
          message: 'Cadastro recebido com sucesso! Aguardando aprovação do administrador.',
          status: 'pending',
          user: {
            id: createdAuthUserId,
            email,
            name,
            role,
            tenantId: targetTenantId
          }
        });
      }

      return res.status(201).json({
        message: 'Usuário cadastrado com sucesso',
        user: {
          id: createdAuthUserId,
          email,
          name,
          role,
          tenantId: targetTenantId
        }
      });
    } catch (err: any) {
      // Limpeza de recursos em caso de erro para simular rollback transacional
      if (createdAuthUserId) {
        await supabase.auth.admin.deleteUser(createdAuthUserId);
      }
      if (req.body.role === 'owner' && req.body.slug) {
        await supabase.from('tenants').delete().eq('slug', req.body.slug);
      }

      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  // Listar apenas barbearias ATIVAS para cadastro de clientes
  async listTenants(req: Request, res: Response) {
    try {
      const { data: tenants, error: listErr } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (listErr) {
        throw new Error(listErr.message);
      }

      return res.status(200).json(tenants || []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
};

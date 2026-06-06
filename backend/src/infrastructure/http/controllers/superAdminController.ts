import { Request, Response } from 'express';
import { supabase } from '../../database/supabase.js';
import { z } from 'zod';
import { notificationService } from '../../services/notificationService.js';

const rejectSchema = z.object({
  reason: z.string().min(5, 'Motivo de rejeição é obrigatório (mín. 5 caracteres)'),
});

export const superAdminController = {
  // Listar todos os tenants com filtro por status
  async listTenants(req: Request, res: Response) {
    try {
      const { status } = req.query;

      let query = supabase
        .from('tenants')
        .select('id, name, slug, status, owner_email, owner_name, notes, rejected_reason, approved_at, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (status && typeof status === 'string' && ['pending', 'active', 'rejected', 'suspended'].includes(status)) {
        query = query.eq('status', status);
      }

      const { data: tenants, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return res.status(200).json(tenants || []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Aprovar um tenant (status → active)
  async approveTenant(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const adminUser = (req as any).user;

      if (!id) {
        return res.status(400).json({ error: 'ID do tenant é obrigatório' });
      }

      // Verificar se o tenant existe e está pendente
      const { data: tenant, error: fetchErr } = await supabase
        .from('tenants')
        .select('id, name, status, owner_email')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr || !tenant) {
        return res.status(404).json({ error: 'Barbearia não encontrada' });
      }

      if (tenant.status === 'active') {
        return res.status(409).json({ error: 'Esta barbearia já está ativa' });
      }

      // Atualizar status para active
      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          status: 'active',
          approved_at: new Date().toISOString(),
          approved_by: adminUser?.id || null,
          rejected_reason: null,
        })
        .eq('id', id);

      if (updateErr) {
        throw new Error(`Erro ao aprovar barbearia: ${updateErr.message}`);
      }

      // Notificar o dono em segundo plano
      try {
        const { data: owners } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', id)
          .eq('role', 'owner');
        
        if (owners && owners.length > 0) {
          const io = req.app.get('io');
          for (const owner of owners) {
            await notificationService.createNotification({
              userId: owner.id,
              tenantId: id,
              title: 'Barbearia Aprovada!',
              message: `Sua barbearia "${tenant.name}" foi aprovada e já está ativa na plataforma.`,
              type: 'tenant_approved',
              io
            });
          }
        }
      } catch (err) {
        console.error('Erro ao enviar notificação de aprovação:', err);
      }

      return res.status(200).json({
        message: `Barbearia "${tenant.name}" aprovada com sucesso!`,
        tenantId: id,
        ownerEmail: tenant.owner_email,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Rejeitar um tenant (status → rejected)
  async rejectTenant(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'ID do tenant é obrigatório' });
      }

      const parsed = rejectSchema.parse(req.body);
      const { reason } = parsed;

      // Verificar se o tenant existe
      const { data: tenant, error: fetchErr } = await supabase
        .from('tenants')
        .select('id, name, status, owner_email')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr || !tenant) {
        return res.status(404).json({ error: 'Barbearia não encontrada' });
      }

      if (tenant.status === 'rejected') {
        return res.status(409).json({ error: 'Esta barbearia já foi rejeitada' });
      }

      // Atualizar status para rejected com motivo
      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          status: 'rejected',
          rejected_reason: reason,
          approved_at: null,
        })
        .eq('id', id);

      if (updateErr) {
        throw new Error(`Erro ao rejeitar barbearia: ${updateErr.message}`);
      }

      // Notificar o dono em segundo plano
      try {
        const { data: owners } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', id)
          .eq('role', 'owner');
        
        if (owners && owners.length > 0) {
          const io = req.app.get('io');
          for (const owner of owners) {
            await notificationService.createNotification({
              userId: owner.id,
              tenantId: id,
              title: 'Solicitação Rejeitada',
              message: `Sua solicitação de cadastro para a barbearia "${tenant.name}" foi rejeitada. Motivo: ${reason}`,
              type: 'tenant_rejected',
              io
            });
          }
        }
      } catch (err) {
        console.error('Erro ao enviar notificação de rejeição:', err);
      }

      return res.status(200).json({
        message: `Barbearia "${tenant.name}" rejeitada.`,
        tenantId: id,
        ownerEmail: tenant.owner_email,
        reason,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  // Suspender um tenant ativo
  async suspendTenant(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID do tenant é obrigatório' });
      }

      const { data: tenant, error: fetchErr } = await supabase
        .from('tenants')
        .select('id, name, status')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr || !tenant) {
        return res.status(404).json({ error: 'Barbearia não encontrada' });
      }

      const { error: updateErr } = await supabase
        .from('tenants')
        .update({
          status: 'suspended',
          notes: reason || null,
        })
        .eq('id', id);

      if (updateErr) {
        throw new Error(`Erro ao suspender barbearia: ${updateErr.message}`);
      }

      // Notificar o dono em segundo plano
      try {
        const { data: owners } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', id)
          .eq('role', 'owner');
        
        if (owners && owners.length > 0) {
          const io = req.app.get('io');
          for (const owner of owners) {
            await notificationService.createNotification({
              userId: owner.id,
              tenantId: id,
              title: 'Barbearia Suspensa',
              message: `Sua barbearia "${tenant.name}" foi suspensa por falta de pagamento ou termos de uso.`,
              type: 'tenant_suspended',
              io
            });
          }
        }
      } catch (err) {
        console.error('Erro ao enviar notificação de suspensão:', err);
      }

      return res.status(200).json({
        message: `Barbearia "${tenant.name}" suspensa.`,
        tenantId: id,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Estatísticas globais da plataforma
  async getStats(req: Request, res: Response) {
    try {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('status, created_at');

      if (error) {
        throw new Error(error.message);
      }

      const all = tenants || [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        total: all.length,
        active: all.filter((t) => t.status === 'active').length,
        pending: all.filter((t) => t.status === 'pending').length,
        rejected: all.filter((t) => t.status === 'rejected').length,
        suspended: all.filter((t) => t.status === 'suspended').length,
        newLast30Days: all.filter((t) => new Date(t.created_at) >= thirtyDaysAgo).length,
      };

      return res.status(200).json(stats);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
};

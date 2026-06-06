import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { supabase } from '../../database/supabase.js';
import { z } from 'zod';

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  durationMinutes: z.number().int().positive().multipleOf(5),
});

export const servicesController = {
  // Listar serviços do tenant
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      let tenantId = req.user?.tenantId;
      if (req.user?.role === 'client' && req.query.tenantId) {
        tenantId = req.query.tenantId as string;
      }
      const all = req.query.all === 'true' || req.user?.role === 'owner' || req.user?.role === 'manager';
      
      let query = supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenantId);

      if (!all) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;
      
      return res.json(data || []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Criar serviço
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const parsed = serviceSchema.parse(req.body);

      const { data, error } = await supabase
        .from('services')
        .insert([{
          tenant_id: tenantId,
          name: parsed.name,
          description: parsed.description || null,
          price: parsed.price,
          duration_minutes: parsed.durationMinutes
        }])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json(data);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  // Atualizar serviço
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;
      const parsed = serviceSchema.partial().parse(req.body);

      // Verificar se serviço existe e pertence ao tenant
      const { data: checkResult, error: checkErr } = await supabase
        .from('services')
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (checkErr || !checkResult) {
        return res.status(404).json({ error: 'Service not found or unauthorized' });
      }

      // Montar objeto de atualização
      const updateData: any = {};
      if (parsed.name !== undefined) updateData.name = parsed.name;
      if (parsed.description !== undefined) updateData.description = parsed.description || null;
      if (parsed.price !== undefined) updateData.price = parsed.price;
      if (parsed.durationMinutes !== undefined) updateData.duration_minutes = parsed.durationMinutes;

      const { data, error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return res.json(data);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  // Inativar / Ativar serviço
  async toggleActive(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;

      const { data: checkResult, error: checkErr } = await supabase
        .from('services')
        .select('is_active')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (checkErr || !checkResult) {
        return res.status(404).json({ error: 'Service not found or unauthorized' });
      }

      const currentStatus = checkResult.is_active;

      const { data, error } = await supabase
        .from('services')
        .update({ is_active: !currentStatus })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return res.json({ 
        message: `Service status updated to ${!currentStatus ? 'active' : 'inactive'}`, 
        service: data
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
};

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { supabase } from '../../database/supabase.js';
import { z } from 'zod';

const clientSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  birthDate: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), { message: "Invalid date format" }),
});

export const clientsController = {
  // Retornar perfil do cliente logado
  async me(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { data, error } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Client profile not found' });
        }
        throw error;
      }

      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Listar clientes do tenant (com busca opcional por nome)
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { search } = req.query;

      let query = supabase
        .from('client_profiles')
        .select('*')
        .eq('tenant_id', tenantId);

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;

      return res.json(data || []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Criar cliente manual (sem usuário de login)
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const parsed = clientSchema.parse(req.body);

      const { data, error } = await supabase
        .from('client_profiles')
        .insert([{
          tenant_id: tenantId,
          name: parsed.name,
          phone: parsed.phone || null,
          whatsapp: parsed.whatsapp || null,
          birth_date: parsed.birthDate ? parsed.birthDate : null
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
  }
};

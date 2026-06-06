import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { supabase } from '../../database/supabase.js';
import { dashboardController } from './dashboardController.js';
import { z } from 'zod';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().min(2),
  amount: z.number().positive(),
  description: z.string().optional(),
  transactionDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date" }).optional(),
});

export const financialController = {
  // Lançar transação financeira (despesa manual ou outra receita)
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const parsed = transactionSchema.parse(req.body);
      const date = parsed.transactionDate ? new Date(parsed.transactionDate) : new Date();

      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([{
          tenant_id: tenantId,
          type: parsed.type,
          category: parsed.category,
          amount: parsed.amount,
          description: parsed.description || null,
          transaction_date: date.toISOString().substring(0, 10)
        }])
        .select()
        .single();

      if (error) throw error;

      // Limpar cache do dashboard de hoje para este tenant
      if (tenantId) {
        await dashboardController.clearDashboardCache(tenantId);
      }

      return res.status(201).json(data);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  // Listar fluxo de caixa com totais acumulados
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { startDate, endDate } = req.query;

      let query = supabase
        .from('financial_transactions')
        .select('*')
        .eq('tenant_id', tenantId);

      if (startDate) {
        query = query.gte('transaction_date', startDate);
      }

      if (endDate) {
        query = query.lte('transaction_date', endDate);
      }

      const { data: listResult, error: listErr } = await query
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (listErr) throw listErr;

      // Calcular resumos consolidados no período
      const transactions = listResult || [];
      const totalIncome = transactions.reduce((sum, t) => sum + (t.type === 'income' ? parseFloat(t.amount) : 0), 0);
      const totalExpense = transactions.reduce((sum, t) => sum + (t.type === 'expense' ? parseFloat(t.amount) : 0), 0);
      const netProfit = totalIncome - totalExpense;

      const summary = {
        totalIncome,
        totalExpense,
        netProfit
      };

      return res.json({
        summary,
        transactions
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
};

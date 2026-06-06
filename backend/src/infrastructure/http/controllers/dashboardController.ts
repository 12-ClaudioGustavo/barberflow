import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { supabase } from '../../database/supabase.js';
import { cache } from '../../cache/redis.js';

export const dashboardController = {
  async getMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is missing' });
      }

      const cacheKey = `tenant:${tenantId}:dashboard:today`;

      // 1. Tentar obter do Cache
      try {
        const cachedMetrics = await cache.get(cacheKey);
        if (cachedMetrics) {
          return res.json(JSON.parse(cachedMetrics));
        }
      } catch (cacheErr) {
        console.error('Redis cache error for dashboard', cacheErr);
      }

      // 2. Buscar dados do Banco de Dados com fallbacks seguros para evitar erros na UI
      let dailyBilling = 0;
      let appointments = { total: 0, completed: 0, cancelled: 0, pending: 0 };
      let popularServices: any[] = [];
      let activeEmployees = 0;

      // A. Faturamento de Hoje
      try {
        const todayStr = new Date().toISOString().substring(0, 10);
        const { data: transactions, error: billingErr } = await supabase
          .from('financial_transactions')
          .select('amount')
          .eq('tenant_id', tenantId)
          .eq('type', 'income')
          .eq('transaction_date', todayStr);

        if (billingErr) throw billingErr;

        dailyBilling = transactions?.reduce((sum, row) => sum + parseFloat(row.amount), 0) || 0;
      } catch (e) {
        console.error('Erro ao buscar faturamento diário (usando fallback 0):', e);
      }

      // B. Agendamentos de Hoje (Total, Confirmados, Cancelados)
      try {
        const todayStr = new Date().toISOString().substring(0, 10);
        const startOfDay = `${todayStr}T00:00:00.000Z`;
        const endOfDay = `${todayStr}T23:59:59.999Z`;

        const { data: appts, error: apptsErr } = await supabase
          .from('appointments')
          .select('status')
          .eq('tenant_id', tenantId)
          .gte('scheduled_time', startOfDay)
          .lte('scheduled_time', endOfDay);

        if (apptsErr) throw apptsErr;

        if (appts) {
          const total = appts.length;
          const completed = appts.filter(a => a.status === 'completed').length;
          const cancelled = appts.filter(a => a.status === 'cancelled').length;
          const pending = appts.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length;

          appointments = { total, completed, cancelled, pending };
        }
      } catch (e) {
        console.error('Erro ao buscar agendamentos (usando fallback 0):', e);
      }

      // C. Serviços mais vendidos (Popularity)
      try {
        const { data: apptsForPopular, error: popularErr } = await supabase
          .from('appointments')
          .select('services(name)')
          .eq('tenant_id', tenantId)
          .eq('status', 'completed');

        if (popularErr) throw popularErr;

        const counts: Record<string, number> = {};
        apptsForPopular?.forEach((row: any) => {
          const name = row.services?.name;
          if (name) {
            counts[name] = (counts[name] || 0) + 1;
          }
        });

        popularServices = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      } catch (e) {
        console.error('Erro ao buscar serviços populares (usando fallback vazio):', e);
      }

      // D. Funcionários ativos
      try {
        const { count, error: empErr } = await supabase
          .from('employee_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);

        if (empErr) throw empErr;
        activeEmployees = count || 0;
      } catch (e) {
        console.error('Erro ao buscar funcionários ativos (usando fallback 0):', e);
      }

      // Agrupar métricas
      const metrics = {
        dailyBilling,
        appointments,
        activeEmployees,
        popularServices,
        lastUpdated: new Date().toISOString()
      };

      // 3. Salvar no Cache Redis por 5 minutos (300 segundos)
      try {
        await cache.set(cacheKey, JSON.stringify(metrics), 300);
      } catch (cacheErr) {
        console.error('Failed to cache dashboard metrics', cacheErr);
      }

      return res.json(metrics);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Método para limpar o cache do dashboard (chamado internamente quando transações mudam)
  async clearDashboardCache(tenantId: string) {
    const cacheKey = `tenant:${tenantId}:dashboard:today`;
    try {
      await cache.del(cacheKey);
      console.log(`Cache cleared for dashboard: ${cacheKey}`);
    } catch (err) {
      console.error('Failed to clear dashboard cache', err);
    }
  }
};

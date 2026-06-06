import { Request, Response } from 'express';
import { CalculateAvailabilitySlots } from '../../../application/use-cases/availability/CalculateAvailabilitySlots.js';
import { cache } from '../../cache/redis.js';

export const availabilityController = {
  async getSlots(req: Request, res: Response) {
    try {
      const { tenantId, employeeId, date, serviceId } = req.query;

      if (!tenantId || !employeeId || !date || !serviceId) {
        return res.status(400).json({ 
          error: 'Missing required query parameters: tenantId, employeeId, date, serviceId' 
        });
      }

      const tenantIdStr = tenantId as string;
      const employeeIdStr = employeeId as string;
      const dateStr = date as string;
      const serviceIdStr = serviceId as string;

      // 1. Tentar ler do Cache Redis
      // Chave: tenant:{tenantId}:employee:{employeeId}:availability:{date}:service:{serviceId}
      const cacheKey = `tenant:${tenantIdStr}:employee:${employeeIdStr}:availability:${dateStr}:service:${serviceIdStr}`;
      
      try {
        const cachedData = await cache.get(cacheKey);
        if (cachedData) {
          return res.json(JSON.parse(cachedData));
        }
      } catch (cacheErr) {
        console.error('Redis cache error, falling back to database', cacheErr);
      }

      // 2. Executar o caso de uso (banco de dados)
      const calculateUsecase = new CalculateAvailabilitySlots();
      const slots = await calculateUsecase.execute(
        tenantIdStr,
        employeeIdStr,
        dateStr,
        serviceIdStr
      );

      // 3. Salvar no Cache Redis (TTL: 1 hora = 3600 segundos)
      try {
        await cache.set(cacheKey, JSON.stringify(slots), 3600);
      } catch (cacheErr) {
        console.error('Failed to write to Redis cache', cacheErr);
      }

      return res.json(slots);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  async getWeekSlots(req: Request, res: Response) {
    try {
      const { tenantId, employeeId, serviceId, startDate, days } = req.query;

      if (!tenantId || !employeeId || !serviceId) {
        return res.status(400).json({
          error: 'Missing required query parameters: tenantId, employeeId, serviceId'
        });
      }

      const tenantIdStr = tenantId as string;
      const employeeIdStr = employeeId as string;
      const serviceIdStr = serviceId as string;
      const startDateStr = (startDate as string) || new Date().toISOString().substring(0, 10);
      const daysCount = Math.min(Math.max(Number(days ?? 7), 1), 14);

      const date = new Date(`${startDateStr}T00:00:00.000Z`);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Invalid startDate format. Use YYYY-MM-DD' });
      }

      const calculateUsecase = new CalculateAvailabilitySlots();
      const weekAvailabilities = await Promise.all(
        Array.from({ length: daysCount }, (_, dayIndex) => {
          const currentDate = new Date(date);
          currentDate.setUTCDate(date.getUTCDate() + dayIndex);
          const currentDateStr = currentDate.toISOString().substring(0, 10);

          return calculateUsecase.execute(
            tenantIdStr,
            employeeIdStr,
            currentDateStr,
            serviceIdStr
          ).then(slots => ({
            date: currentDateStr,
            dayOfWeek: currentDate.getUTCDay(),
            slots,
            availableCount: slots.filter(slot => slot.available).length
          }));
        })
      );

      return res.json(weekAvailabilities);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
};

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { db } from '../../database/pg.js';
import { z } from 'zod';

const waitlistSchema = z.object({
  clientProfileId: z.string().uuid(),
  employeeProfileId: z.string().uuid(),
  serviceId: z.string().uuid(),
  preferredDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  preferredStartTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format").optional(),
  preferredEndTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format").optional(),
});

export const waitlistController = {
  // Adicionar cliente à lista de espera
  async add(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const parsed = waitlistSchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO waitlists (tenant_id, client_profile_id, employee_profile_id, service_id, preferred_date, preferred_start_time, preferred_end_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          tenantId, 
          parsed.clientProfileId, 
          parsed.employeeProfileId, 
          parsed.serviceId, 
          parsed.preferredDate, 
          parsed.preferredStartTime || null, 
          parsed.preferredEndTime || null
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ errors: err.errors });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  // Listar fila de espera ativa
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const result = await db.query(
        `SELECT w.*, c.name as client_name, c.phone as client_phone, u.name as employee_name, s.name as service_name
         FROM waitlists w
         INNER JOIN client_profiles c ON w.client_profile_id = c.id
         INNER JOIN employee_profiles ep ON w.employee_profile_id = ep.id
         INNER JOIN users u ON ep.user_id = u.id
         INNER JOIN services s ON w.service_id = s.id
         WHERE w.tenant_id = $1 AND w.notified_at IS NULL
         ORDER BY w.created_at ASC`,
        [tenantId]
      );
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
};

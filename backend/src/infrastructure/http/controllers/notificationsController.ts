import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { db } from '../../database/pg.js';

export const notificationsController = {
  // Listar todas as notificações do usuário autenticado
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const query = `
        SELECT * FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `;
      const result = await db.query(query, [userId]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Marcar uma notificação específica como lida
  async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const query = `
        UPDATE notifications
        SET read = true
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;
      const result = await db.query(query, [id, userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Notificação não encontrada ou não pertencente ao usuário' });
      }

      return res.json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Marcar todas como lidas
  async markAllAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Não autorizado' });
      }

      const query = `
        UPDATE notifications
        SET read = true
        WHERE user_id = $1
        RETURNING *
      `;
      const result = await db.query(query, [userId]);
      return res.json({ message: 'Todas as notificações foram marcadas como lidas', count: result.rowCount });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
};

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { db } from '../../database/pg.js';

export const pushController = {
  async subscribe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { subscription } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Inscrição push inválida' });
      }

      // Verificar se a inscrição já existe para este usuário
      const existingResult = await db.query(
        "SELECT id FROM push_subscriptions WHERE user_id = $1 AND (subscription->>'endpoint') = $2",
        [userId, subscription.endpoint]
      );

      if (existingResult.rows.length > 0) {
        return res.status(200).json({ message: 'Inscrição push já existente' });
      }

      // Salvar nova inscrição
      await db.query(
        "INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2)",
        [userId, JSON.stringify(subscription)]
      );

      return res.status(201).json({ message: 'Inscrição push registrada com sucesso' });
    } catch (err: any) {
      console.error('Erro ao registrar inscrição push:', err);
      return res.status(500).json({ error: 'Erro interno do servidor ao salvar inscrição push' });
    }
  },

  async unsubscribe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { endpoint } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint não fornecido' });
      }

      await db.query(
        "DELETE FROM push_subscriptions WHERE user_id = $1 AND (subscription->>'endpoint') = $2",
        [userId, endpoint]
      );

      return res.status(200).json({ message: 'Inscrição push cancelada com sucesso' });
    } catch (err: any) {
      console.error('Erro ao cancelar inscrição push:', err);
      return res.status(500).json({ error: 'Erro interno do servidor ao cancelar inscrição push' });
    }
  }
};

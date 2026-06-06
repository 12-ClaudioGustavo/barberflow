import { db } from '../database/pg.js';
import { Server } from 'socket.io';

export const notificationService = {
  async createNotification(params: {
    userId: string;
    tenantId?: string | null;
    title: string;
    message: string;
    type?: string;
    io?: Server | null;
  }) {
    const { userId, tenantId, title, message, type = 'info', io } = params;
    try {
      const query = `
        INSERT INTO notifications (user_id, tenant_id, title, message, type, read)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING *
      `;
      const result = await db.query(query, [userId, tenantId || null, title, message, type]);
      const newNotification = result.rows[0];

      if (io) {
        io.to(`user:${userId}`).emit('new_notification', newNotification);
      }
      return newNotification;
    } catch (err) {
      console.error('Error creating notification:', err);
      return null;
    }
  }
};

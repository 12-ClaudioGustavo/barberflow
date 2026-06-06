import { db } from '../database/pg.js';
import { Server } from 'socket.io';
import webpush from 'web-push';

// Configurar detalhes VAPID
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:suporte@barberflow.com';

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails(
      vapidSubject,
      publicVapidKey,
      privateVapidKey
    );
  } catch (err) {
    console.error('Falha ao configurar VAPID para web-push:', err);
  }
}

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

      // Emitir via Socket.IO
      if (io) {
        io.to(`user:${userId}`).emit('new_notification', newNotification);
      }

      // Enviar Push Notifications
      if (publicVapidKey && privateVapidKey) {
        try {
          const pushResult = await db.query(
            'SELECT id, subscription FROM push_subscriptions WHERE user_id = $1',
            [userId]
          );

          if (pushResult.rows.length > 0) {
            const payload = JSON.stringify({
              title,
              body: message,
              url: type.includes('reminder') || type.includes('appointment') ? '/booking' : '/dashboard'
            });

            const sendPromises = pushResult.rows.map(async (row) => {
              try {
                // row.subscription é um objeto JSONB no postgresql
                await webpush.sendNotification(row.subscription, payload);
              } catch (sendErr: any) {
                // Remover inscrições inválidas ou expiradas (410 Gone / 404 Not Found)
                if (sendErr.statusCode === 410 || sendErr.statusCode === 404) {
                  await db.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
                } else {
                  console.error(`Erro ao enviar push para inscrição ${row.id}:`, sendErr);
                }
              }
            });

            // Executar em segundo plano sem travar a requisição principal
            Promise.all(sendPromises).catch((err) => {
              console.error('Erro em lote no envio de push notifications:', err);
            });
          }
        } catch (pushErr) {
          console.error('Erro ao buscar ou enviar push notifications:', pushErr);
        }
      }

      return newNotification;
    } catch (err) {
      console.error('Error creating notification:', err);
      return null;
    }
  }
};

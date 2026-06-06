import { db } from '../database/pg.js';
import { notificationService } from './notificationService.js';
import { Server } from 'socket.io';

export function startReminderWorker(io: Server) {
  console.log('⏰ Worker de Lembretes iniciado...');
  
  // Executar a cada 5 minutos
  setInterval(async () => {
    try {
      console.log('⏰ Executando verificação de lembretes...');
      
      // 1. Lembretes de 30 minutos para clientes
      const clientRemindersQuery = `
        SELECT a.id, a.scheduled_time, a.tenant_id, cp.user_id, cp.name as client_name
        FROM appointments a
        INNER JOIN client_profiles cp ON a.client_profile_id = cp.id
        WHERE a.status != 'cancelled'
          AND a.scheduled_time BETWEEN NOW() + INTERVAL '25 minutes' AND NOW() + INTERVAL '35 minutes'
      `;
      const clientResult = await db.query(clientRemindersQuery);
      
      for (const appt of clientResult.rows) {
        const timeStr = new Date(appt.scheduled_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const uniqueMessage = `Sua reserva começa em 30 minutos (às ${timeStr}). (ID: ${appt.id})`;
        
        // Verificar se já foi enviado
        const checkQuery = `
          SELECT id FROM notifications
          WHERE user_id = $1 AND type = 'client_reminder_30m' AND message = $2
        `;
        const checkResult = await db.query(checkQuery, [appt.user_id, uniqueMessage]);
        
        if (checkResult.rowCount === 0) {
          await notificationService.createNotification({
            userId: appt.user_id,
            tenantId: appt.tenant_id,
            title: 'Reserva em breve!',
            message: uniqueMessage,
            type: 'client_reminder_30m',
            io
          });
        }
      }

      // 2. Lembretes de 15 minutos para barbeiros
      const employeeRemindersQuery = `
        SELECT a.id, a.scheduled_time, a.tenant_id, ep.user_id, cp.name as client_name
        FROM appointments a
        INNER JOIN employee_profiles ep ON a.employee_profile_id = ep.id
        INNER JOIN client_profiles cp ON a.client_profile_id = cp.id
        WHERE a.status != 'cancelled'
          AND a.scheduled_time BETWEEN NOW() + INTERVAL '10 minutes' AND NOW() + INTERVAL '20 minutes'
      `;
      const employeeResult = await db.query(employeeRemindersQuery);
      
      for (const appt of employeeResult.rows) {
        const timeStr = new Date(appt.scheduled_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const uniqueMessage = `Próximo cliente em 15 minutos: ${appt.client_name} (às ${timeStr}). (ID: ${appt.id})`;
        
        // Verificar se já foi enviado
        const checkQuery = `
          SELECT id FROM notifications
          WHERE user_id = $1 AND type = 'employee_reminder_15m' AND message = $2
        `;
        const checkResult = await db.query(checkQuery, [appt.user_id, uniqueMessage]);
        
        if (checkResult.rowCount === 0) {
          await notificationService.createNotification({
            userId: appt.user_id,
            tenantId: appt.tenant_id,
            title: 'Atendimento em breve!',
            message: uniqueMessage,
            type: 'employee_reminder_15m',
            io
          });
        }
      }
    } catch (err) {
      console.error('Erro no worker de lembretes:', err);
    }
  }, 5 * 60 * 1000); // 5 minutos
}

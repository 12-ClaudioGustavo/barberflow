import { db } from '../../../infrastructure/database/pg.js';

interface Slot {
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  available: boolean;
}

export class CalculateAvailabilitySlots {
  async execute(tenantId: string, employeeProfileId: string, dateStr: string, serviceId: string): Promise<Slot[]> {
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // 1. Obter a duração do serviço
    const serviceRes = await db.query(
      'SELECT duration_minutes, name FROM services WHERE id = $1 AND tenant_id = $2',
      [serviceId, tenantId]
    );
    if (serviceRes.rowCount === 0) {
      throw new Error('Service not found');
    }
    const serviceDuration = serviceRes.rows[0].duration_minutes;

    // 2. Obter a escala de trabalho do funcionário para o dia da semana correspondente (0 = Domingo, 6 = Sábado)
    const dayOfWeek = targetDate.getUTCDay(); // Usar UTC para evitar problemas de fuso horário local no backend
    const shiftRes = await db.query(
      `SELECT start_time, end_time, break_start_time, break_end_time, is_working_day
       FROM shift_schedules
       WHERE employee_profile_id = $1 AND day_of_week = $2 AND tenant_id = $3`,
      [employeeProfileId, dayOfWeek, tenantId]
    );

    if (shiftRes.rowCount === 0 || !shiftRes.rows[0].is_working_day) {
      // Funcionário não trabalha nesse dia
      return [];
    }

    const shift = shiftRes.rows[0];

    // 3. Obter folgas/férias ativas que sobreponham o dia selecionado
    // Definimos o início e fim do dia selecionado em UTC
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const timeoffsRes = await db.query(
      `SELECT start_date, end_date
       FROM employee_timeoffs
       WHERE employee_profile_id = $1 AND tenant_id = $2 AND is_approved = true
         AND start_date <= $4 AND end_date >= $3`,
      [employeeProfileId, tenantId, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    const timeoffs = timeoffsRes.rows.map(row => ({
      start: new Date(row.start_date),
      end: new Date(row.end_date),
    }));

    // Se houver folga aprovada cobrindo o dia inteiro (ex: vacation), retornar vazio
    const coversWholeDay = timeoffs.some(to => to.start <= startOfDay && to.end >= endOfDay);
    if (coversWholeDay) {
      return [];
    }

    // 4. Obter agendamentos existentes ativos para o dia
    const appointmentsRes = await db.query(
      `SELECT scheduled_time, end_time
       FROM appointments
       WHERE employee_profile_id = $1 AND tenant_id = $2 AND status != 'cancelled'
         AND scheduled_time >= $3 AND scheduled_time <= $4`,
      [employeeProfileId, tenantId, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    const appointments = appointmentsRes.rows.map(row => ({
      start: new Date(row.scheduled_time),
      end: new Date(row.end_time),
    }));

    // 5. Gerar os slots de tempo
    const slots: Slot[] = [];
    const [startHour, startMin] = shift.start_time.split(':').map(Number);
    const [endHour, endMin] = shift.end_time.split(':').map(Number);

    const workStart = new Date(startOfDay);
    workStart.setUTCHours(startHour, startMin, 0, 0);

    const workEnd = new Date(startOfDay);
    workEnd.setUTCHours(endHour, endMin, 0, 0);

    const slotIntervalMinutes = 15; // Intervalo para início de novos agendamentos
    let currentSlotStart = new Date(workStart);

    while (currentSlotStart.getTime() + serviceDuration * 60000 <= workEnd.getTime()) {
      const currentSlotEnd = new Date(currentSlotStart.getTime() + serviceDuration * 60000);

      // A. Validar se coincide com intervalo/break
      let isInsideBreak = false;
      if (shift.break_start_time && shift.break_end_time) {
        const [bSHour, bSMin] = shift.break_start_time.split(':').map(Number);
        const [bEHour, bEMin] = shift.break_end_time.split(':').map(Number);

        const breakStart = new Date(startOfDay);
        breakStart.setUTCHours(bSHour, bSMin, 0, 0);

        const breakEnd = new Date(startOfDay);
        breakEnd.setUTCHours(bEHour, bEMin, 0, 0);

        if (currentSlotStart < breakEnd && currentSlotEnd > breakStart) {
          isInsideBreak = true;
        }
      }

      // B. Validar se sobrepõe agendamentos
      const hasAppointmentConflict = appointments.some(app => {
        return currentSlotStart < app.end && currentSlotEnd > app.start;
      });

      // C. Validar se sobrepõe folgas temporárias
      const hasTimeoffConflict = timeoffs.some(to => {
        return currentSlotStart < to.end && currentSlotEnd > to.start;
      });

      const available = !isInsideBreak && !hasAppointmentConflict && !hasTimeoffConflict;

      slots.push({
        startTime: this.formatTime(currentSlotStart),
        endTime: this.formatTime(currentSlotEnd),
        available,
      });

      // Avançar para o próximo intervalo de agendamento (15 min)
      currentSlotStart = new Date(currentSlotStart.getTime() + slotIntervalMinutes * 60000);
    }

    return slots;
  }

  private formatTime(date: Date): string {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalculateAvailabilitySlots } from './CalculateAvailabilitySlots.js';
import { db } from '../../../infrastructure/database/pg.js';

// Mock do módulo de banco de dados
vi.mock('../../../infrastructure/database/pg.js', () => {
  return {
    db: {
      query: vi.fn(),
    },
  };
});

describe('CalculateAvailabilitySlots Engine Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate available slots based on employee shift schedule and service duration', async () => {
    const useCase = new CalculateAvailabilitySlots();
    
    // Mock do serviço: Corte Simples (30 minutos)
    vi.mocked(db.query).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ duration_minutes: 30, name: 'Corte Simples' }],
    } as any);

    // Mock da escala de trabalho: Segunda-feira, das 09:00 às 11:00 (sem almoço)
    vi.mocked(db.query).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        start_time: '09:00:00',
        end_time: '11:00:00',
        break_start_time: null,
        break_end_time: null,
        is_working_day: true,
      }],
    } as any);

    // Mock de folgas: nenhuma folga ativa
    vi.mocked(db.query).mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    } as any);

    // Mock de agendamentos existentes: nenhum agendamento
    vi.mocked(db.query).mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    } as any);

    const slots = await useCase.execute(
      'tenant-id-uuid',
      'employee-id-uuid',
      '2026-06-08', // Uma segunda-feira
      'service-id-uuid'
    );

    // Esperado slots de 30 minutos de duração de 15 em 15 minutos de início:
    // 09:00 - 09:30 (Livre)
    // 09:15 - 09:45 (Livre)
    // 09:30 - 10:00 (Livre)
    // 09:45 - 10:15 (Livre)
    // 10:00 - 10:30 (Livre)
    // 10:15 - 10:45 (Livre)
    // 10:30 - 11:00 (Livre)
    expect(slots.length).toBe(7);
    expect(slots[0]).toEqual({ startTime: '09:00', endTime: '09:30', available: true });
    expect(slots[slots.length - 1]).toEqual({ startTime: '10:30', endTime: '11:00', available: true });
  });

  it('should block slots that overlap with breaks or existing bookings', async () => {
    const useCase = new CalculateAvailabilitySlots();
    
    // Mock do serviço: Corte Premium (60 minutos)
    vi.mocked(db.query).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ duration_minutes: 60, name: 'Corte Premium' }],
    } as any);

    // Mock da escala: 08:00 às 12:00, com break (almoço) de 11:00 às 12:00
    vi.mocked(db.query).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        start_time: '08:00:00',
        end_time: '12:00:00',
        break_start_time: '11:00:00',
        break_end_time: '12:00:00',
        is_working_day: true,
      }],
    } as any);

    // Mock de folgas: nenhuma
    vi.mocked(db.query).mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    } as any);

    // Mock de agendamentos: das 09:00 às 10:00 (Ocupado)
    vi.mocked(db.query).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        scheduled_time: '2026-06-08T09:00:00.000Z',
        end_time: '2026-06-08T10:00:00.000Z',
      }],
    } as any);

    const slots = await useCase.execute(
      'tenant-id-uuid',
      'employee-id-uuid',
      '2026-06-08',
      'service-id-uuid'
    );

    // Slots possíveis iniciando a cada 15m (duração 60m):
    // 08:00 - 09:00 (Livre) -> true
    // 08:15 - 09:15 (Sobrepõe agendamento 09:00 - 10:00) -> false
    // 08:30 - 09:30 (Sobrepõe agendamento 09:00 - 10:00) -> false
    // 08:45 - 09:45 (Sobrepõe agendamento 09:00 - 10:00) -> false
    // 09:00 - 10:00 (Sobrepõe agendamento 09:00 - 10:00) -> false
    // 09:15 - 10:15 (Sobrepõe agendamento 09:00 - 10:00) -> false
    // 09:30 - 10:30 (Sobrepõe agendamento 09:00 - 10:00) -> false
    // 09:45 - 10:45 (Sobrepõe agendamento 09:00 - 10:00) -> false
    // 10:00 - 11:00 (Livre) -> true
    // 10:15 - 11:15 (Sobrepõe almoço 11:00 - 12:00) -> false
    
    const freeSlots = slots.filter(s => s.available);
    expect(freeSlots.length).toBe(2);
    expect(freeSlots[0].startTime).toBe('08:00');
    expect(freeSlots[1].startTime).toBe('10:00');
  });
});

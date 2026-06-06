'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { LogOut, Scissors, ChevronRight, Calendar, X, Loader2, ChevronLeft, ChevronDown } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

type Employee = {
  profile_id: string;
  name: string;
};

type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
};

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  available: boolean;
};

type DailyAvailability = {
  date: string;
  dayOfWeek: number;
  slots: AvailabilitySlot[];
  availableCount: number;
};

type ClientProfile = {
  id: string;
  name: string;
  phone?: string | null;
};

type Appointment = {
  id: string;
  client_profile_id: string;
  employee_profile_id: string;
  service_id: string;
  scheduled_time: string;
  end_time: string;
  status: string;
  client_name: string;
  employee_name: string;
  service_name: string;
  barbershop_name?: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const formatWeekday = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });

const formatDateLabel = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

const formatTime = (time: string) => time.substring(0, 5);

const isTimePassed = (date: string, time: string): boolean => {
  const now = new Date();
  const slotDateTime = new Date(`${date}T${time}:00`);
  return slotDateTime < now;
};

export default function ClientBookingPage() {
  const router = useRouter();
  const { user, loading, initialized, session, signOut } = useAuthStore();

  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Weekly availability grid: employee x day
  const [weeklyData, setWeeklyData] = useState<Map<string, Map<string, DailyAvailability>>>(new Map());
  const [loadingData, setLoadingData] = useState(true);

  // Selected date for display (single day view)
  const [selectedDisplayDate, setSelectedDisplayDate] = useState('');

  // Modal state for booking wizard
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStartTime, setSelectedStartTime] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isClientRole = user?.role === 'client';

  useEffect(() => {
    if (initialized && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, initialized, router]);

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = session?.access_token;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      await signOut();
      router.push('/login');
      throw new Error('Sessão expirada. Você foi desconectado automaticamente.');
    }

    return res;
  };

  // Carregar lista de barbearias (apenas se for cliente)
  useEffect(() => {
    const loadTenants = async () => {
      if (!user || !session) return;
      try {
        const res = await fetch(`${apiUrl}/auth/tenants`);
        if (res.ok) {
          const tenantsData = await res.json();
          setTenants(tenantsData);
        }
      } catch (err) {
        console.error('Erro ao carregar barbearias:', err);
      }
    };
    loadTenants();
  }, [user, session]);

  // Sincronizar tenantId inicial do usuário
  useEffect(() => {
    if (user?.tenantId && !selectedTenantId) {
      setSelectedTenantId(user.tenantId);
    }
  }, [user, selectedTenantId]);

  // Load initial data: employees, services, clients based on selectedTenantId
  useEffect(() => {
    const loadBarbershopData = async () => {
      if (!user || !session || !selectedTenantId) return;

      setLoadingData(true);
      setErrorMsg('');

      try {
        const [servicesRes, employeesRes] = await Promise.all([
          fetchWithAuth(`${apiUrl}/services?all=true&tenantId=${selectedTenantId}`),
          fetchWithAuth(`${apiUrl}/employees?tenantId=${selectedTenantId}`),
        ]);

        if (!servicesRes.ok || !employeesRes.ok) {
          throw new Error('Erro ao carregar dados da barbearia.');
        }

        const servicesData = await servicesRes.json();
        const employeesData = await employeesRes.json();

        setServices(servicesData);
        setEmployees(employeesData);

        if (isClientRole) {
          const meRes = await fetchWithAuth(`${apiUrl}/clients/me`);
          if (!meRes.ok) {
            throw new Error('Não foi possível obter seu perfil de cliente.');
          }
          const clientProfile = await meRes.json();
          setClients([clientProfile]);
        } else {
          const clientsRes = await fetchWithAuth(`${apiUrl}/clients`);
          if (!clientsRes.ok) {
            throw new Error('Não foi possível carregar a lista de clientes.');
          }
          setClients(await clientsRes.json());
        }

        // Load appointments (across all barbearias for this client)
        const apptsRes = await fetchWithAuth(`${apiUrl}/booking`);
        if (apptsRes.ok) {
          setAppointments(await apptsRes.json());
        }

        // Set initial display date to today if not set
        if (!selectedDisplayDate) {
          const today = new Date().toISOString().substring(0, 10);
          setSelectedDisplayDate(today);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Falha ao carregar a página de agendamento.');
      } finally {
        setLoadingData(false);
      }
    };

    loadBarbershopData();
  }, [user, session, selectedTenantId, isClientRole, refreshTrigger]);

  // Load weekly availability for all employees
  useEffect(() => {
    const loadWeeklyAvailability = async () => {
      if (!user || !session || !selectedTenantId || employees.length === 0 || services.length === 0) return;

      setLoadingData(true);
      setErrorMsg('');

      try {
        const startDate = new Date().toISOString().substring(0, 10);
        const newWeeklyData = new Map<string, Map<string, DailyAvailability>>();

        // For each employee, load 7-day availability for the first active service
        const firstService = services.find(s => s.is_active);
        if (!firstService) {
          setWeeklyData(new Map());
          setLoadingData(false);
          return;
        }

        await Promise.all(
          employees.map(async (emp) => {
            try {
              const res = await fetchWithAuth(
                `${apiUrl}/booking/weekly-slots?tenantId=${encodeURIComponent(selectedTenantId)}&employeeId=${encodeURIComponent(emp.profile_id)}&serviceId=${encodeURIComponent(firstService.id)}&startDate=${startDate}&days=7`
               );

              if (res.ok) {
                const weekData = await res.json();
                const dayMap = new Map<string, DailyAvailability>();
                weekData.forEach((day: DailyAvailability) => {
                  dayMap.set(day.date, day);
                });
                newWeeklyData.set(emp.profile_id, dayMap);
              }
            } catch (err) {
              console.error(`Failed to load availability for employee ${emp.profile_id}:`, err);
            }
          })
        );

        setWeeklyData(newWeeklyData);
      } catch (err: any) {
        setErrorMsg(err.message || 'Não foi possível carregar disponibilidade.');
      } finally {
        setLoadingData(false);
      }
    };

    loadWeeklyAvailability();
  }, [employees, services, selectedTenantId, user, session, refreshTrigger]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const openBookingModal = (employeeId: string, date: string, startTime: string) => {
    setSelectedEmployeeId(employeeId);
    setSelectedDate(date);
    setSelectedStartTime(startTime);
    setBookingStep(1);
    setShowBookingModal(true);
  };

  const handleNextStep = () => {
    if (!selectedServiceId) {
      setErrorMsg('Selecione um serviço.');
      return;
    }
    if (!isClientRole && !selectedClientId) {
      setErrorMsg('Selecione um cliente.');
      return;
    }
    setErrorMsg('');
    setBookingStep(2);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const clientId = isClientRole ? clients[0]?.id : selectedClientId;
      if (!clientId || !selectedEmployeeId || !selectedServiceId || !selectedDate || !selectedStartTime) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }

      const payload = {
        clientProfileId: clientId,
        employeeProfileId: selectedEmployeeId,
        serviceId: selectedServiceId,
        scheduledTime: `${selectedDate}T${selectedStartTime}:00.000Z`,
      };

      const response = await fetchWithAuth(`${apiUrl}/booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao salvar a reserva.');
      }

      setSuccessMsg('Reserva salva com sucesso!');
      setShowBookingModal(false);
      setSelectedServiceId('');
      setSelectedClientId('');
      setRefreshTrigger(prev => prev + 1);

      // Reload appointments
      const apptsRes = await fetchWithAuth(`${apiUrl}/booking`);
      if (apptsRes.ok) {
        setAppointments(await apptsRes.json());
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível salvar a reserva.');
    } finally {
      setActionLoading(false);
    }
  };

  const getNextSevenDays = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().substring(0, 10));
    }
    return dates;
  };

  const nextSevenDays = useMemo(() => getNextSevenDays(), []);
  const selectedEmployee = employees.find(e => e.profile_id === selectedEmployeeId);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedClient = clients.find(c => c.id === selectedClientId);

  if (loading || initialized === false || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="text-sm text-gray-500 animate-pulse">Carregando...</p>
      </div>
    );
  }

  const dayIndex = nextSevenDays.indexOf(selectedDisplayDate);
  const prevDateAvailable = dayIndex > 0;
  const nextDateAvailable = dayIndex < nextSevenDays.length - 1;

  const handlePrevDay = () => {
    if (dayIndex > 0) {
      setSelectedDisplayDate(nextSevenDays[dayIndex - 1]);
    }
  };

  const handleNextDay = () => {
    if (dayIndex < nextSevenDays.length - 1) {
      setSelectedDisplayDate(nextSevenDays[dayIndex + 1]);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/5 bg-neutral-950 px-8 py-5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-amber-500 stroke-[2]" />
          <span className="font-bold text-base font-serif">Barber<span className="text-amber-500 font-sans">Flow</span></span>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <span className="text-xs text-gray-400">Olá, <strong className="text-white font-normal">{user.name}</strong></span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/10 hover:border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/5 transition text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-white/5 pb-8">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-amber-500" />
            <div>
              <h1 className="text-3xl font-bold font-serif">Agende com flexibilidade</h1>
              <p className="text-sm text-gray-400 mt-1">Escolha uma data e veja os horários disponíveis dos barbeiros.</p>
            </div>
          </div>

          {/* Seletor de Barbearia */}
          {tenants.length > 0 && (
            <div className="min-w-[280px] bg-neutral-900 border border-white/10 rounded-2xl p-4 flex flex-col gap-1.5 shadow-lg">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Selecionar Barbearia</label>
              <div className="relative">
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-amber-500/50 appearance-none pr-10 text-white font-medium cursor-pointer"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {loadingData ? (
          <div className="text-center py-20">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500 mb-4" />
            <p className="text-gray-400">Carregando agenda...</p>
          </div>
        ) : errorMsg && !showBookingModal ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 mb-6">
            {errorMsg}
          </div>
        ) : (
          <>
            {/* Date Selector */}
            <div className="mb-8">
              <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <button
                    onClick={handlePrevDay}
                    disabled={!prevDateAvailable}
                    className="p-2 rounded-lg border border-white/10 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="flex-1">
                    <select
                      value={selectedDisplayDate}
                      onChange={(e) => setSelectedDisplayDate(e.target.value)}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                    >
                      {nextSevenDays.map((date) => (
                        <option key={date} value={date}>
                          {formatDateLabel(date)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleNextDay}
                    disabled={!nextDateAvailable}
                    className="p-2 rounded-lg border border-white/10 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Single Day View */}
            {selectedDisplayDate && (
              <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6 mb-8">
                <div className="mb-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{formatWeekday(selectedDisplayDate)}</p>
                  <h2 className="text-2xl font-bold">{formatDateLabel(selectedDisplayDate)}</h2>
                </div>

                {/* Employees Grid for selected day */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {employees.map((emp) => {
                    const dayAvailability = weeklyData.get(emp.profile_id)?.get(selectedDisplayDate);
                    const allSlots = dayAvailability?.slots || [];

                    return (
                      <div
                        key={emp.profile_id}
                        className="rounded-2xl border border-white/10 bg-neutral-950 p-4 hover:border-amber-500/30 transition"
                      >
                        <p className="font-semibold text-amber-500 mb-4">{emp.name}</p>

                        {allSlots.length === 0 ? (
                          <p className="text-xs text-gray-500">Sem atendimento neste dia</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {allSlots.map((slot) => {
                              const isPassed = isTimePassed(selectedDisplayDate, slot.startTime);
                              const canBook = slot.available && !isPassed;
                              
                              return (
                                <button
                                  key={`${emp.profile_id}-${selectedDisplayDate}-${slot.startTime}`}
                                  onClick={() => canBook && openBookingModal(emp.profile_id, selectedDisplayDate, slot.startTime)}
                                  disabled={!canBook}
                                  className={`px-3 py-2 text-xs rounded-lg border font-medium transition ${
                                    isPassed
                                      ? 'bg-red-500/10 border-red-500/30 text-red-300 cursor-not-allowed opacity-50'
                                      : slot.available
                                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-100 border-amber-500/20 hover:border-amber-500/50 cursor-pointer'
                                      : 'bg-neutral-800 border-white/5 text-gray-500 cursor-not-allowed'
                                  }`}
                                  title={isPassed ? 'Horário já passou' : !slot.available ? 'Indisponível' : ''}
                                >
                                  {formatTime(slot.startTime)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Appointments Section */}
            <div className="mt-12">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Minhas reservas</h2>
                <p className="text-sm text-gray-400">Histórico de agendamentos realizados.</p>
              </div>

              {appointments.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-neutral-900 p-10 text-center">
                  <p className="text-gray-400">Você ainda não tem nenhuma reserva agendada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((appt) => {
                    const apptDate = new Date(appt.scheduled_time);
                    const dateStr = apptDate.toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={appt.id}
                        className="rounded-2xl border border-white/10 bg-neutral-900 p-4 flex items-center justify-between hover:border-white/20 transition"
                      >
                        <div className="flex-1">
                          {appt.barbershop_name && (
                            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">
                              🏪 {appt.barbershop_name}
                            </p>
                          )}
                          <p className="font-semibold text-neutral-100">{appt.service_name}</p>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {appt.employee_name} • {dateStr}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          appt.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                          appt.status === 'cancelled' ? 'bg-red-500/20 text-red-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {appt.status === 'scheduled' ? 'Agendado' :
                           appt.status === 'confirmed' ? 'Confirmado' :
                           appt.status === 'completed' ? 'Finalizado' :
                           appt.status === 'cancelled' ? 'Cancelado' : appt.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Booking Modal - Wizard */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setShowBookingModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-neutral-800 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                bookingStep >= 1 ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-gray-400'
              }`}>
                1
              </div>
              <div className={`flex-1 h-1 rounded-full ${
                bookingStep >= 2 ? 'bg-amber-500' : 'bg-neutral-800'
              }`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                bookingStep >= 2 ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-gray-400'
              }`}>
                2
              </div>
            </div>

            {bookingStep === 1 ? (
              <>
                <h2 className="text-2xl font-bold mb-6">{isClientRole ? 'Escolha o serviço' : 'Escolha o cliente e serviço'}</h2>

                {errorMsg && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 mb-4">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="space-y-5">
                  {!isClientRole && (
                    <div>
                      <label className="block text-sm text-gray-400 uppercase tracking-wider mb-2">Cliente</label>
                      <select
                        required
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="">Selecione o cliente</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name} {client.phone ? `(${client.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-gray-400 uppercase tracking-wider mb-2">Serviço</label>
                    <select
                      required
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">Selecione o serviço</option>
                      {services.filter(s => s.is_active).map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.name} - R$ {svc.price.toFixed(2)} ({svc.duration_minutes} min)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    Continuar
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-6">Confirme sua reserva</h2>

                {errorMsg && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 mb-4">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 mb-4">
                    {successMsg}
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div className="rounded-2xl bg-neutral-950 p-4 border border-white/10">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Data e horário</p>
                    <p className="font-semibold">
                      {formatDateLabel(selectedDate)} às {formatTime(selectedStartTime)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-neutral-950 p-4 border border-white/10">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Barbeiro</p>
                    <p className="font-semibold">{selectedEmployee?.name}</p>
                  </div>

                  <div className="rounded-2xl bg-neutral-950 p-4 border border-white/10">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Serviço</p>
                    <p className="font-semibold">{selectedService?.name}</p>
                    <p className="text-xs text-gray-400 mt-1">R$ {selectedService?.price.toFixed(2)} • {selectedService?.duration_minutes} min</p>
                  </div>

                  {selectedClient && (
                    <div className="rounded-2xl bg-neutral-950 p-4 border border-white/10">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
                      <p className="font-semibold">{selectedClient.name}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleBooking}
                    disabled={actionLoading}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar reserva'}
                  </button>
                  <button
                    onClick={() => setBookingStep(1)}
                    className="w-full bg-neutral-950 hover:bg-neutral-850 border border-white/10 text-white font-semibold py-3 rounded-xl transition"
                  >
                    Voltar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Footer */}
      <footer className="border-t border-white/5 py-6 mt-auto text-center text-xs text-gray-500 z-10">
        BarberFlow &copy; {new Date().getFullYear()} - Desenvolvido por Claudio Gustavo
      </footer>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Scissors,
  LogOut,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';

interface Appointment {
  id: string;
  client_profile_id: string;
  employee_profile_id: string;
  service_id: string;
  scheduled_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  client_name: string;
  client_phone: string | null;
  employee_name: string;
  service_name: string;
}

interface DaySummary {
  totalAppointments: number;
  completed: number;
  pending: number;
  totalRevenue: number;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const isToday = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const getNextDays = (count: number) => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().substring(0, 10));
  }
  return dates;
};

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const { user, loading, initialized, signOut, session } = useAuthStore();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    if (initialized && !loading && (!user || user.role !== 'employee')) {
      router.push('/login');
    }
  }, [user, loading, initialized, router]);

  useEffect(() => {
    if (user && session) {
      const today = new Date().toISOString().substring(0, 10);
      setSelectedDate(today);
      loadAppointments(today);
    }
  }, [user, session]);

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

  const loadAppointments = async (date: string) => {
    setPageLoading(true);
    setErrorMsg('');

    try {
      const res = await fetchWithAuth(`${apiUrl}/booking?date=${date}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar agendamentos.');
      }
      const data = await res.json();
      setAppointments(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar agendamentos.');
    } finally {
      setPageLoading(false);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    loadAppointments(date);
  };

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetchWithAuth(`${apiUrl}/booking/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao atualizar status.');
      }

      setSuccessMsg('Status atualizado com sucesso!');
      setOpenMenuId(null);
      await loadAppointments(selectedDate);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  if (loading || initialized === false || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="text-sm text-gray-500 animate-pulse">Carregando...</p>
      </div>
    );
  }

  const nextDays = getNextDays(30);
  const dayIndex = nextDays.indexOf(selectedDate);
  const daySummary: DaySummary = {
    totalAppointments: appointments.length,
    completed: appointments.filter(a => a.status === 'completed').length,
    pending: appointments.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length,
    totalRevenue: 0, // Se tiver integração de preços, calcular aqui
  };

  const filteredAppointments = statusFilter === 'all'
    ? appointments
    : appointments.filter(a => a.status === statusFilter);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-neutral-950 px-8 py-5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-amber-500 stroke-[2]" />
          <span className="font-bold text-base font-serif">Barber<span className="text-amber-500 font-sans">Flow</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">Barbeiro: <strong className="text-white font-normal">{user.name}</strong></span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/10 hover:border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/5 transition text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        {/* Page Title */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-8 w-8 text-amber-500" />
            <div>
              <h1 className="text-3xl font-bold font-serif">Minha Agenda</h1>
              <p className="text-sm text-gray-400 mt-1">Controle seus agendamentos e atualize o status dos atendimentos.</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 mb-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 mb-6 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5" />
            {successMsg}
          </div>
        )}

        {/* Date Selector */}
        <div className="mb-8">
          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => dayIndex > 0 && handleDateChange(nextDays[dayIndex - 1])}
                disabled={dayIndex === 0}
                className="p-2 rounded-lg border border-white/10 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex-1">
                <select
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                >
                  {nextDays.map((date) => (
                    <option key={date} value={date}>
                      {isToday(date) ? 'Hoje' : ''} {formatDate(date)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => dayIndex < nextDays.length - 1 && handleDateChange(nextDays[dayIndex + 1])}
                disabled={dayIndex === nextDays.length - 1}
                className="p-2 rounded-lg border border-white/10 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Day Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-neutral-950 p-4 border border-white/10">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Total de Atendimentos</p>
                <p className="text-2xl font-bold">{daySummary.totalAppointments}</p>
              </div>
              <div className="rounded-2xl bg-neutral-950 p-4 border border-white/10">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Pendentes</p>
                <p className="text-2xl font-bold text-amber-500">{daySummary.pending}</p>
              </div>
              <div className="rounded-2xl bg-neutral-950 p-4 border border-white/10">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Concluídos</p>
                <p className="text-2xl font-bold text-emerald-500">{daySummary.completed}</p>
              </div>
              <div className="rounded-2xl bg-neutral-950 p-4 border border-white/10">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cancelados</p>
                <p className="text-2xl font-bold text-red-500">{appointments.filter(a => a.status === 'cancelled').length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(['all', 'scheduled', 'confirmed', 'in_progress', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                statusFilter === status
                  ? 'bg-amber-500 text-black'
                  : 'bg-neutral-900 border border-white/10 text-gray-400 hover:border-amber-500/50'
              }`}
            >
              {status === 'all' ? 'Todos' : status === 'scheduled' ? 'Agendado' : status === 'confirmed' ? 'Confirmado' : status === 'in_progress' ? 'Em Progresso' : 'Concluído'}
            </button>
          ))}
        </div>

        {/* Appointments List */}
        {pageLoading ? (
          <div className="text-center py-20">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500 mb-4" />
            <p className="text-gray-400">Carregando agendamentos...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-10 text-center">
            <Calendar className="h-10 w-10 text-amber-500/60 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-1">Nenhum agendamento</h3>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {statusFilter === 'all'
                ? 'Não há agendamentos para este dia.'
                : `Não há agendamentos com status "${statusFilter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAppointments
              .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
              .map((appt) => (
                <div
                  key={appt.id}
                  className="rounded-2xl border border-white/10 bg-neutral-900 p-6 hover:border-white/20 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <p className="text-lg font-semibold">{formatTime(appt.scheduled_time)}</p>
                        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${
                          appt.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                          appt.status === 'cancelled' ? 'bg-red-500/20 text-red-300' :
                          appt.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300' :
                          appt.status === 'confirmed' ? 'bg-purple-500/20 text-purple-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {appt.status === 'scheduled' ? 'Agendado' :
                           appt.status === 'confirmed' ? 'Confirmado' :
                           appt.status === 'in_progress' ? 'Em Progresso' :
                           appt.status === 'completed' ? 'Concluído' : 'Cancelado'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-400 mb-4">{appt.service_name}</p>

                      <div className="rounded-xl bg-neutral-950 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{appt.client_name}</span>
                        </div>
                        {appt.client_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-400">{appt.client_phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Change Menu */}
                    <div className="relative ml-4">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === appt.id ? null : appt.id)}
                        className="p-2 rounded-lg hover:bg-neutral-800 transition"
                        disabled={actionLoading}
                      >
                        <MoreVertical className="h-5 w-5 text-gray-400" />
                      </button>

                      {openMenuId === appt.id && (
                        <div className="absolute right-0 mt-2 w-48 rounded-lg bg-neutral-800 border border-white/10 shadow-lg z-10">
                          <div className="p-2 space-y-1">
                            {appt.status !== 'completed' && (
                              <>
                                {appt.status !== 'in_progress' && (
                                  <button
                                    onClick={() => handleStatusChange(appt.id, 'in_progress')}
                                    className="w-full text-left px-4 py-2 rounded text-sm hover:bg-neutral-700 transition"
                                  >
                                    👷 Iniciar Atendimento
                                  </button>
                                )}
                                {appt.status === 'in_progress' && (
                                  <button
                                    onClick={() => handleStatusChange(appt.id, 'completed')}
                                    className="w-full text-left px-4 py-2 rounded text-sm hover:bg-neutral-700 transition text-emerald-300"
                                  >
                                    ✅ Marcar como Concluído
                                  </button>
                                )}
                              </>
                            )}
                            {appt.status !== 'cancelled' && (
                              <button
                                onClick={() => handleStatusChange(appt.id, 'cancelled')}
                                className="w-full text-left px-4 py-2 rounded text-sm hover:bg-neutral-700 transition text-red-300"
                              >
                                ❌ Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Scissors,
  LogOut,
  Shield,
  Users,
  BarChart3,
  Settings,
  Calendar,
  DollarSign,
  Plus,
  Check,
  X,
  ClipboardList,
  AlertCircle,
  Edit,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  UserPlus,
  Sliders,
  CalendarDays,
  FileText
} from 'lucide-react';

// Interfaces para tipagem dos dados do backend
interface Employee {
  profile_id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  hiring_date: string;
  commission_percentage: number;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

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

interface ClientProfile {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  birth_date: string | null;
  total_spent: string | number;
  visits_count: number;
}

interface FinancialTransaction {
  id: string;
  appointment_id: string | null;
  type: 'income' | 'expense';
  category: string;
  amount: string | number;
  description: string | null;
  transaction_date: string;
}

interface DashboardMetrics {
  dailyBilling: number;
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
  };
  activeEmployees: number;
  popularServices: { name: string; count: number }[];
  lastUpdated: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading, initialized, signOut, session } = useAuthStore();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  // Controle de abas
  const [activeTab, setActiveTab] = useState<'metrics' | 'appointments' | 'employees' | 'services' | 'clients' | 'financial'>('metrics');

  // Estados dos dados
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [financialData, setFinancialData] = useState<{
    summary: { totalIncome: number; totalExpense: number; netProfit: number };
    transactions: FinancialTransaction[];
  } | null>(null);

  // Estados de loading e erro geral
  const [tabLoading, setTabLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtros de busca
  const [filterDate, setFilterDate] = useState(new Date().toISOString().substring(0, 10));
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  // Modais de Criação/Edição
  const [showApptModal, setShowApptModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [showTimeoffModal, setShowTimeoffModal] = useState(false);

  // Estados dos Formulários
  // 1. Novo Agendamento
  const [apptForm, setApptForm] = useState({
    clientProfileId: '',
    employeeProfileId: '',
    serviceId: '',
    scheduledTime: '',
  });

  // 2. Novo Funcionário
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    commissionPercentage: 50,
    hiringDate: new Date().toISOString().substring(0, 10),
  });

  // 3. Novo/Editar Serviço
  const [serviceForm, setServiceForm] = useState<{ id?: string; name: string; description: string; price: number; durationMinutes: number }>({
    name: '',
    description: '',
    price: 30,
    durationMinutes: 30,
  });

  // 4. Novo Cliente
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    birthDate: '',
  });

  // 5. Nova Transação Financeira
  const [transactionForm, setTransactionForm] = useState({
    type: 'expense' as 'income' | 'expense',
    category: '',
    amount: 10,
    description: '',
    transactionDate: new Date().toISOString().substring(0, 10),
  });

  // 6. Escalas do Funcionário Selecionado
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [shiftsForm, setShiftsForm] = useState<
    { dayOfWeek: number; startTime: string; endTime: string; breakStartTime: string; breakEndTime: string; isWorkingDay: boolean }[]
  >([]);

  // 7. Folga de Funcionário
  const [timeoffForm, setTimeoffForm] = useState({
    employeeProfileId: '',
    type: 'day_off' as 'day_off' | 'vacation' | 'sick_leave' | 'temporary_absence',
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date().toISOString().substring(0, 10),
    reason: '',
  });

  // Redirecionamento de segurança para não-admins
  useEffect(() => {
    if (initialized && !loading && (!user || (user.role !== 'owner' && user.role !== 'manager'))) {
      router.push('/login');
    }
  }, [user, loading, initialized, router]);

  // Carregar dados da aba ativa
  useEffect(() => {
    if (user && session) {
      loadTabData();
    }
  }, [activeTab, user, session, filterDate, filterEmployeeId, clientSearch]);

  // Helper centralizado para requisições autenticadas com tratamento de expiração de token (401)
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

  const loadTabData = async () => {
    setTabLoading(true);
    setErrorMsg('');
    try {
      if (activeTab === 'metrics') {
        try {
          const res = await fetchWithAuth(`${apiUrl}/dashboard/metrics`);
          if (!res.ok) throw new Error('API returned error status');
          const data = await res.json();
          setMetrics(data);
        } catch (metricsErr) {
          console.error('Falha ao obter métricas:', metricsErr);
          setMetrics({
            dailyBilling: 0,
            appointments: { total: 0, completed: 0, cancelled: 0, pending: 0 },
            activeEmployees: 0,
            popularServices: [],
            lastUpdated: new Date().toISOString()
          });
        }
      } else if (activeTab === 'appointments') {
        // Carrega barbeiros e serviços para o formulário se ainda vazios
        if (employees.length === 0) fetchEmployees();
        if (services.length === 0) fetchServices();
        if (clients.length === 0) fetchClients();

        let url = `${apiUrl}/booking?date=${filterDate}`;
        if (filterEmployeeId) url += `&employeeId=${filterEmployeeId}`;

        const res = await fetchWithAuth(url);
        if (!res.ok) throw new Error('Falha ao carregar agendamentos.');
        const data = await res.json();
        setAppointments(data);
      } else if (activeTab === 'employees') {
        await fetchEmployees();
      } else if (activeTab === 'services') {
        await fetchServices();
      } else if (activeTab === 'clients') {
        await fetchClients();
      } else if (activeTab === 'financial') {
        const res = await fetchWithAuth(`${apiUrl}/financial`);
        if (!res.ok) throw new Error('Falha ao carregar financeiro.');
        const data = await res.json();
        setFinancialData(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao buscar dados.');
    } finally {
      setTabLoading(false);
    }
  };

  // Funções de busca auxiliares compartilhadas
  const fetchEmployees = async () => {
    const res = await fetchWithAuth(`${apiUrl}/employees`);
    if (res.ok) setEmployees(await res.json());
  };

  const fetchServices = async () => {
    const res = await fetchWithAuth(`${apiUrl}/services?all=true`);
    if (res.ok) setServices(await res.json());
  };

  const fetchClients = async () => {
    let url = `${apiUrl}/clients`;
    if (clientSearch) url += `?search=${encodeURIComponent(clientSearch)}`;
    const res = await fetchWithAuth(url);
    if (res.ok) setClients(await res.json());
  };

  // Helper para requisições de escrita
  const sendRequest = async (endpoint: string, method: string, body: any) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetchWithAuth(`${apiUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao executar ação.');
      setSuccessMsg('Operação realizada com sucesso!');
      loadTabData();
      return data;
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro.');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  // Alterar status de agendamento
  const handleUpdateApptStatus = async (apptId: string, newStatus: string) => {
    try {
      await sendRequest(`/booking/${apptId}/status`, 'PATCH', { status: newStatus });
    } catch (e) { }
  };

  // Ativar/Inativar serviço
  const handleToggleService = async (serviceId: string) => {
    try {
      await sendRequest(`/services/${serviceId}/toggle`, 'PATCH', {});
    } catch (e) { }
  };

  // Formulário - Novo Agendamento
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendRequest('/booking', 'POST', apptForm);
      setShowApptModal(false);
      setApptForm({ clientProfileId: '', employeeProfileId: '', serviceId: '', scheduledTime: '' });
    } catch (e) { }
  };

  // Formulário - Novo Barbeiro
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendRequest('/employees', 'POST', employeeForm);
      setShowEmployeeModal(false);
      setEmployeeForm({ name: '', email: '', password: '', phone: '', commissionPercentage: 50, hiringDate: new Date().toISOString().substring(0, 10) });
    } catch (e) { }
  };

  // Formulário - Novo/Editar Serviço
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (serviceForm.id) {
        await sendRequest(`/services/${serviceForm.id}`, 'PUT', {
          name: serviceForm.name,
          description: serviceForm.description || undefined,
          price: Number(serviceForm.price),
          durationMinutes: Number(serviceForm.durationMinutes),
        });
      } else {
        await sendRequest('/services', 'POST', {
          name: serviceForm.name,
          description: serviceForm.description || undefined,
          price: Number(serviceForm.price),
          durationMinutes: Number(serviceForm.durationMinutes),
        });
      }
      setShowServiceModal(false);
      setServiceForm({ name: '', description: '', price: 30, durationMinutes: 30 });
    } catch (e) { }
  };

  // Formulário - Novo Cliente
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendRequest('/clients', 'POST', {
        ...clientForm,
        birthDate: clientForm.birthDate || undefined,
      });
      setShowClientModal(false);
      setClientForm({ name: '', phone: '', whatsapp: '', birthDate: '' });
      // Atualizar lista se na aba de clientes
      if (activeTab === 'clients') fetchClients();
    } catch (e) { }
  };

  // Formulário - Lançamento Financeiro
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendRequest('/financial', 'POST', {
        ...transactionForm,
        amount: Number(transactionForm.amount),
      });
      setShowTransactionModal(false);
      setTransactionForm({ type: 'expense', category: '', amount: 10, description: '', transactionDate: new Date().toISOString().substring(0, 10) });
    } catch (e) { }
  };

  // Gerenciamento de Escala (Modal)
  const loadEmployeeShifts = async (profileId: string) => {
    try {
      const res = await fetch(`${apiUrl}/employees/${profileId}/shifts`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return null;
      const shifts = await res.json();
      return Array.isArray(shifts) && shifts.length ? shifts : null;
    } catch {
      return null;
    }
  };

  const openShiftsModal = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setTabLoading(true);
    try {
      const shiftSchedule = await loadEmployeeShifts(emp.profile_id);

      if (shiftSchedule) {
        const allDays = Array.from({ length: 7 }, (_, i) => {
          const found = shiftSchedule.find((shift: any) => shift.dayOfWeek === i);
          return found ?? {
            dayOfWeek: i,
            startTime: '09:00',
            endTime: '18:00',
            breakStartTime: '12:00',
            breakEndTime: '13:00',
            isWorkingDay: i !== 0,
          };
        });
        setShiftsForm(allDays);
      } else {
        const defaultShifts = [];
        for (let i = 0; i <= 6; i++) {
          defaultShifts.push({
            dayOfWeek: i,
            startTime: '09:00',
            endTime: '18:00',
            breakStartTime: '12:00',
            breakEndTime: '13:00',
            isWorkingDay: i !== 0,
          });
        }
        setShiftsForm(defaultShifts);
      }

      setShowShiftsModal(true);
    } catch (err) {
      setErrorMsg('Erro ao obter escalas do funcionário.');
    } finally {
      setTabLoading(false);
    }
  };

  const handleUpdateShifts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    try {
      // Formatar horários para HH:MM esperado pelo backend
      const formattedShifts = shiftsForm.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime.substring(0, 5),
        endTime: s.endTime.substring(0, 5),
        breakStartTime: s.breakStartTime ? s.breakStartTime.substring(0, 5) : undefined,
        breakEndTime: s.breakEndTime ? s.breakEndTime.substring(0, 5) : undefined,
        isWorkingDay: s.isWorkingDay
      }));

      await sendRequest(`/employees/${selectedEmployee.profile_id}/shifts`, 'PUT', formattedShifts);
      setShowShiftsModal(false);
    } catch (e) { }
  };

  // Modal Folga
  const openTimeoffModal = (emp: Employee) => {
    setTimeoffForm({
      employeeProfileId: emp.profile_id,
      type: 'day_off',
      startDate: new Date().toISOString().substring(0, 10),
      endDate: new Date().toISOString().substring(0, 10),
      reason: '',
    });
    setShowTimeoffModal(true);
  };

  const handleCreateTimeoff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Formatar datas para ISO string esperada pelo backend
      const payload = {
        employeeProfileId: timeoffForm.employeeProfileId,
        type: timeoffForm.type,
        startDate: new Date(timeoffForm.startDate + 'T00:00:00Z').toISOString(),
        endDate: new Date(timeoffForm.endDate + 'T23:59:59Z').toISOString(),
        reason: timeoffForm.reason || undefined
      };
      await sendRequest('/employees/timeoffs', 'POST', payload);
      setShowTimeoffModal(false);
    } catch (e) { }
  };

  // Formatar Dinheiro (KZ - Kwanza)
  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    const formattedNum = new Intl.NumberFormat('pt-PT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num || 0);
    return `${formattedNum} KZ`;
  };

  // Obter Label do Cargo
  const getRoleLabel = (role: string) => {
    if (role === 'owner') return 'Dono';
    if (role === 'manager') return 'Gerente';
    if (role === 'employee') return 'Barbeiro';
    return 'Cliente';
  };

  // Carregamento Inicial
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-2xl flex items-center justify-center animate-pulse">
            <Scissors className="h-6 w-6 text-black stroke-[2]" />
          </div>
          <p className="text-sm text-gray-500 tracking-wider">Verificando permissões...</p>
          <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row font-sans">
      {/* Elementos Decorativos Background */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Sidebar Lateral */}
      <aside className="w-full md:w-64 border-b md:border-r border-white/5 bg-neutral-950/80 backdrop-blur-md p-6 flex flex-col justify-between z-10 shrink-0">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/10 border border-amber-400/20">
              <Scissors className="h-5 w-5 text-black stroke-[2]" />
            </div>
            <span className="font-bold text-lg font-serif tracking-tight">
              Barber<span className="text-amber-500 font-sans">Flow</span>
            </span>
          </div>

          {/* Perfíl do Dono/Gerente */}
          <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <h4 className="font-medium text-sm truncate">{user.name}</h4>
                <p className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold">
                  {getRoleLabel(user.role)}
                </p>
              </div>
            </div>
          </div>

          {/* Menus Navegação */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'metrics'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <BarChart3 className="h-4.5 w-4.5" />
              Métricas & Dashboard
            </button>

            <button
              onClick={() => setActiveTab('appointments')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'appointments'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Calendar className="h-4.5 w-4.5" />
              Agenda / Serviços
            </button>

            <button
              onClick={() => setActiveTab('employees')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'employees'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Users className="h-4.5 w-4.5" />
              Equipe & Escalas
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'services'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <ClipboardList className="h-4.5 w-4.5" />
              Serviços Catálogo
            </button>

            <button
              onClick={() => setActiveTab('clients')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'clients'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <UserPlus className="h-4.5 w-4.5" />
              Clientes
            </button>

            <button
              onClick={() => setActiveTab('financial')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'financial'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <DollarSign className="h-4.5 w-4.5" />
              Fluxo de Caixa
            </button>
          </nav>
        </div>

        {/* Sair */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/5 transition mt-8 text-left w-full text-sm font-medium"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sair do Sistema
        </button>
      </aside>

      {/* Área de Conteúdo Principal */}
      <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full z-10 overflow-y-auto relative">
        {/* Banner de Mensagens de Status */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Check className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Header Superior */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Shield className="h-3.5 w-3.5" />
              Painel Administrativo
            </div>
            <h1 className="text-3xl font-bold font-serif capitalize">
              {activeTab === 'metrics' && 'Painel Geral'}
              {activeTab === 'appointments' && 'Agenda do Dia'}
              {activeTab === 'employees' && 'Equipe & Barbeiros'}
              {activeTab === 'services' && 'Catálogo de Serviços'}
              {activeTab === 'clients' && 'Lista de Clientes'}
              {activeTab === 'financial' && 'Finanças & Fluxo de Caixa'}
            </h1>
          </div>
          <div className="bg-neutral-900/60 backdrop-blur-sm border border-white/5 rounded-xl px-4 py-2 text-xs text-gray-400 text-right">
            <div>Tenant ID:</div>
            <div className="font-mono text-white text-[10px] mt-0.5">{user.tenantId}</div>
          </div>
        </header>

        {/* LOADING STATE DA ABA */}
        {tabLoading && (
          <div className="min-h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          </div>
        )}

        {/* CONTEÚDO DINÂMICO CONFORME ABA SELECIONADA */}
        {!tabLoading && (
          <>
            {/* ==========================================
                1. ABA METRICS / DASHBOARD
                ========================================== */}
            {activeTab === 'metrics' && metrics && (
              <div className="space-y-8 animate-fadeIn">
                {/* Metricas de Hoje */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-amber-500/5 group-hover:scale-150 transition-all duration-500" />
                    <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Faturamento (Hoje)</h3>
                    <p className="text-3xl font-bold font-serif text-white">{formatCurrency(metrics.dailyBilling)}</p>
                  </div>
                  <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Total de Agendamentos</h3>
                    <p className="text-3xl font-bold font-serif text-white">{metrics.appointments.total}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Concluídos: <span className="text-green-500">{metrics.appointments.completed}</span> | Cancelados:{' '}
                      <span className="text-red-500">{metrics.appointments.cancelled}</span>
                    </p>
                  </div>
                  <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Aguardando Atendimento</h3>
                    <p className="text-3xl font-bold font-serif text-amber-500">{metrics.appointments.pending}</p>
                    <p className="text-xs text-gray-400 mt-2">Agendados ou confirmados</p>
                  </div>
                  <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2">Barbeiros na Equipe</h3>
                    <p className="text-3xl font-bold font-serif text-white">{metrics.activeEmployees}</p>
                    <p className="text-xs text-gray-400 mt-2">Barbeiros ativos no tenant</p>
                  </div>
                </div>

                {/* Serviços Populares e Info */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Ranking de Serviços */}
                  <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 lg:col-span-2">
                    <h2 className="text-lg font-serif font-semibold mb-6 flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-amber-500" />
                      Serviços mais Prestados (Popularidade)
                    </h2>
                    {metrics.popularServices.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">Nenhum serviço finalizado ainda.</p>
                    ) : (
                      <div className="space-y-4">
                        {metrics.popularServices.map((service, index) => (
                          <div key={index} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono bg-neutral-950 px-2 py-1 rounded text-amber-500 border border-white/5">
                                #{index + 1}
                              </span>
                              <span className="text-sm font-medium">{service.name}</span>
                            </div>
                            <span className="text-sm text-gray-400 font-semibold">{service.count} atendimentos</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Info Box */}
                  <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/10 rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-amber-500 font-semibold mb-2 text-sm flex items-center gap-2">
                        <AlertCircle className="h-4.5 w-4.5" />
                        Conexão via REST & PG
                      </h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Painel administrativo operando em modo direto multi-tenant. Dados e transações são isolados e associados automaticamente ao identificador da barbearia.
                      </p>
                    </div>
                    <div className="mt-6 border-t border-white/5 pt-4 text-[10px] text-gray-500 flex justify-between">
                      <span>Última atualização:</span>
                      <span>{new Date(metrics.lastUpdated).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==========================================
                2. ABA APPOINTMENTS / AGENDA
                ========================================== */}
            {activeTab === 'appointments' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Filtros da Agenda e Botão de Novo */}
                <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                    {/* Filtro Data */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-gray-500 tracking-wider font-semibold">Data</label>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    {/* Filtro Barbeiro */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-gray-500 tracking-wider font-semibold">Filtrar Barbeiro</label>
                      <select
                        value={filterEmployeeId}
                        onChange={(e) => setFilterEmployeeId(e.target.value)}
                        className="bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="">Todos</option>
                        {employees.map((emp) => (
                          <option key={emp.profile_id} value={emp.profile_id}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (clients.length === 0) fetchClients();
                      if (employees.length === 0) fetchEmployees();
                      if (services.length === 0) fetchServices();
                      setShowApptModal(true);
                    }}
                    className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 text-sm transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                  >
                    <Plus className="h-4 w-4" />
                    Novo Agendamento
                  </button>
                </div>

                {/* Lista de Agendamentos */}
                <div className="bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-lg font-serif font-semibold">Agendamentos no Dia</h2>
                    <span className="text-xs text-gray-400">{appointments.length} encontrados</span>
                  </div>

                  {appointments.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <Calendar className="h-10 w-10 mx-auto text-gray-600 mb-3" />
                      <p className="text-sm">Nenhum agendamento para a data selecionada.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-[10px] uppercase text-gray-500 tracking-wider">
                            <th className="px-6 py-4">Horário</th>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Barbeiro</th>
                            <th className="px-6 py-4">Serviço</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                          {appointments.map((appt) => (
                            <tr key={appt.id} className="hover:bg-white/[0.01] transition">
                              <td className="px-6 py-4 font-mono font-medium">
                                {new Date(appt.scheduled_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-semibold text-white">{appt.client_name}</div>
                                <div className="text-xs text-gray-500">{appt.client_phone || 'Sem telefone'}</div>
                              </td>
                              <td className="px-6 py-4 text-gray-300">{appt.employee_name}</td>
                              <td className="px-6 py-4 text-gray-300">{appt.service_name}</td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${appt.status === 'completed' && 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    } ${appt.status === 'cancelled' && 'bg-red-500/10 text-red-400 border border-red-500/20'} ${appt.status === 'scheduled' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    } ${appt.status === 'confirmed' && 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'} ${appt.status === 'in_progress' && 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    }`}
                                >
                                  {appt.status === 'scheduled' && 'Agendado'}
                                  {appt.status === 'confirmed' && 'Confirmado'}
                                  {appt.status === 'in_progress' && 'Em Andamento'}
                                  {appt.status === 'completed' && 'Concluído'}
                                  {appt.status === 'cancelled' && 'Cancelado'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                                  <div className="flex justify-end gap-1.5">
                                    {appt.status === 'scheduled' && (
                                      <button
                                        onClick={() => handleUpdateApptStatus(appt.id, 'confirmed')}
                                        className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 text-xs px-2.5 py-1 rounded-lg transition"
                                      >
                                        Confirmar
                                      </button>
                                    )}
                                    {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                                      <button
                                        onClick={() => handleUpdateApptStatus(appt.id, 'in_progress')}
                                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs px-2.5 py-1 rounded-lg transition"
                                      >
                                        Iniciar
                                      </button>
                                    )}
                                    {appt.status === 'in_progress' && (
                                      <button
                                        onClick={() => handleUpdateApptStatus(appt.id, 'completed')}
                                        className="bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs px-2.5 py-1 rounded-lg transition"
                                      >
                                        Finalizar
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleUpdateApptStatus(appt.id, 'cancelled')}
                                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-2.5 py-1 rounded-lg transition"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==========================================
                3. ABA EMPLOYEES / EQUIPE
                ========================================== */}
            {activeTab === 'employees' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center bg-neutral-900/40 border border-white/5 rounded-2xl p-6">
                  <h2 className="text-lg font-serif font-semibold">Nossa Equipe de Barbeiros</h2>
                  <button
                    onClick={() => setShowEmployeeModal(true)}
                    className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 text-sm transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                  >
                    <Plus className="h-4 w-4" />
                    Novo Barbeiro
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {employees.map((emp) => (
                    <div key={emp.profile_id} className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 relative flex flex-col justify-between gap-6 group hover:border-amber-500/20 transition-all duration-300">
                      <div>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold text-lg">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-serif font-semibold text-lg text-white">{emp.name}</h3>
                            <p className="text-xs text-gray-500">{emp.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6 text-xs border-t border-white/5 pt-4 text-gray-400">
                          <div>
                            <span className="block text-[10px] uppercase text-gray-600">Comissão</span>
                            <strong className="text-sm text-white font-medium">{emp.commission_percentage}%</strong>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase text-gray-600">Contratação</span>
                            <strong className="text-sm text-white font-medium">
                              {new Date(emp.hiring_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </strong>
                          </div>
                          <div className="col-span-2">
                            <span className="block text-[10px] uppercase text-gray-600">Telefone</span>
                            <strong className="text-sm text-white font-medium">{emp.phone || 'Não informado'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Ações da Equipe */}
                      <div className="flex gap-3 border-t border-white/5 pt-4">
                        <button
                          onClick={() => openShiftsModal(emp)}
                          className="flex-1 bg-neutral-950 border border-white/10 hover:border-amber-500/30 text-gray-300 hover:text-white rounded-xl py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Escalas
                        </button>
                        <button
                          onClick={() => openTimeoffModal(emp)}
                          className="flex-1 bg-neutral-950 border border-white/10 hover:border-amber-500/30 text-gray-300 hover:text-white rounded-xl py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                          Lançar Folga
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==========================================
                4. ABA SERVICES / SERVIÇOS
                ========================================== */}
            {activeTab === 'services' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center bg-neutral-900/40 border border-white/5 rounded-2xl p-6">
                  <h2 className="text-lg font-serif font-semibold">Catálogo de Serviços</h2>
                  <button
                    onClick={() => {
                      setServiceForm({ name: '', description: '', price: 30, durationMinutes: 30 });
                      setShowServiceModal(true);
                    }}
                    className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 text-sm transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                  >
                    <Plus className="h-4 w-4" />
                    Novo Serviço
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {services.map((svc) => (
                    <div
                      key={svc.id}
                      className={`bg-neutral-900/40 border rounded-2xl p-6 flex flex-col justify-between gap-6 transition ${svc.is_active ? 'border-white/5' : 'border-red-500/10 opacity-60'
                        }`}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-4">
                          <h3 className="font-serif font-semibold text-lg text-white">{svc.name}</h3>
                          <span className="font-mono text-amber-500 font-bold">{formatCurrency(svc.price)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{svc.description || 'Sem descrição'}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-4">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          <span>Duração: {svc.duration_minutes} min</span>
                        </div>
                      </div>

                      {/* Controle Serviço */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
                        <button
                          onClick={() => {
                            setServiceForm({
                              id: svc.id,
                              name: svc.name,
                              description: svc.description || '',
                              price: svc.price,
                              durationMinutes: svc.duration_minutes,
                            });
                            setShowServiceModal(true);
                          }}
                          className="text-gray-400 hover:text-white transition flex items-center gap-1 text-xs"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Editar
                        </button>

                        <button
                          onClick={() => handleToggleService(svc.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${svc.is_active
                            ? 'bg-red-500/5 hover:bg-red-500/10 border-red-500/10 text-red-400'
                            : 'bg-green-500/5 hover:bg-green-500/10 border-green-500/10 text-green-400'
                            }`}
                        >
                          {svc.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==========================================
                5. ABA CLIENTS / CLIENTES
                ========================================== */}
            {activeTab === 'clients' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  {/* Busca */}
                  <div className="w-full sm:w-80">
                    <input
                      type="text"
                      placeholder="Pesquisar cliente por nome..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <button
                    onClick={() => setShowClientModal(true)}
                    className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 text-sm transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                  >
                    <Plus className="h-4 w-4" />
                    Novo Cliente
                  </button>
                </div>

                {/* Tabela de Clientes */}
                <div className="bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-4">Nome</th>
                        <th className="px-6 py-4">Telefone / WhatsApp</th>
                        <th className="px-6 py-4">Data Nasc.</th>
                        <th className="px-6 py-4 text-center">Visitas</th>
                        <th className="px-6 py-4 text-right">Total Consumido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {clients.map((cli) => (
                        <tr key={cli.id} className="hover:bg-white/[0.01] transition">
                          <td className="px-6 py-4 font-semibold text-white">{cli.name}</td>
                          <td className="px-6 py-4 text-gray-300">
                            {cli.phone || cli.whatsapp || <span className="text-gray-600">Não informado</span>}
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            {cli.birth_date ? new Date(cli.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="px-6 py-4 text-center font-semibold text-white">{cli.visits_count}</td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-amber-500">
                            {formatCurrency(cli.total_spent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ==========================================
                6. ABA FINANCIAL / FINANCEIRO
                ========================================== */}
            {activeTab === 'financial' && financialData && (
              <div className="space-y-6 animate-fadeIn">
                {/* Resumo Caixa */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Receitas</span>
                      <strong className="text-2xl font-bold font-serif text-green-400">
                        {formatCurrency(financialData.summary.totalIncome)}
                      </strong>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Despesas / Saídas</span>
                      <strong className="text-2xl font-bold font-serif text-red-400">
                        {formatCurrency(financialData.summary.totalExpense)}
                      </strong>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                      <ArrowDownRight className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Lucro Líquido</span>
                      <strong
                        className={`text-2xl font-bold font-serif ${financialData.summary.netProfit >= 0 ? 'text-amber-500' : 'text-red-500'
                          }`}
                      >
                        {formatCurrency(financialData.summary.netProfit)}
                      </strong>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <DollarSign className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-neutral-900/40 border border-white/5 rounded-2xl p-6">
                  <h2 className="text-lg font-serif font-semibold">Extrato de Fluxo de Caixa</h2>
                  <button
                    onClick={() => setShowTransactionModal(true)}
                    className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold rounded-xl px-4 py-2.5 text-sm transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                  >
                    <Plus className="h-4 w-4" />
                    Lançar Transação
                  </button>
                </div>

                {/* Tabela Financeira */}
                <div className="bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Categoria</th>
                        <th className="px-6 py-4">Descrição</th>
                        <th className="px-6 py-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {financialData.transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-white/[0.01] transition">
                          <td className="px-6 py-4 text-gray-400 font-mono">
                            {new Date(t.transaction_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${t.type === 'income' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                }`}
                            >
                              {t.type === 'income' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-300 font-medium capitalize">{t.category}</td>
                          <td className="px-6 py-4 text-gray-400 max-w-xs truncate">{t.description || '-'}</td>
                          <td className={`px-6 py-4 text-right font-mono font-bold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ========================================================
            MODAIS DE DIÁLOGO (FORMS)
            ======================================================== */}

        {/* 1. Modal Novo Agendamento */}
        {showApptModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-md animate-scaleUp">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-semibold">Novo Agendamento</h3>
                <button onClick={() => setShowApptModal(false)} className="text-gray-500 hover:text-white transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateAppointment} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Cliente</label>
                  <select
                    required
                    value={apptForm.clientProfileId}
                    onChange={(e) => setApptForm({ ...apptForm, clientProfileId: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Selecione o Cliente</option>
                    {clients.map((cli) => (
                      <option key={cli.id} value={cli.id}>
                        {cli.name} ({cli.phone || 'Sem telefone'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Barbeiro</label>
                  <select
                    required
                    value={apptForm.employeeProfileId}
                    onChange={(e) => setApptForm({ ...apptForm, employeeProfileId: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Selecione o Barbeiro</option>
                    {employees.map((emp) => (
                      <option key={emp.profile_id} value={emp.profile_id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Serviço</label>
                  <select
                    required
                    value={apptForm.serviceId}
                    onChange={(e) => setApptForm({ ...apptForm, serviceId: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Selecione o Serviço</option>
                    {services
                      .filter((s) => s.is_active)
                      .map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.name} - {formatCurrency(svc.price)} ({svc.duration_minutes} min)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Data e Horário</label>
                  <input
                    type="datetime-local"
                    required
                    value={apptForm.scheduledTime}
                    onChange={(e) => setApptForm({ ...apptForm, scheduledTime: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reservar Horário'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 2. Modal Novo Barbeiro */}
        {showEmployeeModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-md animate-scaleUp">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-semibold">Novo Barbeiro</h3>
                <button onClick={() => setShowEmployeeModal(false)} className="text-gray-500 hover:text-white transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome do Barbeiro"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">E-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="email@barbearia.com"
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Senha Provisória</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={employeeForm.password}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Telefone</label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Comissão (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={employeeForm.commissionPercentage}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, commissionPercentage: Number(e.target.value) })}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Data Contratação</label>
                    <input
                      type="date"
                      required
                      value={employeeForm.hiringDate}
                      onChange={(e) => setEmployeeForm({ ...employeeForm, hiringDate: e.target.value })}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar Barbeiro'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 3. Modal Novo/Editar Serviço */}
        {showServiceModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-md animate-scaleUp">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-semibold">{serviceForm.id ? 'Editar Serviço' : 'Novo Serviço'}</h3>
                <button onClick={() => setShowServiceModal(false)} className="text-gray-500 hover:text-white transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSaveService} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Nome do Serviço</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Corte Degradê"
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Descrição</label>
                  <textarea
                    placeholder="Explique detalhes do serviço..."
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50 h-20 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Preço (AOA)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Duração (Minutos)</label>
                    <select
                      value={serviceForm.durationMinutes}
                      onChange={(e) => setServiceForm({ ...serviceForm, durationMinutes: Number(e.target.value) })}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                    >
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Serviço'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 4. Modal Novo Cliente */}
        {showClientModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-md animate-scaleUp">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-semibold">Cadastrar Novo Cliente</h3>
                <button onClick={() => setShowClientModal(false)} className="text-gray-500 hover:text-white transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Nome do Cliente</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Telefone</label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={clientForm.whatsapp}
                    onChange={(e) => setClientForm({ ...clientForm, whatsapp: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Data de Nascimento (Opcional)</label>
                  <input
                    type="date"
                    value={clientForm.birthDate}
                    onChange={(e) => setClientForm({ ...clientForm, birthDate: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar Cliente'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 5. Modal Lançamento Financeiro */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-md animate-scaleUp">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-semibold">Registrar Movimentação</h3>
                <button onClick={() => setShowTransactionModal(false)} className="text-gray-500 hover:text-white transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Tipo de Transação</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setTransactionForm({ ...transactionForm, type: 'income' })}
                      className={`py-3 rounded-xl border text-sm font-medium transition ${transactionForm.type === 'income'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-neutral-950 border-white/5 text-gray-400'
                        }`}
                    >
                      Receita (Entrada)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransactionForm({ ...transactionForm, type: 'expense' })}
                      className={`py-3 rounded-xl border text-sm font-medium transition ${transactionForm.type === 'expense'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-neutral-950 border-white/5 text-gray-400'
                        }`}
                    >
                      Despesa (Saída)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Categoria</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Aluguel, Insumos, Comissão, Marketing"
                    value={transactionForm.category}
                    onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Valor (AOA)</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={transactionForm.amount}
                      onChange={(e) => setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Data</label>
                    <input
                      type="date"
                      required
                      value={transactionForm.transactionDate}
                      onChange={(e) => setTransactionForm({ ...transactionForm, transactionDate: e.target.value })}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Descrição (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Descreva detalhes adicionais..."
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lançar Transação'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 6. Modal Editar Escala */}
        {showShiftsModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-scaleUp">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-serif font-semibold">Configurar Escala de Trabalho</h3>
                  <p className="text-xs text-gray-500 mt-1">Defina o expediente semanal para {selectedEmployee.name}</p>
                </div>
                <button onClick={() => setShowShiftsModal(false)} className="text-gray-500 hover:text-white transition font-bold">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateShifts} className="space-y-4">
                <div className="divide-y divide-white/5">
                  {shiftsForm.map((shift, idx) => {
                    const daysMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                    return (
                      <div key={shift.dayOfWeek} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-40 shrink-0">
                          <input
                            type="checkbox"
                            checked={shift.isWorkingDay}
                            onChange={(e) => {
                              const updated = [...shiftsForm];
                              updated[idx].isWorkingDay = e.target.checked;
                              setShiftsForm(updated);
                            }}
                            className="rounded bg-neutral-950 border-white/10 text-amber-500 focus:ring-0"
                          />
                          <span className="text-sm font-medium">{daysMap[shift.dayOfWeek]}</span>
                        </div>

                        {shift.isWorkingDay ? (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <div>
                              <span>Entrada: </span>
                              <input
                                type="time"
                                value={shift.startTime}
                                onChange={(e) => {
                                  const updated = [...shiftsForm];
                                  updated[idx].startTime = e.target.value;
                                  setShiftsForm(updated);
                                }}
                                className="bg-neutral-950 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <span>Saída: </span>
                              <input
                                type="time"
                                value={shift.endTime}
                                onChange={(e) => {
                                  const updated = [...shiftsForm];
                                  updated[idx].endTime = e.target.value;
                                  setShiftsForm(updated);
                                }}
                                className="bg-neutral-950 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <span>Almoço: </span>
                              <input
                                type="time"
                                value={shift.breakStartTime}
                                onChange={(e) => {
                                  const updated = [...shiftsForm];
                                  updated[idx].breakStartTime = e.target.value;
                                  setShiftsForm(updated);
                                }}
                                className="bg-neutral-950 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                              />
                              <span className="mx-1">até</span>
                              <input
                                type="time"
                                value={shift.breakEndTime}
                                onChange={(e) => {
                                  const updated = [...shiftsForm];
                                  updated[idx].breakEndTime = e.target.value;
                                  setShiftsForm(updated);
                                }}
                                className="bg-neutral-950 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-red-500 font-semibold uppercase italic tracking-wider py-1.5">Dia de Folga</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="pt-4 border-t border-white/5 flex gap-4">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Escala Semanal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowShiftsModal(false)}
                    className="flex-1 bg-neutral-950 border border-white/10 hover:bg-white/5 text-gray-300 py-3 rounded-xl transition text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 7. Modal Lançar Folga/Licença */}
        {showTimeoffModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 w-full max-w-md animate-scaleUp">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-semibold">Lançar Folga ou Licença</h3>
                <button onClick={() => setShowTimeoffModal(false)} className="text-gray-500 hover:text-white transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateTimeoff} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Tipo de Afastamento</label>
                  <select
                    value={timeoffForm.type}
                    onChange={(e) => setTimeoffForm({ ...timeoffForm, type: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="day_off">Folga Avulsa</option>
                    <option value="vacation">Férias</option>
                    <option value="sick_leave">Licença Médica</option>
                    <option value="temporary_absence">Ausência Temporária</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Início</label>
                    <input
                      type="date"
                      required
                      value={timeoffForm.startDate}
                      onChange={(e) => setTimeoffForm({ ...timeoffForm, startDate: e.target.value })}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Término</label>
                    <input
                      type="date"
                      required
                      value={timeoffForm.endDate}
                      onChange={(e) => setTimeoffForm({ ...timeoffForm, endDate: e.target.value })}
                      className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Motivo / Observação</label>
                  <input
                    type="text"
                    placeholder="Ex: Consulta médica, recesso de final de ano"
                    value={timeoffForm.reason}
                    onChange={(e) => setTimeoffForm({ ...timeoffForm, reason: e.target.value })}
                    className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lançar e Aprovar Folga'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

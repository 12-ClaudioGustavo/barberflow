'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Scissors, LogOut, Shield, BarChart3, Clock, Check, X, Menu,
  AlertCircle, Loader2, Building, Eye, Ban, ChevronDown
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'rejected' | 'suspended';
  owner_email: string | null;
  owner_name: string | null;
  notes: string | null;
  rejected_reason: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PlatformStats {
  total: number;
  active: number;
  pending: number;
  rejected: number;
  suspended: number;
  newLast30Days: number;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, loading, initialized, signOut, session } = useAuthStore();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'stats'>('pending');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal de rejeição
  const [rejectModal, setRejectModal] = useState<{ open: boolean; tenant: Tenant | null }>({ open: false, tenant: null });
  const [rejectReason, setRejectReason] = useState('');

  // Segurança: redirecionar se não for super_admin
  useEffect(() => {
    if (initialized && !loading && (!user || user.role !== 'super_admin')) {
      router.push('/login');
    }
  }, [user, loading, initialized, router]);

  useEffect(() => {
    if (user && session) loadTabData();
  }, [activeTab, user, session, filterStatus]);

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = session?.access_token;
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      await signOut();
      router.push('/login');
      throw new Error('Sessão expirada.');
    }
    return res;
  };

  const loadTabData = async () => {
    setTabLoading(true);
    setErrorMsg('');
    try {
      if (activeTab === 'pending') {
        const res = await fetchWithAuth(`${apiUrl}/super-admin/tenants?status=pending`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao carregar pendentes');
        }
        setTenants(await res.json());
      } else if (activeTab === 'all') {
        let url = `${apiUrl}/super-admin/tenants`;
        if (filterStatus) url += `?status=${filterStatus}`;
        const res = await fetchWithAuth(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao carregar barbearias');
        }
        setTenants(await res.json());
      } else if (activeTab === 'stats') {
        const res = await fetchWithAuth(`${apiUrl}/super-admin/stats`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao carregar estatísticas');
        }
        setStats(await res.json());
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setTabLoading(false);
    }
  };

  const handleApprove = async (tenant: Tenant) => {
    setActionLoading(tenant.id);
    setErrorMsg('');
    try {
      const res = await fetchWithAuth(`${apiUrl}/super-admin/tenants/${tenant.id}/approve`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessMsg(`"${tenant.name}" aprovada! Email do dono: ${tenant.owner_email}`);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.tenant) return;
    setActionLoading(rejectModal.tenant.id);
    setErrorMsg('');
    try {
      const res = await fetchWithAuth(`${apiUrl}/super-admin/tenants/${rejectModal.tenant.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.errors?.[0]?.message);
      setSuccessMsg(`"${rejectModal.tenant.name}" rejeitada.`);
      setRejectModal({ open: false, tenant: null });
      setRejectReason('');
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (tenant: Tenant) => {
    if (!confirm(`Deseja suspender "${tenant.name}"?`)) return;
    setActionLoading(tenant.id);
    try {
      const res = await fetchWithAuth(`${apiUrl}/super-admin/tenants/${tenant.id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Suspensão manual pelo super admin' }),
      });
      if (!res.ok) throw new Error('Erro ao suspender');
      setSuccessMsg(`"${tenant.name}" suspensa.`);
      loadTabData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400', label: 'Pendente' },
      active: { bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400', label: 'Ativa' },
      rejected: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', label: 'Rejeitada' },
      suspended: { bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-400', label: 'Suspensa' },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider border ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-2xl flex items-center justify-center animate-pulse">
            <Scissors className="h-6 w-6 text-black stroke-[2]" />
          </div>
          <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
        </div>
      </div>
    );
  }

  const handleTabChange = (tab: 'pending' | 'all' | 'stats') => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row font-sans relative">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Header Superior Mobile */}
      <div className="flex md:hidden items-center justify-between p-4 bg-neutral-950/90 backdrop-blur-md border-b border-white/5 z-20 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-lg flex items-center justify-center">
            <Scissors className="h-4.5 w-4.5 text-black stroke-[2]" />
          </div>
          <span className="font-bold text-md tracking-tight">
            Barber<span className="text-amber-500">Flow</span>
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white focus:outline-none"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Overlay para fechar menu no mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 border-r border-white/5 bg-neutral-950/95 p-6 flex flex-col justify-between transition-transform duration-300 transform
        md:relative md:translate-x-0 md:bg-neutral-950/80 md:backdrop-blur-md md:z-10 md:shrink-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="space-y-8">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/10 border border-amber-400/20">
              <Scissors className="h-5 w-5 text-black stroke-[2]" />
            </div>
            <span className="font-bold text-lg font-serif tracking-tight">
              Barber<span className="text-amber-500 font-sans">Flow</span>
            </span>
          </div>

          <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold text-sm">
                <Shield className="h-5 w-5" />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-medium text-sm truncate">{user.name}</h4>
                <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Super Admin</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            <button onClick={() => handleTabChange('pending')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'pending' ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Clock className="h-4 w-4" /> Pendentes
            </button>
            <button onClick={() => handleTabChange('all')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'all' ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Building className="h-4 w-4" /> Todas Barbearias
            </button>
            <button onClick={() => handleTabChange('stats')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition w-full text-left ${activeTab === 'stats' ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black shadow-lg shadow-amber-500/15' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <BarChart3 className="h-4 w-4" /> Estatísticas
            </button>
          </nav>
        </div>

        <div className="space-y-4">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/5 transition text-left w-full text-sm font-medium">
            <LogOut className="h-4 w-4" /> Sair do Sistema
          </button>
          
          <div className="pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-gray-600 font-semibold tracking-wide">BarberFlow SaaS</p>
            <p className="text-[9px] text-gray-500 mt-0.5">Desenvolvido por Claudio Gustavo</p>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full z-10 overflow-y-auto relative">
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
            <button onClick={() => setErrorMsg('')} className="ml-auto text-red-400 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Check className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{successMsg}</p>
            <button onClick={() => setSuccessMsg('')} className="ml-auto text-green-400 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        )}

        <header className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Shield className="h-3.5 w-3.5" /> Super Administrador
            </div>
            <h1 className="text-3xl font-bold font-serif">
              {activeTab === 'pending' && 'Cadastros Pendentes'}
              {activeTab === 'all' && 'Todas as Barbearias'}
              {activeTab === 'stats' && 'Estatísticas da Plataforma'}
            </h1>
          </div>
        </header>

        {tabLoading && (
          <div className="min-h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          </div>
        )}

        {!tabLoading && (
          <>
            {/* ABA PENDENTES */}
            {activeTab === 'pending' && (
              <div className="space-y-4">
                {tenants.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-700" />
                    <p className="text-lg font-medium">Nenhum cadastro pendente</p>
                    <p className="text-sm mt-1">Todas as solicitações foram processadas.</p>
                  </div>
                ) : (
                  tenants.map((t) => (
                    <div key={t.id} className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 hover:border-amber-500/10 transition">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{t.name}</h3>
                            {statusBadge(t.status)}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-400">
                            <p>🔗 <span className="text-amber-500 font-mono text-xs">{t.slug}</span></p>
                            <p>📧 {t.owner_email || '—'}</p>
                            <p>👤 {t.owner_name || '—'}</p>
                          </div>
                          <p className="text-xs text-gray-600 mt-2">Cadastrado em {formatDate(t.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApprove(t)}
                            disabled={actionLoading === t.id}
                            className="flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 hover:text-green-300 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
                          >
                            {actionLoading === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Aprovar
                          </button>
                          <button
                            onClick={() => { setRejectModal({ open: true, tenant: t }); setRejectReason(''); }}
                            disabled={actionLoading === t.id}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
                          >
                            <X className="h-4 w-4" /> Rejeitar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ABA TODAS BARBEARIAS */}
            {activeTab === 'all' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Filtrar por status:</label>
                  <div className="relative">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-neutral-900 border border-white/10 rounded-xl py-2 pl-3 pr-8 text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                    >
                      <option value="">Todos</option>
                      <option value="pending">Pendente</option>
                      <option value="active">Ativa</option>
                      <option value="rejected">Rejeitada</option>
                      <option value="suspended">Suspensa</option>
                    </select>
                    <ChevronDown className="h-4 w-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <span className="text-xs text-gray-600 ml-auto">{tenants.length} resultado(s)</span>
                </div>

                {tenants.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Building className="h-12 w-12 mx-auto mb-4 text-gray-700" />
                    <p>Nenhuma barbearia encontrada.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                          <th className="pb-3 px-4">Barbearia</th>
                          <th className="pb-3 px-4">Dono</th>
                          <th className="pb-3 px-4">Status</th>
                          <th className="pb-3 px-4">Criado em</th>
                          <th className="pb-3 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenants.map((t) => (
                          <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                            <td className="py-4 px-4">
                              <p className="font-medium">{t.name}</p>
                              <p className="text-xs text-amber-500 font-mono">{t.slug}</p>
                            </td>
                            <td className="py-4 px-4 text-gray-400">
                              <p>{t.owner_name || '—'}</p>
                              <p className="text-xs">{t.owner_email || '—'}</p>
                            </td>
                            <td className="py-4 px-4">{statusBadge(t.status)}</td>
                            <td className="py-4 px-4 text-gray-500 text-xs">{formatDate(t.created_at)}</td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {t.status === 'pending' && (
                                  <>
                                    <button onClick={() => handleApprove(t)} disabled={actionLoading === t.id}
                                      className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition disabled:opacity-50" title="Aprovar">
                                      <Check className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => { setRejectModal({ open: true, tenant: t }); setRejectReason(''); }}
                                      className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition" title="Rejeitar">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                                {t.status === 'active' && (
                                  <button onClick={() => handleSuspend(t)} disabled={actionLoading === t.id}
                                    className="p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition disabled:opacity-50" title="Suspender">
                                    <Ban className="h-4 w-4" />
                                  </button>
                                )}
                                {t.status === 'rejected' && t.rejected_reason && (
                                  <span className="text-xs text-red-400 italic max-w-[150px] truncate" title={t.rejected_reason}>
                                    {t.rejected_reason}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ABA ESTATÍSTICAS */}
            {activeTab === 'stats' && stats && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { label: 'Total de Barbearias', value: stats.total, color: 'text-white' },
                    { label: 'Ativas', value: stats.active, color: 'text-green-400' },
                    { label: 'Pendentes', value: stats.pending, color: 'text-yellow-400' },
                    { label: 'Rejeitadas', value: stats.rejected, color: 'text-red-400' },
                    { label: 'Suspensas', value: stats.suspended, color: 'text-orange-400' },
                    { label: 'Novos (30 dias)', value: stats.newLast30Days, color: 'text-amber-400' },
                  ].map((card, i) => (
                    <div key={i} className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-amber-500/5 group-hover:scale-150 transition-all duration-500" />
                      <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2">{card.label}</h3>
                      <p className={`text-4xl font-bold font-serif ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL DE REJEIÇÃO */}
      {rejectModal.open && rejectModal.tenant && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Rejeitar Barbearia</h3>
            <p className="text-sm text-gray-400 mb-6">
              Rejeitar <strong className="text-white">&quot;{rejectModal.tenant.name}&quot;</strong>? Informe o motivo abaixo.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição (mín. 5 caracteres)..."
              rows={4}
              className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition resize-none mb-6"
            />
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setRejectModal({ open: false, tenant: null })}
                className="px-5 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={rejectReason.length < 5 || actionLoading === rejectModal.tenant.id}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-50"
              >
                {actionLoading === rejectModal.tenant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Scissors, User, Building, Lock, Mail, Phone, ArrowRight, Loader2, CheckCircle2, Clock } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function SignupPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  const [role, setRole] = useState<'client' | 'owner'>('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  // Dono da Barbearia
  const [barbershopName, setBarbershopName] = useState('');
  const [slug, setSlug] = useState('');
  
  // Cliente
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  // Redireciona se o usuário já estiver logado
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'owner' || user.role === 'manager') {
        router.push('/dashboard/admin');
      } else {
        router.push('/booking');
      }
    }
  }, [user, loading, router]);

  // Carregar barbearias disponíveis para o cadastro de clientes
  useEffect(() => {
    if (role === 'client') {
      setTenantsLoading(true);
      fetch(`${apiUrl}/auth/tenants`)
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          setTenants(data);
          if (data.length > 0) {
            setTenantId(data[0].id);
          }
        })
        .catch(() => {
          console.error('Erro ao buscar barbearias.');
        })
        .finally(() => {
          setTenantsLoading(false);
        });
    }
  }, [role, apiUrl]);

  // Gerador automático de Slug a partir do nome da barbearia
  const handleBarbershopNameChange = (nameVal: string) => {
    setBarbershopName(nameVal);
    const generatedSlug = nameVal
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Substitui espaços por hífen
      .replace(/-+/g, '-'); // Remove hífens duplicados
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setFormLoading(true);

    try {
      const payload: any = {
        role,
        name,
        email,
        password,
        phone: phone || undefined,
      };

      if (role === 'owner') {
        payload.barbershopName = barbershopName;
        payload.slug = slug;
      } else {
        payload.tenantId = tenantId;
      }

      const response = await fetch(`${apiUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao registrar conta');
      }

      // Dono de barbearia: cadastro vai para fila de aprovação
      if (role === 'owner') {
        setPendingApproval(true);
        return;
      }

      setSuccess(true);

      // Fazer login automático apenas para clientes
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginErr) {
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setTimeout(() => {
          router.push('/booking');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao criar sua conta.');
      setFormLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden py-12 px-4">
      {/* Elementos de background decorativos */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg z-10">
        {/* Logo / Título */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-12 h-12 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3 border border-amber-400/20">
            <Scissors className="h-6 w-6 text-black stroke-[2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-serif">
            Barber<span className="text-amber-500">Flow</span>
          </h1>
        </div>

        {/* Card de Cadastro */}
        <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
          {pendingApproval ? (
            <div className="text-center py-10 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <Clock className="h-10 w-10 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Cadastro Recebido!</h2>
              <p className="text-gray-400 text-sm max-w-xs leading-relaxed mb-6">
                Seu cadastro foi enviado e está <span className="text-amber-400 font-semibold">aguardando aprovação</span> do administrador da plataforma.
              </p>
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 text-left w-full mb-6">
                <p className="text-xs text-gray-400 leading-relaxed">
                  📋 <strong className="text-white">Próximos passos:</strong><br />
                  1. Nosso time irá analisar seu cadastro<br />
                  2. Você receberá um contato sobre o pagamento<br />
                  3. Após confirmação, sua barbearia estará ativa!
                </p>
              </div>
              <Link
                href="/"
                className="text-amber-500 hover:text-amber-400 text-sm font-semibold transition"
              >
                ← Voltar à página inicial
              </Link>
            </div>
          ) : success ? (
            <div className="text-center py-10 flex flex-col items-center">
              <CheckCircle2 className="h-16 w-16 text-amber-500 animate-bounce mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Conta Criada!</h2>
              <p className="text-gray-400 text-sm max-w-xs">
                Seu perfil foi configurado. Redirecionando você para o sistema...
              </p>
              <Loader2 className="h-6 w-6 text-amber-500 animate-spin mt-6" />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-2 text-center">Crie sua conta</h2>
              <p className="text-xs text-gray-400 text-center mb-6">Escolha o seu perfil para começar</p>

              {/* Seletor de Perfil (Role Selector Tabs) */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => setRole('client')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition ${
                    role === 'client'
                      ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/10'
                      : 'bg-neutral-950 border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                  }`}
                >
                  <User className="h-4 w-4" />
                  Sou Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setRole('owner')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition ${
                    role === 'owner'
                      ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/10'
                      : 'bg-neutral-950 border-white/5 text-gray-400 hover:border-white/10 hover:text-white'
                  }`}
                >
                  <Building className="h-4 w-4" />
                  Tenho Barbearia
                </button>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 mb-6">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* DADOS COMUNS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                    />
                  </div>
                  {/* Telefone */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      Celular / WhatsApp
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    E-mail
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="exemplo@gmail.com"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Senha (mín. 6 caracteres)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                    />
                  </div>
                </div>

                {/* FORMULÁRIO DO DONO */}
                {role === 'owner' && (
                  <div className="space-y-4 pt-2 border-t border-white/5">
                    <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Dados da Barbearia</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nome da Barbearia */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                          Nome da Empresa
                        </label>
                        <input
                          type="text"
                          required={role === 'owner'}
                          value={barbershopName}
                          onChange={(e) => handleBarbershopNameChange(e.target.value)}
                          placeholder="Ex: Barbearia Imperial"
                          className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                        />
                      </div>
                      {/* Slug do Subdomínio */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                          Link do Site (Slug)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required={role === 'owner'}
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                            placeholder="ex-barbearia-imperial"
                            className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 px-4 text-sm text-amber-500 font-mono placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FORMULÁRIO DO CLIENTE */}
                {role === 'client' && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Escolha a Barbearia
                    </label>
                    {tenantsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500 py-3">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                        Carregando barbearias parceiras...
                      </div>
                    ) : tenants.length === 0 ? (
                      <div className="text-xs text-amber-500 py-3">
                        Nenhuma barbearia parceira cadastrada no momento.
                      </div>
                    ) : (
                      <select
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        className="w-full bg-neutral-950 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                      >
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id} className="bg-neutral-900 text-white">
                            {t.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Botão Registrar */}
                <button
                  type="submit"
                  disabled={formLoading || (role === 'client' && tenants.length === 0 && !tenantsLoading)}
                  className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold rounded-xl py-3 text-sm transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {formLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Cadastrar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Login Link */}
              <div className="mt-8 text-center border-t border-white/5 pt-6">
                <p className="text-xs text-gray-500">
                  Já tem uma conta?{' '}
                  <Link href="/login" className="text-amber-500 hover:text-amber-400 font-semibold transition">
                    Entrar na conta
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

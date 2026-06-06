'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Scissors, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Redireciona se o usuário já estiver autenticado
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'super_admin') {
        router.push('/dashboard/super-admin');
      } else if (user.role === 'owner' || user.role === 'manager') {
        router.push('/dashboard/admin');
      } else if (user.role === 'employee') {
        router.push('/dashboard/employee');
      } else {
        router.push('/booking');
      }
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setFormLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Redireciona de acordo com o papel salvo nos metadados
      const role = data.user?.user_metadata?.role;
      if (role === 'super_admin') {
        router.push('/dashboard/super-admin');
      } else if (role === 'owner' || role === 'manager') {
        router.push('/dashboard/admin');
      } else if (role === 'employee') {
        router.push('/dashboard/employee');
      } else {
        router.push('/booking');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'E-mail ou senha incorretos.');
      setFormLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Elemento de background decorativo */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Logo / Título */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3 border border-amber-400/20">
            <Scissors className="h-7 w-7 text-black stroke-[2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-serif">
            Barber<span className="text-amber-500">Flow</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Sua barbearia preferida, em alto nível</p>
        </div>

        {/* Card do Formulário */}
        <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">Acesse sua conta</h2>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 mb-6">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo E-mail */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@gmail.com"
                  className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Senha
                </label>
                <a href="#" className="text-xs text-amber-500 hover:text-amber-400 transition">
                  Esqueceu a senha?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-950/80 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition"
                />
              </div>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold rounded-xl py-3 text-sm transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 disabled:pointer-events-none"
            >
              {formLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Cadastro Link */}
          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <p className="text-xs text-gray-500">
              Não tem uma conta?{' '}
              <Link href="/signup" className="text-amber-500 hover:text-amber-400 font-semibold transition">
                Cadastre-se grátis
              </Link>
            </p>
          </div>
        </div>

        {/* Rodapé de Autoria */}
        <p className="text-center text-[10px] text-gray-600 mt-6">
          BarberFlow SaaS &copy; {new Date().getFullYear()} - Criado por Claudio Gustavo
        </p>
      </div>
    </main>
  );
}

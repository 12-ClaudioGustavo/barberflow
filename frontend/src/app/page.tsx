import React from 'react';
import Link from 'next/link';
import { Calendar, Users, TrendingUp, Shield, Clock, Bell, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-amber-500 selection:text-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-neutral-950/80 border-b border-neutral-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="font-extrabold text-neutral-950 text-xl tracking-tighter">B</span>
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              Barber<span className="text-amber-500">Flow</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <a href="#funcionalidades" className="hover:text-amber-500 transition-colors">Funcionalidades</a>
            <a href="#motor" className="hover:text-amber-500 transition-colors">Agendamento Inteligente</a>
            <a href="#precos" className="hover:text-amber-500 transition-colors">Preços</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-amber-500 transition-colors">
              Entrar
            </Link>
            <Link href="/signup" className="bg-amber-500 hover:bg-amber-600 text-neutral-950 text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25">
              Começar Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 flex-1 flex flex-col justify-center">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-semibold text-amber-500 mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            SaaS Multi-Tenant de Barbearia Premium
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-gradient-to-b from-neutral-50 to-neutral-300 bg-clip-text text-transparent leading-[1.1]">
            A evolução na gestão da sua barbearia.
          </h1>
          
          <p className="text-lg md:text-xl text-neutral-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Controle total de escalas, faturamento, comissões de barbeiros e uma agenda inteligente com disponibilidade em tempo real protegida contra conflitos de horários.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold px-8 py-4 rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 text-center">
              Criar minha barbearia (SaaS)
            </Link>
            <Link href="/login" className="w-full sm:w-auto bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-semibold px-8 py-4 rounded-xl transition-all text-center">
              Ver demonstração
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="funcionalidades" className="py-24 border-t border-neutral-900 bg-neutral-950/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Gerencie tudo em um único lugar</h2>
            <p className="text-neutral-400">Funcionalidades robustas preparadas para grandes barbearias ou redes multi-filiais.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-900 hover:border-neutral-800 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Agenda Inteligente</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Visualização automática de horários disponíveis baseada no tempo de duração de cada serviço e folgas dos barbeiros.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-900 hover:border-neutral-800 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Escalas e Presenças</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Organize turnos, férias, licenças e faltas integradas ao calendário de agendamento em tempo real.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-900 hover:border-neutral-800 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Controle Financeiro</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Relatórios consolidados de comissões, faturamento diário, semanal e mensal, fluxo de caixa e lucros líquidos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Availability Callout */}
      <section id="motor" className="py-24 border-t border-neutral-900 bg-neutral-950 relative overflow-hidden">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Mecanismo Anticonflito e Lista de Espera Inteligente
              </h2>
              <p className="text-neutral-400 mb-6 leading-relaxed">
                Nosso motor inteligente analisa automaticamente a escala ativa, folgas cadastradas, licenças e agendamentos existentes. Ele previne conflitos de horários através de transações de nível serializável.
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Atualização imediata para todos os usuários via WebSockets.
                </li>
                <li className="flex items-center gap-3 text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Reserva baseada na duração exata de múltiplos serviços acumulados.
                </li>
                <li className="flex items-center gap-3 text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Notificações automáticas para lista de espera se houver cancelamento.
                </li>
              </ul>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 md:p-8 backdrop-blur-sm relative z-10 shadow-2xl">
                <h4 className="text-lg font-bold mb-4 flex items-center justify-between border-b border-neutral-800 pb-4">
                  <span>Visualização de Agenda (Hoje)</span>
                  <span className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full font-semibold">Tempo Real</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80">
                    <span className="text-sm font-semibold text-neutral-300">08:00 - 09:00</span>
                    <span className="text-xs px-2.5 py-1 bg-red-500/10 text-red-500 rounded-full font-medium">Ocupado</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80">
                    <span className="text-sm font-semibold text-neutral-300">09:00 - 10:00</span>
                    <span className="text-xs px-2.5 py-1 bg-red-500/10 text-red-500 rounded-full font-medium">Ocupado</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950 border border-amber-500/30 bg-amber-500/[0.02]">
                    <span className="text-sm font-semibold text-amber-500">10:00 - 11:30</span>
                    <span className="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full font-bold">Livre - Corte Premium</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80">
                    <span className="text-sm font-semibold text-neutral-300">11:30 - 12:30</span>
                    <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-full font-medium">Livre</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-12 mt-auto text-center text-sm text-neutral-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-neutral-300">Barber<span className="text-amber-500">Flow</span></span>
            <span>&copy; {new Date().getFullYear()} BarberFlow. Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-neutral-300 transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-neutral-300 transition-colors">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

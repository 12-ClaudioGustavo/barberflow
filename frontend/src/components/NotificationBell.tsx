'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { io, Socket } from 'socket.io-client';
import { 
  Bell, 
  Check, 
  Building, 
  User, 
  Calendar, 
  AlertTriangle, 
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

interface Notification {
  id: string;
  user_id: string;
  tenant_id?: string | null;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const socketUrl = apiUrl.replace('/api/v1', '');

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationBell() {
  const { user, session } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Registrar inscrição push do dispositivo
  useEffect(() => {
    const token = session?.access_token;
    if (!token || !user?.id) return;

    async function registerPush() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Mensagens Push não são suportadas por este navegador.');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        
        // Verificar permissão
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
          console.warn('Permissão de notificações não concedida pelo usuário.');
          return;
        }

        // Buscar chave VAPID pública
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.error('Chave pública VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY) não configurada no frontend.');
          return;
        }

        // Sanitizar a chave para remover aspas extras ou quebras de linha que possam vir do painel de deploy
        const cleanVapidKey = vapidPublicKey.trim().replace(/['"]/g, '');

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const convertedVapidKey = urlBase64ToUint8Array(cleanVapidKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });
        }

        // Enviar para o backend
        await fetch(`${apiUrl}/push/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ subscription })
        });
      } catch (err) {
        console.error('Erro ao registrar notificações push:', err);
      }
    }

    const timeoutId = setTimeout(registerPush, 3000);
    return () => clearTimeout(timeoutId);
  }, [session, user]);

  // Carregar notificações existentes
  const fetchNotifications = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiUrl}/notifications`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [session]);

  // Conectar WebSocket
  useEffect(() => {
    if (!user?.id) return;

    const socket = io(socketUrl, {
      query: {
        userId: user.id,
        tenantId: user.tenantId || ''
      }
    });

    socketRef.current = socket;

    socket.on('new_notification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setAnimate(true);
      setTimeout(() => setAnimate(false), 1000);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const markAsRead = async (id: string) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiUrl}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
      }
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiUrl}/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error('Erro ao marcar todas notificações como lidas:', err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins}m`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    return `Há ${diffDays}d`;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_tenant_request':
      case 'tenant_approved':
      case 'tenant_rejected':
      case 'tenant_suspended':
        return <Building className="w-4 h-4 text-amber-500" />;
      case 'employee_created':
        return <User className="w-4 h-4 text-indigo-500" />;
      case 'appointment_created_client':
      case 'appointment_created_employee':
      case 'appointment_created_admin':
        return <Calendar className="w-4 h-4 text-emerald-500" />;
      case 'appointment_cancelled_client':
      case 'appointment_cancelled_employee':
      case 'appointment_cancelled_admin':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'client_reminder_30m':
      case 'employee_reminder_15m':
        return <Clock className="w-4 h-4 text-sky-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do Sino */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-full hover:bg-slate-800/80 focus:outline-none"
        aria-label="Notificações"
      >
        <Bell className={`w-6 h-6 ${animate ? 'animate-bounce text-violet-500' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white ring-2 ring-slate-900 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de Notificações */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden transform origin-top-right transition-all">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/40">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-250">Notificações</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  {unreadCount} novas
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="p-3 bg-slate-850 rounded-full mb-3">
                  <Sparkles className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 font-medium">Tudo limpo por aqui!</p>
                <p className="text-xs text-slate-500 mt-1">Você não possui nenhuma notificação.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                  className={`flex gap-3 p-4 hover:bg-slate-800/40 transition-all duration-200 cursor-pointer ${
                    !notification.read ? 'bg-violet-950/15 border-l-2 border-violet-500 pl-3.5' : 'pl-4'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`p-2 rounded-lg ${
                      !notification.read ? 'bg-slate-800' : 'bg-slate-900/40'
                    }`}>
                      {getIcon(notification.type)}
                    </div>
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${
                        !notification.read ? 'text-slate-100' : 'text-slate-350'
                      }`}>
                        {notification.title}
                      </p>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${
                      !notification.read ? 'text-slate-300' : 'text-slate-450'
                    }`}>
                      {notification.message}
                    </p>
                  </div>

                  {!notification.read && (
                    <div className="flex-shrink-0 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

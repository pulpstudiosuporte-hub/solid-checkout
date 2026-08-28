import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Check, CheckCircle2, LoaderCircle, RefreshCw, Volume2, VolumeX, XCircle } from 'lucide-react';
import { getNotifications, markNotificationsRead } from './api';
import {
  deviceNotificationPermission,
  notificationSoundsEnabled,
  playPendingSound,
  playSaleSound,
  requestDeviceNotifications,
  setNotificationSoundsEnabled,
  showDeviceNotification,
  unlockNotificationSounds,
} from './notification-sounds';

const icons = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Bell };
const relative = value => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
};

export default function NotificationCenter({ csrfToken, storeKey, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [sounds, setSounds] = useState(notificationSoundsEnabled);
  const [devicePermission, setDevicePermission] = useState(deviceNotificationPermission);
  const [state, setState] = useState({ loading: true, unread: 0, items: [], error: '' });
  const root = useRef(null);
  const knownIds = useRef(new Set());
  const initialized = useRef(false);
  const cursorKey = `solid:notification-cursor:${storeKey || 'default'}`;

  const announceNew = items => {
    let fresh = [];
    if (!initialized.current) {
      const cursor = window.localStorage.getItem(cursorKey);
      if (cursor && items[0]?.id !== cursor) {
        const cursorIndex = items.findIndex(item => item.id === cursor);
        fresh = cursorIndex >= 0 ? items.slice(0, cursorIndex) : items.slice(0, 1);
      }
      knownIds.current = new Set(items.map(item => item.id));
      initialized.current = true;
    } else {
      fresh = items.filter(item => !knownIds.current.has(item.id));
      items.forEach(item => knownIds.current.add(item.id));
    }
    if (items[0]?.id) window.localStorage.setItem(cursorKey, items[0].id);
    const important = fresh.find(item => item.sound === 'sale') || fresh.find(item => item.sound === 'pending');
    if (!important) return;
    if (important.sound === 'sale') void playSaleSound();
    else void playPendingSound();
    void showDeviceNotification(important);
  };

  const load = async (silent = false) => {
    if (!silent) setState(current => ({ ...current, loading: true, error: '' }));
    try {
      const data = await getNotifications();
      announceNew(data.items);
      setState({ loading: false, unread: data.unread, items: data.items, error: '' });
    } catch (error) {
      setState(current => ({ ...current, loading: false, error: error.message }));
    }
  };

  useEffect(() => {
    initialized.current = false;
    knownIds.current = new Set();
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    const resume = () => { if (document.visibilityState === 'visible') void load(true); };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const close = event => { if (root.current && !root.current.contains(event.target)) setOpen(false); };
    const escape = event => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);

  const readAll = async () => {
    try {
      await markNotificationsRead(csrfToken);
      setState(current => ({ ...current, unread: 0, items: current.items.map(item => ({ ...item, read: true })) }));
    } catch (error) {
      setState(current => ({ ...current, error: error.message }));
    }
  };
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) { void load(true); window.setTimeout(() => void readAll(), 800); }
  };
  const toggleSounds = async () => {
    const next = !sounds;
    if (next && !await unlockNotificationSounds()) {
      setState(current => ({ ...current, error: 'Este navegador não permite reproduzir notificações sonoras.' }));
      return;
    }
    if (next) setDevicePermission(await requestDeviceNotifications());
    setNotificationSoundsEnabled(next);
    setSounds(next);
  };
  const testAlerts = async () => {
    await unlockNotificationSounds();
    setNotificationSoundsEnabled(true);
    setSounds(true);
    const permission = await requestDeviceNotifications();
    setDevicePermission(permission);
    await playSaleSound();
    if (permission === 'granted') await showDeviceNotification({ id: 'test', title: 'Teste de venda SOLID', message: '', destination: 'orders' }, true);
  };
  const navigate = item => { setOpen(false); onNavigate(item.destination); };

  return <div className="notification-center" ref={root}>
    <button className={`icon-btn bell ${open ? 'active' : ''}`} aria-label={`Notificações${state.unread ? `, ${state.unread} não lidas` : ''}`} aria-expanded={open} onClick={toggle}><Bell size={19}/>{state.unread > 0 && <i>{state.unread > 99 ? '99+' : state.unread}</i>}</button>
    {open && <section className="notification-popover" aria-label="Central de notificações">
      <header><div><h2>Notificações</h2><p>Acompanhe sua operação em tempo real.</p></div><button className="icon-btn" aria-label="Atualizar notificações" onClick={() => void load()}>{state.loading ? <LoaderCircle className="spin" size={17}/> : <RefreshCw size={17}/>}</button></header>
      <div className="alert-controls">
        <button className={`sound-control ${sounds ? 'active' : ''}`} type="button" onClick={() => void toggleSounds()}>{sounds ? <Volume2 size={17}/> : <VolumeX size={17}/>}<span><strong>Alertas de vendas</strong><small>{sounds ? (devicePermission === 'granted' ? 'Som e notificação ativados neste aparelho' : 'Som ativo; permita notificações no iPhone') : 'Toque para ativar neste aparelho'}</small></span><i aria-hidden="true"/></button>
        <button className="test-alerts" type="button" onClick={() => void testAlerts()}>Testar</button>
        <p>Para ouvir no iPhone, instale o app e permita notificações. Mantenha-o aberto para alertas em tempo real.</p>
      </div>
      {state.error && <div className="notification-error">{state.error}</div>}
      <div className="notification-list">{state.loading && !state.items.length ? <div className="notification-empty"><LoaderCircle className="spin"/> Carregando...</div> : !state.items.length ? <div className="notification-empty"><Check size={25}/><strong>Tudo certo por aqui</strong><span>Novos pagamentos e alertas aparecerão aqui.</span></div> : state.items.map(item => { const Icon = icons[item.type] || Bell; return <button key={item.id} className={`notification-item ${item.type} ${item.read ? '' : 'unread'}`} onClick={() => navigate(item)}><span className="notification-item-icon"><Icon size={17}/></span><span><strong>{item.title}</strong><small>{item.message}</small><time>{relative(item.createdAt)}</time></span></button>; })}</div>
      {state.items.length > 0 && <footer><button type="button" disabled={!state.unread} onClick={() => void readAll()}><Check size={14}/> Marcar todas como lidas</button></footer>}
    </section>}
  </div>;
}

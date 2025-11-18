import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let channelConfigured = false;

export async function ensureNotificationSetup() {
  if (Platform.OS === 'android' && !channelConfigured) {
    await Notifications.setNotificationChannelAsync('vote-reminders', {
      name: 'Recordatorios de votación',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
    channelConfigured = true;
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value?.toDate) {
    try { return value.toDate(); } catch { return null; }
  }
  return null;
}

export async function scheduleVoteReminder({ votacionId, division, cierra }) {
  if (!votacionId) return null;
  const granted = await ensureNotificationSetup();
  if (!granted) return null;

  const now = Date.now();
  let when = now + 30 * 60 * 1000; // 30 minutos por defecto
  const closeDate = parseDate(cierra);
  if (closeDate) {
    const candidate = closeDate.getTime() - 10 * 60 * 1000; // 10 minutos antes del cierre
    if (candidate > now) {
      when = candidate;
    }
  }

  const triggerDate = new Date(Math.max(when, now + 5 * 60 * 1000)); // al menos 5 minutos en el futuro

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '¡Hora de votar al jugador de la fecha! ⚽️',
      body: division ? `División ${division}` : 'Ingresa a la app y deja tu voto.',
      sound: 'default',
    },
    trigger: triggerDate,
  });

  return id;
}

export async function cancelVoteReminder(notificationId) {
  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // ignore
    }
  }
}

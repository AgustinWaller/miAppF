import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { shouldSendNotification } from "./notificationPrefs";

const CHANNEL_ID = "league-alerts";
let channelConfigured = false;

export async function ensureNotificationSetup() {
  if (Platform.OS === "android" && !channelConfigured) {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Alertas de la liga",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
    channelConfigured = true;
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === "granted";
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value?.toDate) {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

const NOTIFICATION_BUILDERS = {
  all: (payload = {}) => ({
    title: payload.title || "Novedades de la liga",
    body: payload.body || "Abri la app para conocer todas las novedades.",
  }),
  favoriteTeam: (payload = {}) => {
    const teamName = payload.teamName || "Tu equipo favorito";
    return {
      title: `${teamName} tiene novedades`,
      body: payload.message || "Revisa los detalles del equipo.",
    };
  },
  voteOpen: (payload = {}) => ({
    title: "Votacion abierta",
    body: payload.division
      ? `Division ${payload.division}: ingresa y vota al mejor jugador.`
      : "Ingresa y vota al mejor jugador.",
  }),
  voteClosed: (payload = {}) => ({
    title: "Resultados de la votacion",
    body: payload.winner
      ? `Ganador: ${payload.winner}. Mira el detalle en la app.`
      : "La votacion finalizo. Mira los resultados.",
  }),
  newsAll: (payload = {}) => ({
    title: "Nueva noticia",
    body: payload.headline || "Hay una nueva publicacion en la liga.",
  }),
  newsFavorite: (payload = {}) => ({
    title: payload.teamName ? `Noticia de ${payload.teamName}` : "Noticia de tu equipo",
    body: payload.headline || "Tu equipo publico una novedad.",
  }),
  matchAll: (payload = {}) => ({
    title: "Actualizacion de partido",
    body: `${payload.local || payload.localName || "Local"} ${payload.golesLocal ?? "-"} - ${
      payload.golesVisitante ?? "-"
    } ${payload.visitante || payload.visitanteName || "Visitante"}`,
  }),
  matchFavorite: (payload = {}) => ({
    title: payload.teamName ? `Juega ${payload.teamName}` : "Tu equipo esta jugando",
    body: `${payload.teamName || "Tu equipo"} ${payload.golesLocal ?? "-"} - ${
      payload.golesVisitante ?? "-"
    } ${payload.rival || payload.visitante || ""}`.trim(),
  }),
};

async function scheduleNotificationWithPrefs(type, payload = {}, options = {}) {
  const allowed = options.force || (await shouldSendNotification(type));
  if (!allowed || !NOTIFICATION_BUILDERS[type]) return null;

  const granted = await ensureNotificationSetup();
  if (!granted) return null;

  const content = NOTIFICATION_BUILDERS[type](payload);
  const trigger = options.trigger ?? null;

  return Notifications.scheduleNotificationAsync({
    content: {
      ...content,
      sound: "default",
      data: { type, payload },
    },
    trigger,
  });
}

export async function scheduleVoteReminder({ votacionId, division, cierra }) {
  if (!votacionId) return null;

  const now = Date.now();
  let when = now + 30 * 60 * 1000;
  const closeDate = parseDate(cierra);
  if (closeDate) {
    const candidate = closeDate.getTime() - 10 * 60 * 1000;
    if (candidate > now) {
      when = candidate;
    }
  }

  const triggerDate = new Date(Math.max(when, now + 5 * 60 * 1000));
  return scheduleNotificationWithPrefs(
    "voteOpen",
    { division, votacionId },
    { trigger: triggerDate }
  );
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

export function notifyGeneral(payload) {
  return scheduleNotificationWithPrefs("all", payload);
}

export function notifyFavoriteTeam(payload) {
  return scheduleNotificationWithPrefs("favoriteTeam", payload);
}

export function notifyVoteOpen(payload) {
  return scheduleNotificationWithPrefs("voteOpen", payload);
}

export function notifyVoteClosed(payload) {
  return scheduleNotificationWithPrefs("voteClosed", payload);
}

export function notifyNewsAll(payload) {
  return scheduleNotificationWithPrefs("newsAll", payload);
}

export function notifyNewsFavorite(payload) {
  return scheduleNotificationWithPrefs("newsFavorite", payload);
}

export function notifyMatchUpdate(payload, { favorite = false } = {}) {
  return scheduleNotificationWithPrefs(favorite ? "matchFavorite" : "matchAll", payload);
}

export function notifyMatchFavorite(payload) {
  return scheduleNotificationWithPrefs("matchFavorite", payload);
}

export function notifyMatchAll(payload) {
  return scheduleNotificationWithPrefs("matchAll", payload);
}

export function sendNotificationByType(type, payload, options) {
  return scheduleNotificationWithPrefs(type, payload, options);
}

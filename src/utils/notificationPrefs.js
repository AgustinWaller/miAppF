import AsyncStorage from "@react-native-async-storage/async-storage";

export const NOTIFICATION_PREFS_KEY = "app.notification.preferences";

export const NOTIFICATION_OPTIONS = [
  { key: "all", label: "Todas", description: "Recibir novedades generales" },
  { key: "favoriteTeam", label: "Equipo favorito", description: "Eventos importantes de tu equipo" },
  { key: "voteOpen", label: "Votacion de jugador abierta", description: "Te avisamos cuando puedas votar" },
  { key: "voteClosed", label: "Votacion terminada", description: "Resultados del jugador ganador" },
  { key: "newsAll", label: "Nueva noticia (todas)", description: "Publicaciones generales" },
  { key: "newsFavorite", label: "Nueva noticia equipo favorito", description: "Noticias especificas de tu equipo" },
  { key: "matchAll", label: "Partidos (todos)", description: "Avisos de partidos en curso" },
  { key: "matchFavorite", label: "Partidos equipo favorito", description: "Actualizaciones del equipo marcado" },
];

export const DEFAULT_NOTIFICATION_PREFS = NOTIFICATION_OPTIONS.reduce((acc, item) => {
  // Solo habilitamos "Todas" por defecto para minimizar ruido
  acc[item.key] = item.key === "all";
  return acc;
}, {});

function normalizePrefs(stored) {
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  if (stored && typeof stored === "object") {
    NOTIFICATION_OPTIONS.forEach(({ key }) => {
      if (typeof stored[key] === "boolean") {
        prefs[key] = stored[key];
      }
    });
  }
  return prefs;
}

export async function loadNotificationPrefs() {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    return normalizePrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export async function saveNotificationPrefs(nextPrefs) {
  const normalized = normalizePrefs(nextPrefs);
  try {
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
  return normalized;
}

export async function shouldSendNotification(type) {
  const prefs = await loadNotificationPrefs();
  return Boolean(prefs[type]);
}

export const NOTIFICATION_SAMPLE_DATA = {
  all: { title: "Novedades de la liga", body: "Chequa las ultimas noticias." },
  favoriteTeam: { teamId: "sancarlos", teamName: "San Carlos", message: "Tu equipo publico una novedad." },
  voteOpen: { division: "A" },
  voteClosed: { division: "A", winner: "Juan Perez" },
  newsAll: { headline: "Nueva fecha confirmada" },
  newsFavorite: { teamId: "sancarlos", teamName: "San Carlos", headline: "Nuevo fichaje confirmado" },
  matchAll: {
    localId: "sancarlos",
    visitanteId: "nacional",
    local: "San Carlos",
    visitante: "Nacional",
    golesLocal: 2,
    golesVisitante: 1,
  },
  matchFavorite: {
    teamId: "sancarlos",
    teamName: "San Carlos",
    rival: "Nacional",
    golesLocal: 2,
    golesVisitante: 1,
  },
};

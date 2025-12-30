import * as FileSystem from "expo-file-system";

const FAVORITES_FILE = `${FileSystem.documentDirectory}favorite-teams.json`;
const LEGACY_USER = "__legacy__";

let cache = null; // { byUser: { [userId]: teamId }, legacy: [] }
const listeners = new Set(); // listeners with an optional userId filter

const listForUser = (userId) => {
  if (!cache) return [];
  const byUser = cache.byUser || {};
  const legacy = cache.legacy || [];
  if (userId && byUser[userId]) return [byUser[userId]];
  if (!userId && Object.keys(byUser).length === 1) {
    // Single entry and no user provided: return it (best effort)
    return [Object.values(byUser)[0]];
  }
  if (legacy.length) return [legacy[0]];
  return [];
};

function notify() {
  listeners.forEach(({ fn, userId }) => {
    try {
      fn(listForUser(userId));
    } catch {
      // ignore
    }
  });
}

const normalizeParsed = (parsed = {}) => {
  if (Array.isArray(parsed)) {
    return { byUser: {}, legacy: parsed };
  }
  if (typeof parsed === "string") {
    return { byUser: {}, legacy: parsed ? [parsed] : [] };
  }
  const byUser = typeof parsed.byUser === "object" && parsed.byUser ? parsed.byUser : {};
  const legacy =
    Array.isArray(parsed.legacy) && parsed.legacy.length
      ? parsed.legacy
      : typeof parsed.legacy === "string" && parsed.legacy
        ? [parsed.legacy]
        : [];
  return { byUser, legacy };
};

export async function loadFavoriteTeams(userId = null) {
  if (!cache) {
    try {
      const info = await FileSystem.getInfoAsync(FAVORITES_FILE);
      if (info.exists) {
        const content = await FileSystem.readAsStringAsync(FAVORITES_FILE);
        cache = normalizeParsed(JSON.parse(content || "{}"));
      } else {
        cache = { byUser: {}, legacy: [] };
      }
    } catch {
      cache = { byUser: {}, legacy: [] };
    }
  }
  return listForUser(userId);
}

async function persistFavoriteTeams() {
  try {
    await FileSystem.writeAsStringAsync(
      FAVORITES_FILE,
      JSON.stringify(cache || { byUser: {}, legacy: [] })
    );
  } catch {
    // ignore
  }
  notify();
}

export async function addFavoriteTeam(userId, teamId) {
  if (!teamId || !userId) return listForUser(userId);
  await loadFavoriteTeams(); // ensure cache
  if (!cache.byUser) cache.byUser = {};
  if (cache.byUser[userId] === teamId) return [teamId];
  cache.byUser[userId] = teamId;
  // clear legacy once a user-bound favorite is set
  cache.legacy = [];
  await persistFavoriteTeams();
  return [teamId];
}

export async function removeFavoriteTeam(userId, teamId) {
  await loadFavoriteTeams(); // ensure cache
  if (!userId) return listForUser(userId);
  if (cache.byUser && cache.byUser[userId] && cache.byUser[userId] === teamId) {
    delete cache.byUser[userId];
    await persistFavoriteTeams();
  }
  return listForUser(userId);
}

export function subscribeFavorites(userId, listener) {
  const entry = { userId, fn: listener };
  listeners.add(entry);
  if (cache) {
    try { listener(listForUser(userId)); } catch { /* ignore */ }
  }
  return () => listeners.delete(entry);
}

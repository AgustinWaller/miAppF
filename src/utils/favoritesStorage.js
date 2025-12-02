import * as FileSystem from "expo-file-system";

const FAVORITES_FILE = `${FileSystem.documentDirectory}favorite-teams.json`;
let cache = null;
const listeners = new Set();

function notify(updated) {
  listeners.forEach((fn) => {
    try { fn(updated); } catch { /* ignore */ }
  });
}

export async function loadFavoriteTeams() {
  if (cache) return cache;
  try {
    const info = await FileSystem.getInfoAsync(FAVORITES_FILE);
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(FAVORITES_FILE);
      const parsed = JSON.parse(content || "[]");
      if (Array.isArray(parsed) && parsed.length) {
        cache = [parsed[0]];
      } else if (typeof parsed === "string" && parsed) {
        cache = [parsed];
      } else {
        cache = [];
      }
      return cache;
    }
  } catch {
    // ignore
  }
  cache = [];
  return cache;
}

async function persistFavoriteTeams(list) {
  try {
    await FileSystem.writeAsStringAsync(FAVORITES_FILE, JSON.stringify(list));
  } catch {
    // ignore
  }
  notify(list);
}

export async function addFavoriteTeam(teamId) {
  if (!teamId) return cache || [];
  const current = await loadFavoriteTeams();
  if (current[0] === teamId) return current;
  const updated = [teamId];
  cache = updated;
  await persistFavoriteTeams(updated);
  return cache;
}

export async function removeFavoriteTeam(teamId) {
  const current = await loadFavoriteTeams();
  if (current.includes(teamId)) {
    const updated = current.filter((id) => id !== teamId);
    cache = updated;
    await persistFavoriteTeams(updated);
  }
  return cache;
}

export function subscribeFavorites(listener) {
  listeners.add(listener);
  if (cache) {
    try { listener(cache); } catch { /* ignore */ }
  }
  return () => listeners.delete(listener);
}

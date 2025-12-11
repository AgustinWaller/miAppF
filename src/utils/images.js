// src/utils/images.js
// Helper para entregar siempre un source valido a <Image>

const normalizeSource = (value) => {
  if (!value) return null;

  if (typeof value === "number") return value; // require(...)

  if (typeof value === "object" && !Array.isArray(value)) {
    // Si viene como { uri: require(...) } recuperamos el number
    if (typeof value.uri === "number") return value.uri;
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return { uri: trimmed };
  }

  return null;
};

export function safeImage(primary, fallback) {
  return normalizeSource(primary) || normalizeSource(fallback) || null;
}

// Fallbacks locales para evitar dependencias de red
export const FALLBACK_PLAYER = require("../assets/placeholders/player.png");
export const FALLBACK_TEAM = require("../assets/placeholders/club.png");

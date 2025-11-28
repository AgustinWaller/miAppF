// src/utils/images.js
// Helper para usar imágenes de forma segura (fallback si falta la URL)

export function safeImage(uri, fallback) {
  if (!uri || typeof uri !== "string" || uri.trim() === "") return fallback;
  // Si la uri ya es un objeto (por ejemplo require(...)) asumimos que está ok
  if (typeof uri === "object") return uri;
  return { uri };
}

// Si preferís usar assets locales en lugar de URLs remotas,
// reemplazá estas rutas require(...) por las correctas.
// Ejemplo: require('../../assets/fallback/player.png')
export const FALLBACK_PLAYER = "https://i.ibb.co/2Ncr8gD/no-player.png";
export const FALLBACK_TEAM = "https://i.ibb.co/9pt99rg/no-team.png";

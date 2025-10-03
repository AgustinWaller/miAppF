// Local image helpers for club logos and player photos
// 1) Colocá tus PNG/JPG en src/assets/clubs y src/assets/players
// 2) Registralos en los objetos clubLogos / playerPhotos
// 3) Usá getClubLogo / getPlayerPhoto para obtener la imagen con fallback

const defaultClub = require('./placeholders/club.png');
const defaultPlayer = require('./placeholders/player.png');

export const clubLogos = {
  // Ejemplo:
  // pen: require('./clubs/pen.png'),
  // nac: require('./clubs/nac.png'),
};

export const playerPhotos = {
  // Ejemplo:
  // pen_canobbio: require('./players/pen_canobbio.png'),
  // nac_suarez: require('./players/nac_suarez.png'),
};

export const getClubLogo = (clubId) => clubLogos[clubId] || defaultClub;
export const getPlayerPhoto = (playerId) => playerPhotos[playerId] || defaultPlayer;

// Local image helpers for club logos and player photos (escudos locales)
// Usa los archivos en src/assets/clubs mapeados por team_id (minusculas, sin acentos)

const defaultClub = require('./placeholders/club.png');
const defaultPlayer = require('./placeholders/player.png');

export const clubLogos = {
  sancarlos: require('./clubs/sancarlos.png'),
  juventud: require('./clubs/juventud.png'),
  horqueta: require('./clubs/horqueta.png'),
  elgeneral: require('./clubs/elgeneral.jpeg'),
  artesano: require('./clubs/artesano.jpeg'),
  maracana: require('./clubs/maracana.png'),
  barriosur: require('./clubs/barriosur.png'),
  progreso: require('./clubs/progreso.jpeg'),
  sanpedro: require('./clubs/sanpedro.jpeg'),
  central: require('./clubs/central.png'),
  huracan: require('./clubs/huracan.jpeg'),
  semillero: require('./clubs/semillero.jpg'),
  sarandi: require('./clubs/sarandi.jpeg'),
  nacional: require('./clubs/nacional.png'),
  penarol: require('./clubs/penarol.jpg'),
  "peñarol": require('./clubs/penarol.jpg'),
};

export const playerPhotos = {
  // Agrega aquí las fotos locales de jugadores.
  // El key debe ser el player_id de players.csv, y el require apunta al archivo en ./players/.
  // Ejemplo:
  // penarol_lopez: require('./players/penarol_lopez.png'),
  sancarlos_laclau: require('./players/sancarlos_laclau.jpg'),
};

// Devuelve el escudo local o null si no existe (para permitir otros fallbacks)
export const getClubLogo = (clubId) => clubLogos[clubId] || null;
export const getPlayerPhoto = (playerId) => playerPhotos[playerId] || defaultPlayer;

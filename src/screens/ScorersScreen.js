import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getMatchesByDivision } from '../services/matches';
import { getPlayersByDivision } from '../services/players';
import { APP_COLORS } from '../theme/colors';

export default function ScorersScreen({ route }) {
  const initialDivision = route?.params?.division ?? 'A';
  const [division, setDivision] = useState(initialDivision);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [ms, ps] = await Promise.all([
        getMatchesByDivision(division),
        getPlayersByDivision(division),
      ]);
      console.log(`[scorers] div=${division} matches=${ms.length} players=${ps.length}`);
      setMatches(ms);
      setPlayers(ps);
    } catch (e) {
      console.error('Scorers load error:', e);
      setError('Error al cargar');
      setMatches([]);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => { load(); }, [load]);

  const playerName = useCallback((id) => {
    const p = players.find(x => x.id === id);
    return p?.name || id;
  }, [players]);

  const rows = useMemo(() => {
    const tally = {};
    matches.forEach(m => {
      (m.eventos || []).forEach(ev => {
        if (ev?.tipo === 'gol' && ev?.jugadorId) {
          tally[ev.jugadorId] = (tally[ev.jugadorId] || 0) + 1;
        }
      });
    });
    return Object.entries(tally)
      .map(([jugadorId, goles]) => ({ id: jugadorId, nombre: playerName(jugadorId), goles }))
      .sort((a,b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre));
  }, [matches, playerName]);

  return (
    <View style={styles.container}>
      <View style={styles.divRow}>
        {['A','B'].map(d => (
          <TouchableOpacity key={d} style={[styles.divBtn, division === d && styles.divBtnActive]} onPress={() => setDivision(d)}>
            <Text style={[styles.divText, division === d && styles.divTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={load} style={styles.reload}><Text style={styles.reloadTxt}>Refrescar</Text></TouchableOpacity>
      </View>

      <Text style={styles.debug}>División {division} • Partidos: {matches.length} • Jugadores: {players.length} • Goleadores: {rows.length}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.campo} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={load}>Error al cargar. Toca para reintentar.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.id}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>{index + 1}</Text>
              <Text style={styles.name}>{item.nombre}</Text>
              <Text style={styles.goals}>{item.goles}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Sin goles registrados.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16, backgroundColor: APP_COLORS.fondo },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  divBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: '700' },
  divTextActive: { color: APP_COLORS.blanco },
  reload: { marginLeft: 'auto' },
  reloadTxt: { color: APP_COLORS.campo, fontWeight: '700' },
  debug: { color: '#777', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_COLORS.blanco, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: APP_COLORS.cielo },
  rank: { width: 28, textAlign: 'center', fontWeight: '800', color: APP_COLORS.campo },
  name: { flex: 1, fontWeight: '700', color: APP_COLORS.texto },
  goals: { marginLeft: 8, fontWeight: '700', color: APP_COLORS.campo },
  empty: { textAlign: 'center', marginTop: 24, color: APP_COLORS.texto },
});


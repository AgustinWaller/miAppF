import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { APP_COLORS } from '../theme/colors';
import { listenOpenVotacionByDivision } from '../services/votacion';
import { db } from '../services/firebase';
import { getPlayersByDivision } from '../services/players';
import { getTeamsByDivision } from '../services/teams';

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

function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TopPlayersScreen({ route }) {
  const initialDivision = route?.params?.division ?? 'A';
  const [division, setDivision] = useState(initialDivision);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [annualRows, setAnnualRows] = useState([]);
  const [recentClosed, setRecentClosed] = useState([]);

  const playersMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const teamsMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const playerDisplay = useCallback((jugadorId) => {
    const jugador = playersMap.get(jugadorId);
    if (!jugador) return { nombre: jugadorId, equipo: '' };
    const team = teamsMap.get(jugador.teamId || jugador.equipoId);
    return {
      nombre: jugador.name || jugadorId,
      equipo: team?.name || team?.nombre || jugador.teamName || jugador.equipo || '',
    };
  }, [playersMap, teamsMap]);

  const loadDivisionBasics = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [p, t] = await Promise.all([
        getPlayersByDivision(division),
        getTeamsByDivision(division),
      ]);
      setPlayers(p);
      setTeams(t);
    } catch (e) {
      console.error('loadDivisionBasics error', e);
      setError('Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => { loadDivisionBasics(); }, [loadDivisionBasics]);

  const recomputeAnnual = useCallback(async () => {
    if (!division) {
      setAnnualRows([]);
      setRecentClosed([]);
      return;
    }
    try {
      const q = query(
  collection(db, 'votacion'),
  where('divisionId', '==', division)
);
const snap = await getDocs(q);

// ordenamos localmente para evitar índices en Firestore
const docs = snap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .sort((a, b) => {
    const da = parseDate(a.cierra)?.getTime() ?? 0;
    const db = parseDate(b.cierra)?.getTime() ?? 0;
    return db - da; // más reciente primero
  });

      const closed = docs.filter((v) => v.abierto !== true && (!v.cierra || (parseDate(v.cierra)?.getTime() ?? 0) <= Date.now()));

      const votesPer = {};
      const recent = [];

      for (const v of closed) {
        const vsnap = await getDocs(collection(db, 'votacion', String(v.id), 'votes'));
        const votos = vsnap.docs.map((x) => ({ id: x.id, ...x.data() }));
        if (!votos.length) continue;
        const count = votos.reduce((acc, it) => {
          const key = it.jugadorId;
          if (!key) return acc;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        const max = Math.max(...Object.values(count));
        const winners = Object.entries(count)
          .filter(([, cant]) => cant === max)
          .map(([jugadorId, cant]) => {
            const info = playerDisplay(jugadorId);
            return { id: jugadorId, ...info, votos: cant };
          });

        winners.forEach((winner) => {
          votesPer[winner.id] = (votesPer[winner.id] || 0) + 1;
        });

        recent.push({
          id: v.id,
          fecha: formatDate(v.cierra || v.abre),
          winners,
        });
      }

      const entries = Object.entries(votesPer).map(([jugadorId, wins]) => {
        const info = playerDisplay(jugadorId);
        return { id: jugadorId, ...info, wins };
      });

      setAnnualRows(entries.sort((a, b) => b.wins - a.wins || a.nombre.localeCompare(b.nombre)));
      setRecentClosed(recent.slice(0, 5));
    } catch (e) {
      console.error('recomputeAnnual error', e);
      setAnnualRows([]);
      setRecentClosed([]);
    }
  }, [division, playerDisplay]);

  useEffect(() => { recomputeAnnual(); }, [recomputeAnnual]);

  const prevHadOpenRef = useRef(false);
  useEffect(() => {
    const unsub = listenOpenVotacionByDivision(division, (doc) => {
      const hadOpen = prevHadOpenRef.current;
      const hasOpenNow = !!doc && doc.abierto === true;
      if (hadOpen && !hasOpenNow) {
        loadDivisionBasics();
        recomputeAnnual();
      }
      prevHadOpenRef.current = hasOpenNow;
    });
    return () => unsub && unsub();
  }, [division, loadDivisionBasics, recomputeAnnual]);

  return (
    <View style={styles.container}>
      <View style={styles.divRow}>
        {['A', 'B'].map((d) => (
          <TouchableOpacity key={d} style={[styles.divBtn, division === d && styles.divBtnActive]} onPress={() => setDivision(d)}>
            <Text style={[styles.divText, division === d && styles.divTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => { loadDivisionBasics(); recomputeAnnual(); }} style={styles.reload}>
          <Text style={styles.reloadTxt}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.campo} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={() => { loadDivisionBasics(); recomputeAnnual(); }}>Error al cargar. Toca para reintentar.</Text>
      ) : (
        <>
          <FlatList
            data={annualRows}
            keyExtractor={(it) => it.id}
            renderItem={({ item, index }) => (
              <View style={styles.row}>
                <Text style={styles.rank}>{index + 1}</Text>
                <Text style={styles.name}>{item.nombre}</Text>
                {!!item.equipo && <Text style={styles.team}>{item.equipo}</Text>}
                <Text style={styles.wins}>{item.wins} VP</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Aún no hay ganadores registrados.</Text>}
            contentContainerStyle={{ paddingBottom: 16 }}
          />

          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Últimas votaciones cerradas</Text>
            {recentClosed.length === 0 ? (
              <Text style={styles.historyEmpty}>Sin historial por ahora.</Text>
            ) : (
              recentClosed.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <Text style={styles.historyDate}>{item.fecha || 'Sin fecha'}</Text>
                  {item.winners.map((winner) => (
                    <Text key={`${item.id}-${winner.id}`} style={styles.historyWinner}>
                      {winner.nombre}{winner.equipo ? ` (${winner.equipo})` : ''} — {winner.votos} votos
                    </Text>
                  ))}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  divRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  divBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: '700' },
  divTextActive: { color: APP_COLORS.blanco },
  reload: { marginLeft: 'auto' },
  reloadTxt: { color: APP_COLORS.campo, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_COLORS.blanco, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: APP_COLORS.cielo },
  rank: { width: 28, textAlign: 'center', fontWeight: '800', color: APP_COLORS.campo },
  name: { flex: 1, fontWeight: '700', color: APP_COLORS.texto },
  team: { marginLeft: 8, color: APP_COLORS.texto },
  wins: { marginLeft: 8, fontWeight: '700', color: APP_COLORS.campo },
  empty: { textAlign: 'center', marginTop: 24, color: APP_COLORS.texto },
  historySection: { marginTop: 24 },
  historyTitle: { fontWeight: '800', fontSize: 16, color: APP_COLORS.texto, marginBottom: 8 },
  historyEmpty: { color: APP_COLORS.texto },
  historyCard: { backgroundColor: APP_COLORS.blanco, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: APP_COLORS.cielo },
  historyDate: { fontWeight: '700', color: APP_COLORS.campo, marginBottom: 4 },
  historyWinner: { color: APP_COLORS.texto },
});


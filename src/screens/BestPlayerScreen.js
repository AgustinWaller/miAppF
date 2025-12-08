import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image, Alert } from "react-native";
import { collection, doc, getDoc, setDoc, getDocs } from "firebase/firestore";

import { APP_COLORS } from "../theme/colors";
import { getPlayersByDivision } from "../services/players";
import { getTeamsByDivision } from "../services/teams";
import { getOpenVotacionesByDivision, listenOpenVotacionByDivision, listenVotesForVotacion } from "../services/votacion";
import { db } from "../services/firebase";
import { getPersistentDeviceId } from "../utils/device";
import { scheduleVoteReminder, cancelVoteReminder } from "../utils/notifications";
import { TEAMS_MAP } from "../data/teamsMap";

const normalizeKey = (value) => {
  const raw = String(value || "");
  if (typeof raw.normalize === "function") {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  return raw.toLowerCase();
};

export default function BestPlayerScreen() {
  const [division, setDivision] = useState("A");
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [error, setError] = useState(null);
  const [votacion, setVotacion] = useState(null);
  const [submitting, setSubmitting] = useState("");
  const [userId, setUserId] = useState("anon");
  const reminderRef = useRef({ votacionId: null, notificationId: null });
  const hydrateVotacion = useCallback(async (voteDoc) => {
    if (!voteDoc?.id) return voteDoc || null;
    const votesSnap = await getDocs(
      collection(doc(db, "votacion", String(voteDoc.id)), "votes")
    );
    const votos = votesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { ...voteDoc, votos };
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [playersList, teamsList, abertas] = await Promise.all([
        getPlayersByDivision(division, { order: "asc" }),
        getTeamsByDivision(division),
        getOpenVotacionesByDivision(division),
      ]);
      console.log(`[best-player] div=${division} players=${playersList.length} teams=${teamsList.length}`);
      const teamLookup = new Map(teamsList.map((team) => [normalizeKey(team.id), team]));
      const playersWithTeam = playersList.map((player) => {
        const normalized = normalizeKey(player.teamId);
        const teamDoc = teamLookup.get(normalized);
        const teamName =
          player.teamName ||
          teamDoc?.name ||
          TEAMS_MAP[normalized] ||
          player.teamId ||
          "";
        return { ...player, teamName };
      });
      setPlayers(playersWithTeam);
      setTeams(teamsList);
      if (!selectedTeam || !teamsList.some((team) => team.id === selectedTeam)) {
        setSelectedTeam(teamsList[0]?.id || null);
      }
      const activeVotacion = abertas && abertas[0] ? await hydrateVotacion(abertas[0]) : null;
      setVotacion(activeVotacion);
    } catch (e) {
      console.error("Error cargando jugadores", e);
      setError(e);
      setPlayers([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [division, selectedTeam, hydrateVotacion]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let unsubVotes = null;
    const unsubOpen = listenOpenVotacionByDivision(division, (docSnap) => {
      setVotacion(docSnap);
      if (unsubVotes) { unsubVotes(); unsubVotes = null; }
      if (docSnap?.id) {
        unsubVotes = listenVotesForVotacion(docSnap.id, (votes) => {
          setVotacion((prev) => (prev ? { ...prev, votos: votes } : { ...docSnap, votos: votes }));
        });
      }
    });
    return () => {
      unsubOpen && unsubOpen();
      unsubVotes && unsubVotes();
    };
  }, [division]);

  useEffect(() => {
    getPersistentDeviceId().then(setUserId).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!votacion?.id) {
        if (reminderRef.current.notificationId) {
          await cancelVoteReminder(reminderRef.current.notificationId);
          if (mounted) reminderRef.current = { votacionId: null, notificationId: null };
        }
        return;
      }
      if (reminderRef.current.votacionId === votacion.id) return;
      if (reminderRef.current.notificationId) {
        await cancelVoteReminder(reminderRef.current.notificationId);
      }
      const notificationId = await scheduleVoteReminder({
        votacionId: votacion.id,
        division,
        cierra: votacion.cierra,
      });
      if (mounted) {
        reminderRef.current = { votacionId: votacion.id, notificationId };
      }
    })();

    return () => { mounted = false; };
  }, [votacion, division]);

  useEffect(() => () => {
    if (reminderRef.current.notificationId) {
      cancelVoteReminder(reminderRef.current.notificationId).catch(() => {});
    }
  }, []);

  const yaVoto = useMemo(() => {
    const votos = votacion?.votos || [];
    return new Set(votos.filter((v) => !!v?.usuarioId).map((v) => v.usuarioId));
  }, [votacion]);

  const votosPorJugador = useMemo(() => {
    const acc = {};
    (votacion?.votos || []).forEach((v) => { acc[v.jugadorId] = (acc[v.jugadorId] || 0) + 1; });
    return acc;
  }, [votacion]);

  const top5 = useMemo(() => {
    const items = players.map((p) => ({
      id: p.id,
      nombre: p.name,
      equipo: p.teamName || "",
      votos: votosPorJugador[p.id] || 0,
    }));
    return items.sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre)).slice(0, 5);
  }, [players, votosPorJugador]);

  const filteredPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return players.filter((player) => (player.teamId || player.team_id) === selectedTeam);
  }, [players, selectedTeam]);

  const onVote = async (jugadorId) => {
    if (!votacion?.id) return;
    if (yaVoto.has(userId)) {
      Alert.alert("Voto registrado", "Ya emitiste tu voto para esta fecha.");
      return;
    }
    try {
      setSubmitting(jugadorId);
      const votesCol = collection(doc(db, "votacion", String(votacion.id)), "votes");
      const voteDocRef = doc(votesCol, String(userId));
      const existing = await getDoc(voteDocRef);
      if (existing.exists()) {
        Alert.alert("Voto registrado", "Ya emitiste tu voto para esta fecha.");
        setSubmitting("");
        return;
      }
      await setDoc(voteDocRef, { jugadorId, usuarioId: userId, createdAt: new Date() });
      const abertas = await getOpenVotacionesByDivision(division);
      const updated = abertas && abertas[0] ? await hydrateVotacion(abertas[0]) : null;
      setVotacion(updated);
    } catch (e) {
      console.error("submitVote error", e);
      Alert.alert("Error", "No se pudo registrar el voto.");
    } finally {
      setSubmitting("");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.topTitle}>Top 5 en vivo</Text>
      {votacion ? (
        <FlatList
          data={top5}
          keyExtractor={(it) => `top-${it.id}`}
          contentContainerStyle={{ paddingBottom: 8 }}
          renderItem={({ item, index }) => (
            <View style={styles.topRow}>
              <Text style={styles.topRank}>{index + 1}</Text>
              <Text style={styles.topName}>{item.nombre}</Text>
              {!!item.equipo && <Text style={styles.topTeam}>{item.equipo}</Text>}
              <Text style={styles.topVotes}>{item.votos}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Aún sin votos.</Text>}
        />
      ) : (
        <Text style={styles.empty}>Sin votación abierta.</Text>
      )}

      <View style={styles.divRow}>
        {["A", "B"].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.divBtn, division === d && styles.divBtnActive]}
            onPress={() => setDivision(d)}
          >
            <Text style={[styles.divText, division === d && styles.divTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.teamSelect}>
        <Text style={styles.teamLabel}>Seleccioná un equipo:</Text>
        <View style={styles.teamChips}>
          {teams.length ? teams.map((team) => (
            <TouchableOpacity
              key={team.id}
              style={[styles.teamChip, selectedTeam === team.id && styles.teamChipActive]}
              onPress={() => setSelectedTeam(team.id)}
            >
              <Text style={[styles.teamChipText, selectedTeam === team.id && styles.teamChipTextActive]}>
                {team.name || team.nombre || team.id}
              </Text>
            </TouchableOpacity>
          )) : (
            <Text style={styles.empty}>No hay equipos en esta división.</Text>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.campo} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={load}>Error al cargar. Toca para reintentar.</Text>
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<Text style={styles.empty}>Seleccioná un equipo para ver sus jugadores.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.avatar} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.teamName && <Text style={styles.sub}>{item.teamName}</Text>}
              </View>
              {votacion ? (
                <TouchableOpacity
                  style={[styles.voteBtn, (submitting === item.id || yaVoto.has(userId)) && { opacity: 0.6 }]}
                  disabled={!!submitting || yaVoto.has(userId)}
                  onPress={() => onVote(item.id)}
                >
                  <Text style={styles.voteText}>
                    {submitting === item.id ? "Enviando..." : yaVoto.has(userId) ? "Votado" : "Votar"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.voteBtn, { backgroundColor: "#bbb" }]}>
                  <Text style={styles.voteText}>Sin votación</Text>
                </View>
              )}
              {votacion ? (
                <Text style={styles.votesCount}>{votosPorJugador[item.id] || 0}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  topTitle: { fontWeight: "800", marginBottom: 8, color: APP_COLORS.texto },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo,
  },
  topRank: { width: 28, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo },
  topName: { flex: 1, fontWeight: "700", color: APP_COLORS.texto },
  topTeam: { marginLeft: 8, color: APP_COLORS.texto },
  topVotes: { marginLeft: 8, fontWeight: "700", color: APP_COLORS.campo },
  divRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  divBtn: {
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: APP_COLORS.blanco,
  },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  teamSelect: { marginBottom: 12 },
  teamLabel: { fontWeight: "700", color: APP_COLORS.texto, marginBottom: 6 },
  teamChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  teamChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
    backgroundColor: APP_COLORS.blanco,
  },
  teamChipActive: { backgroundColor: APP_COLORS.campo },
  teamChipText: { color: APP_COLORS.campo, fontWeight: "600" },
  teamChipTextActive: { color: APP_COLORS.blanco },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: APP_COLORS.cielo },
  name: { fontSize: 16, fontWeight: "700", color: APP_COLORS.texto },
  sub: { color: APP_COLORS.texto },
  voteBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: APP_COLORS.campo },
  voteText: { color: APP_COLORS.blanco, fontWeight: "700" },
  votesCount: { marginLeft: 8, fontWeight: "700", color: APP_COLORS.campo },
  empty: { textAlign: "center", marginTop: 32, color: APP_COLORS.texto },
});

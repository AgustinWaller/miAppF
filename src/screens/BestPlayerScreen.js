import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Image, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { collection, doc, getDoc, setDoc, getDocs } from "firebase/firestore";

import { APP_COLORS } from "../theme/colors";
import { getPlayersByDivision } from "../services/players";
import { getTeamsByDivision } from "../services/teams";
import { getOpenVotacionesByDivision, listenOpenVotacionByDivision, listenVotesForVotacion } from "../services/votacion";
import { db } from "../services/firebase";
import { getPersistentDeviceId } from "../utils/device";
import { scheduleVoteReminder, cancelVoteReminder } from "../utils/notifications";
import { TEAMS_MAP } from "../data/teamsMap";
import { safeImage, FALLBACK_PLAYER, FALLBACK_TEAM } from "../utils/images";

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
        const teamLogo = safeImage(
          teamDoc?.logoUrl || teamDoc?.logoURL || teamDoc?.logo || "",
          FALLBACK_TEAM
        );
        return { ...player, teamName, teamLogo };
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
      teamLogo: p.teamLogo,
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

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={APP_COLORS.campo} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.emptyCard} onPress={load}>Error al cargar. Toca para reintentar.</Text>
      </View>
    );
  }

  const headerComponent = (
    <>
      <LinearGradient colors={["#042C63", "#0B4FA7"]} style={styles.sectionCard}>
        <Text style={styles.topTitle}>Top 5 en vivo</Text>
        {votacion ? (
          top5.length ? (
            top5.map((item, index) => (
              <View key={`live-${item.id}`} style={styles.topRow}>
                <Text style={styles.topRank}>{index + 1}</Text>
                <View style={styles.topInfo}>
                  <Image source={item.teamLogo || safeImage("", FALLBACK_TEAM)} style={styles.topLogo} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topName}>{item.nombre}</Text>
                    {!!item.equipo && <Text style={styles.topTeam}>{item.equipo}</Text>}
                  </View>
                </View>
                <Text style={styles.topVotes}>{item.votos}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyCard}>Aun sin votos.</Text>
          )
        ) : (
          <Text style={styles.emptyCard}>Sin votacion abierta.</Text>
        )}
      </LinearGradient>

      <View style={styles.divRow}>
        {["A", "B"].map((d) => {
          const active = division === d;
          return (
            <TouchableOpacity
              key={d}
              style={[
                styles.divBtn,
                active && { backgroundColor: APP_COLORS.campo, borderColor: APP_COLORS.campo },
              ]}
              onPress={() => setDivision(d)}
            >
              <Text
                style={[
                  styles.divText,
                  active && { color: "#0b1d33", fontWeight: "800" },
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <LinearGradient colors={["#042C63", "#0B4FA7"]} style={styles.sectionCard}>
        <Text style={styles.teamLabel}>Selecciona un equipo:</Text>
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
            <Text style={styles.emptyCard}>No hay equipos en esta division.</Text>
          )}
        </View>
      </LinearGradient>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPlayers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={<Text style={styles.emptyCard}>Selecciona un equipo para ver sus jugadores.</Text>}
        renderItem={({ item }) => {
          const avatar = safeImage(item.photoUrl || item.photoURL || "", FALLBACK_PLAYER);
          return (
            <LinearGradient colors={["#042C63", "#0B4FA7"]} style={styles.card}>
              <Image source={avatar} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {!!item.teamName && <Text style={styles.sub}>{item.teamName}</Text>}
              </View>
              {votacion ? (
                <TouchableOpacity
                  style={[styles.voteBtn, (submitting === item.id || yaVoto.has(userId)) && styles.voteBtnDisabled]}
                  disabled={!!submitting || yaVoto.has(userId)}
                  onPress={() => onVote(item.id)}
                >
                  <Text style={styles.voteText}>
                    {submitting === item.id ? "Enviando..." : yaVoto.has(userId) ? "Votado" : "Votar"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.voteBtn, styles.voteBtnDisabled]}>
                  <Text style={styles.voteText}>Sin votacion</Text>
                </View>
              )}
              {votacion ? (
                <View style={styles.cardVotes}>
                  <Text style={styles.votesCount}>{votosPorJugador[item.id] || 0}</Text>
                  {item.teamLogo ? <Image source={item.teamLogo} style={styles.cardTeamLogo} /> : null}
                </View>
              ) : null}
            </LinearGradient>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  centerContent: { justifyContent: "center", alignItems: "center" },
  sectionCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#02173b",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    gap: 12,
  },
  topTitle: { fontWeight: "800", marginBottom: 8, color: "#E3F2FD", fontSize: 16 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 10,
  },
  topRank: { width: 28, textAlign: "center", fontWeight: "800", color: "#fff" },
  topInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  topLogo: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)" },
  topName: { fontWeight: "700", color: "#fff" },
  topTeam: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  topVotes: { fontWeight: "700", color: "#CDE9FF" },
  divRow: { flexDirection: "row", gap: 12, marginBottom: 12, justifyContent: "center" },
  divBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  divBtnActive: { backgroundColor: APP_COLORS.campo, borderColor: APP_COLORS.campo },
  divText: { color: "#f2f7ff", fontWeight: "800" },
  divTextActive: { color: "#0b1d33" },
  teamLabel: { fontWeight: "700", color: "#E3F2FD" },
  teamChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  teamChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  teamChipActive: { backgroundColor: APP_COLORS.campo, borderColor: APP_COLORS.campo },
  teamChipText: { color: "#d6edff" },
  teamChipTextActive: { color: "#fff", fontWeight: "700" },
  card: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  name: { fontWeight: "700", color: "#fff" },
  sub: { color: "rgba(255,255,255,0.7)" },
  voteBtn: {
    backgroundColor: APP_COLORS.campo,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  voteBtnDisabled: { opacity: 0.6 },
  voteText: { color: "#fff", fontWeight: "700" },
  cardVotes: { alignItems: "center", marginLeft: 12 },
  votesCount: { marginBottom: 4, fontWeight: "800", color: "#fff" },
  cardTeamLogo: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)" },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 20 },
  emptyCard: { textAlign: "center", color: "#dfefff", marginTop: 8 },
});





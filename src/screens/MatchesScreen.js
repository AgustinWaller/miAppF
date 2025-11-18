import React, { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { getMatchesByDivision } from "../services/matches";
import { APP_COLORS } from "../theme/colors";
import { getPlayersByDivision } from "../services/players";
import { getTeamsByDivision } from "../services/teams";

/** Convierte Timestamp/string a YYYY-MM-DD */
function fmtDate(x) {
  try {
    if (!x) return "";
    if (typeof x === "string") return x;
    if (x?.toDate) {
      const d = x.toDate();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
    return String(x);
  } catch {
    return "";
  }
}

/** Obtiene goleadores por lado a partir de eventos (si existen). */
function getScorers(match, side /* 'local' | 'visitante' */) {
  const arr = (match.eventos || []).filter((e) => e?.tipo === "gol");
  return arr
    .filter((e) => (side === "local" ? e?.golLocal === true : e?.golVisitante === true))
    .map((e) => e.jugadorId)
    .filter(Boolean);
}

export default function MatchesScreen({ route, navigation }) {
  const routeDivision = route?.params?.division ?? "A";
  const [division, setDivision] = useState(routeDivision);
  const [rows, setRows] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFecha, setSelectedFecha] = useState("ALL");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [data, playersList, teamsList] = await Promise.all([
        getMatchesByDivision(division),
        getPlayersByDivision(division),
        getTeamsByDivision(division),
      ]);
      console.log(`[matches] div=${division} items=${data.length}`);
      setRows(data);
      setPlayers(playersList);
      setTeams(teamsList);
    } catch (e) {
      console.error("Matches load error:", e);
      setError("Error al cargar");
      setRows([]);
      setPlayers([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedFecha("ALL"); }, [division]);

  const teamsMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const items = useMemo(() => rows.map((m) => {
    const localId = m.localId || m.local || "";
    const visitanteId = m.visitanteId || m.visitante || "";
    const localTeam = teamsMap.get(localId);
    const visitaTeam = teamsMap.get(visitanteId);
    return {
      id: m.id,
      fecha: fmtDate(m.dateIso || m.date_iso),
      fechaNumero: m.fechaNumero ?? null,
      local: localTeam?.name || localTeam?.nombre || localId || "Equipo local",
      visitante: visitaTeam?.name || visitaTeam?.nombre || visitanteId || "Equipo visitante",
      gl: typeof m.golesLocal === "number" ? m.golesLocal : Number(m.golesLocal || 0),
      gv: typeof m.golesVisitante === "number" ? m.golesVisitante : Number(m.golesVisitante || 0),
      scorersHome: getScorers(m, "local"),
      scorersAway: getScorers(m, "visitante"),
    };
  }), [rows, teamsMap]);

  const fechas = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.fechaNumero !== null && item.fechaNumero !== undefined) {
        set.add(item.fechaNumero);
      }
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [items]);

  useEffect(() => {
    if (selectedFecha !== "ALL" && !fechas.includes(selectedFecha)) {
      setSelectedFecha("ALL");
    }
  }, [fechas, selectedFecha]);

  const filteredItems = useMemo(() => {
    if (selectedFecha === "ALL") return items;
    return items.filter((item) => item.fechaNumero === selectedFecha);
  }, [items, selectedFecha]);

  const stats = useMemo(() => {
    if (!filteredItems.length) return { matches: 0, goles: 0 };
    const goles = filteredItems.reduce((acc, it) => acc + Number(it.gl || 0) + Number(it.gv || 0), 0);
    return { matches: filteredItems.length, goles };
  }, [filteredItems]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Text style={styles.debug}>División {division} • Partidos: {items.length}</Text>

      <View style={styles.switchRow}>
        {["A", "B"].map((d) => (
          <TouchableOpacity key={d} onPress={() => setDivision(d)} style={[styles.divBtn, division === d && styles.activeBtn]}>
            <Text style={[styles.divTxt, division === d && styles.activeTxt]}>{d}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={load} style={styles.reload}>
          <Text style={styles.reloadTxt}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fechaRow}>
        <TouchableOpacity
          style={[styles.fechaBtn, selectedFecha === "ALL" && styles.fechaBtnActive]}
          onPress={() => setSelectedFecha("ALL")}
        >
          <Text style={[styles.fechaTxt, selectedFecha === "ALL" && styles.fechaTxtActive]}>Todas</Text>
        </TouchableOpacity>
        {fechas.map((f) => (
          <TouchableOpacity
            key={`fecha-${f}`}
            style={[styles.fechaBtn, selectedFecha === f && styles.fechaBtnActive]}
            onPress={() => setSelectedFecha(f)}
          >
            <Text style={[styles.fechaTxt, selectedFecha === f && styles.fechaTxtActive]}>Fecha {f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.stats}>Partidos: {stats.matches} • Goles totales: {stats.goles}</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={load}>Error al cargar. Toca para reintentar.</Text>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("ScoreDetail", {
                division,
                match: rows.find((m) => m.id === item.id) || item,
                jugadores: players,
              })}
            >
              <Text style={styles.date}>{item.fecha}{item.fechaNumero !== null ? ` • Fecha ${item.fechaNumero}` : ""}</Text>
              <Text style={styles.title}>{item.local} {item.gl} - {item.gv} {item.visitante}</Text>
              {(item.scorersHome.length || item.scorersAway.length) ? (
                <Text style={styles.scorers}>
                  Goles: {item.scorersHome.join(", ") || "-"} vs {item.scorersAway.join(", ") || "-"}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay partidos para esta selección.</Text>}
          onRefresh={load}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#f5f5f5", padding: 12, marginBottom: 8, borderRadius: 8 },
  title: { fontWeight: "700", fontSize: 16 },
  date: { color: "#2f7d32", marginBottom: 6, fontWeight: "600" },
  scorers: { marginTop: 4, color: "#444" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  divBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#2f7d32" },
  activeBtn: { backgroundColor: "#2f7d32" },
  divTxt: { fontWeight: "700", color: "#2f7d32" },
  activeTxt: { color: "#fff" },
  reload: { marginLeft: "auto" },
  reloadTxt: { color: "#2f7d32", fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 32, color: "#333" },
  debug: { color: "#777", marginLeft: 12, marginTop: 12 },
  fechaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  fechaBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: APP_COLORS.campo },
  fechaBtnActive: { backgroundColor: APP_COLORS.campo },
  fechaTxt: { color: APP_COLORS.campo, fontWeight: "600" },
  fechaTxtActive: { color: APP_COLORS.blanco },
  stats: { color: APP_COLORS.texto, marginHorizontal: 16, marginBottom: 8, fontWeight: "600" },
});

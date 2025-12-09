// src/screens/StandingsScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Share,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { APP_COLORS } from "../theme/colors";
import { getMatchesByDivision } from "../services/matches";
import { getTeamsByDivision } from "../services/teams";
import { TEAMS_MAP } from "../data/teamsMap";
import { safeImage, FALLBACK_TEAM } from "../utils/images";

const normalizeKey = (value) => {
  const raw = String(value || "");
  if (typeof raw.normalize === "function") {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  return raw.toLowerCase();
};

const TEAM_NAME_LOOKUP = Object.entries(TEAMS_MAP).reduce((acc, [key, value]) => {
  acc[normalizeKey(key)] = value;
  return acc;
}, {});

const resolveTeamName = (teamId, rawName) => {
  if (rawName) return rawName;
  const normalized = normalizeKey(teamId);
  return TEAM_NAME_LOOKUP[normalized] || TEAM_NAME_LOOKUP[teamId] || teamId || "Equipo";
};

const STAT_FIELDS = [
  { key: "pj", label: "PJ" },
  { key: "pg", label: "PG" },
  { key: "pe", label: "PE" },
  { key: "pp", label: "PP" },
  { key: "gf", label: "GF" },
  { key: "gc", label: "GC" },
  { key: "dg", label: "DG" },
  { key: "pts", label: "PTS" },
];
const STAT_CELL_WIDTH = 54;

function buildTableFromMatches(matches) {
  const table = new Map();
  const ensure = (teamId, name = teamId) => {
    if (!table.has(teamId)) {
      table.set(teamId, { teamId, name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 });
    }
    return table.get(teamId);
  };

  matches.forEach((m) => {
    const L = ensure(m.localId, resolveTeamName(m.localId, m.localName));
    const V = ensure(m.visitanteId, resolveTeamName(m.visitanteId, m.visitanteName));

    const gl = Number(m.golesLocal ?? 0);
    const gv = Number(m.golesVisitante ?? 0);

    L.pj += 1;
    V.pj += 1;
    L.gf += gl;
    L.gc += gv;
    V.gf += gv;
    V.gc += gl;
    L.dg = L.gf - L.gc;
    V.dg = V.gf - V.gc;

    if (gl > gv) {
      L.pg += 1;
      V.pp += 1;
      L.pts += 3;
    } else if (gl < gv) {
      V.pg += 1;
      L.pp += 1;
      V.pts += 3;
    } else {
      L.pe += 1;
      V.pe += 1;
      L.pts += 1;
      V.pts += 1;
    }
  });

  return Array.from(table.values()).sort(
    (a, b) =>
      b.pts - a.pts ||
      b.dg - a.dg ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name)
  );
}

export default function StandingsScreen() {
  const [division, setDivision] = useState("A");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [teamDocs, setTeamDocs] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [matches, teams] = await Promise.all([
        getMatchesByDivision(division, { order: "asc" }),
        getTeamsByDivision(division),
      ]);
      setTeamDocs(teams);
      setRows(buildTableFromMatches(matches));
    } catch (e) {
      console.error("Error cargando tabla", e);
      setError("Error al cargar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => {
    load();
  }, [load]);

  const teamsLookup = useMemo(() => {
    const map = new Map();
    teamDocs.forEach((team) => {
      map.set(team.id, team);
      map.set(normalizeKey(team.id), team);
    });
    return map;
  }, [teamDocs]);

  const shareStandings = useCallback(() => {
    if (!rows.length) return;
    const payload = rows
      .slice(0, 10)
      .map(
        (team, idx) =>
          `${idx + 1}. ${team.name} - ${team.pts} pts (PJ ${team.pj}, GF ${team.gf}, GC ${team.gc})`
      )
      .join("\n");
    Share.share({
      title: `Tabla Division ${division}`,
      message: `Tabla Division ${division}\n${payload}`,
    }).catch(() => {});
  }, [rows, division]);

  const renderRow = ({ item, index }) => {
    const doc =
      teamsLookup.get(item.teamId) ||
      teamsLookup.get(normalizeKey(item.teamId));
    const logo = safeImage(
      doc?.logoUrl || doc?.logoURL || doc?.logo || "",
      { uri: FALLBACK_TEAM }
    );
    return (
      <View style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
        <View style={styles.teamCol}>
          <Image source={logo} style={styles.teamLogo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.teamPos}>#{index + 1}</Text>
          </View>
        </View>
        {STAT_FIELDS.map((field, idx) => (
          <View
            key={field.key}
            style={[
              styles.statCellWrapper,
              idx > 0 && styles.statSeparator,
              field.key === "pts" && styles.pointsWrapper,
            ]}
          >
            <Text style={[styles.statCell, field.key === "pts" && styles.pointsCell]}>
              {item[field.key]}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
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

        <TouchableOpacity style={styles.shareBtn} onPress={shareStandings} disabled={!rows.length}>
          <Text style={styles.shareText}>Compartir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.campo} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={load}>
          {error}. Toca para reintentar.
        </Text>
      ) : (
        <LinearGradient colors={["#042C63", "#0B4FA7"]} style={styles.tableCard}>
          <Text style={styles.tableTitle}>Tabla de posiciones</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tableInner}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, styles.headerTeam]}>Equipo</Text>
                {STAT_FIELDS.map((field, idx) => (
                  <View
                    key={field.key}
                    style={[
                      styles.headerStatCell,
                      idx > 0 && styles.headerDivider,
                      field.key === "pts" && styles.pointsHeaderCell,
                    ]}
                  >
                    <Text style={[styles.headerCell, field.key === "pts" && styles.pointsCell]}>
                      {field.label}
                    </Text>
                  </View>
                ))}
              </View>
              <FlatList
                data={rows}
                keyExtractor={(r) => r.teamId}
                renderItem={renderRow}
                ListEmptyComponent={<Text style={styles.empty}>Sin datos.</Text>}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            </View>
          </ScrollView>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  divRow: { flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "center" },
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
  shareBtn: {
    marginLeft: "auto",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
    backgroundColor: APP_COLORS.blanco,
  },
  shareText: { color: APP_COLORS.campo, fontWeight: "700" },
  tableCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    padding: 12,
    shadowColor: "#02173b",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  tableInner: { paddingRight: 16, minWidth: 680 },
  tableTitle: {
    textAlign: "center",
    color: APP_COLORS.texto,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11,36,16,0.35)",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
    columnGap: 6,
  },
  headerCell: { color: APP_COLORS.blanco, fontWeight: "700", fontSize: 11 },
  headerTeam: { width: 220, textAlign: "left" },
  headerStatCell: {
    minWidth: STAT_CELL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerDivider: { borderLeftWidth: 0.5, borderColor: "rgba(255,255,255,0.25)" },
  pointsHeaderCell: { backgroundColor: "rgba(11,79,167,0.35)" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
    columnGap: 6,
  },
  rowEven: { backgroundColor: "rgba(255,255,255,0.65)" },
  rowOdd: { backgroundColor: "rgba(236,249,238,0.9)" },
  teamCol: { flexDirection: "row", alignItems: "center", gap: 8, width: 220, flexShrink: 0 },
  teamLogo: { width: 36, height: 36, borderRadius: 18, backgroundColor: APP_COLORS.cielo },
  teamName: { color: APP_COLORS.texto, fontWeight: "700", fontSize: 13, maxWidth: 170 },
  teamPos: { color: APP_COLORS.texto, fontSize: 11, opacity: 0.65 },
  statCellWrapper: {
    minWidth: STAT_CELL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  statSeparator: { borderLeftWidth: 0.5, borderColor: "rgba(8,45,99,0.18)" },
  statCell: {
    textAlign: "center",
    color: APP_COLORS.texto,
    fontSize: 12,
    fontWeight: "600",
  },
  pointsWrapper: { backgroundColor: "rgba(4,44,99,0.08)", borderRadius: 6 },
  pointsCell: { color: APP_COLORS.campo, fontWeight: "800" },
  empty: { textAlign: "center", marginTop: 32, color: APP_COLORS.texto },
});

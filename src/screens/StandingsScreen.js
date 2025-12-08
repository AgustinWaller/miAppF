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
      title: `Tabla División ${division}`,
      message: `Tabla División ${division}\n${payload}`,
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
        <Text style={styles.statCell}>{item.pj}</Text>
        <Text style={styles.statCell}>{item.pg}</Text>
        <Text style={styles.statCell}>{item.pe}</Text>
        <Text style={styles.statCell}>{item.pp}</Text>
        <Text style={styles.statCell}>{item.gf}</Text>
        <Text style={styles.statCell}>{item.gc}</Text>
        <Text style={styles.statCell}>{item.dg}</Text>
        <Text style={[styles.statCell, styles.pointsCell]}>{item.pts}</Text>
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
        <View style={styles.tableCard}>
          <Text style={styles.tableTitle}>Tabla de posiciones</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tableInner}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, styles.headerTeam]}>Equipo</Text>
                {["PJ", "PG", "PE", "PP", "GF", "GC", "DG", "PTS"].map((label) => (
                  <Text key={label} style={styles.headerCell}>
                    {label}
                  </Text>
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
        </View>
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
    backgroundColor: "rgba(37,110,55,0.15)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_COLORS.campo,
    padding: 12,
    shadowColor: "#0c3d19",
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  tableInner: { paddingRight: 16, minWidth: 600 },
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
  },
  headerCell: {
    minWidth: 26,
    textAlign: "center",
    color: APP_COLORS.blanco,
    fontWeight: "700",
    fontSize: 10,
  },
  headerTeam: { flex: 1.6, textAlign: "left" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  rowEven: { backgroundColor: "rgba(255,255,255,0.65)" },
  rowOdd: { backgroundColor: "rgba(236,249,238,0.9)" },
  teamCol: { flexDirection: "row", alignItems: "center", flex: 1.6, gap: 8 },
  teamLogo: { width: 36, height: 36, borderRadius: 18, backgroundColor: APP_COLORS.cielo },
  teamName: { color: APP_COLORS.texto, fontWeight: "700", fontSize: 13 },
  teamPos: { color: APP_COLORS.texto, fontSize: 11, opacity: 0.65 },
  statCell: {
    minWidth: 24,
    textAlign: "center",
    color: APP_COLORS.texto,
    fontSize: 11,
    fontWeight: "600",
  },
  pointsCell: { color: APP_COLORS.campo, fontWeight: "800" },
  empty: { textAlign: "center", marginTop: 32, color: APP_COLORS.texto },
});

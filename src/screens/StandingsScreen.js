// src/screens/StandingsScreen.js
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { APP_COLORS } from "../theme/colors";
import { getMatchesByDivision } from "../services/matches"; // <- ya lo tienes

// Util: calcula tabla a partir de la lista de partidos
function buildTableFromMatches(matches) {
  const table = new Map();
  const ensure = (teamId, name = teamId) => {
    if (!table.has(teamId)) {
      table.set(teamId, { teamId, name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 });
    }
    return table.get(teamId);
  };

  for (const m of matches) {
    // Campos esperados en cada documento:
    // divisionId, dateIso, localId, visitanteId, golesLocal, golesVisitante, (opcional: localName, visitanteName)
    const L = ensure(m.localId, m.localName || m.localId);
    const V = ensure(m.visitanteId, m.visitanteName || m.visitanteId);

    const gl = Number(m.golesLocal ?? 0);
    const gv = Number(m.golesVisitante ?? 0);

    L.pj++; V.pj++;
    L.gf += gl; L.gc += gv; L.dg = L.gf - L.gc;
    V.gf += gv; V.gc += gl; V.dg = V.gf - V.gc;

    if (gl > gv) { L.pg++; V.pp++; L.pts += 3; }
    else if (gl < gv) { V.pg++; L.pp++; V.pts += 3; }
    else { L.pe++; V.pe++; L.pts += 1; V.pts += 1; }
  }

  // Orden estándar: puntos, diferencia, goles a favor, nombre
  return Array.from(table.values()).sort((a, b) =>
    b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name)
  );
}

export default function StandingsScreen() {
  const [division, setDivision] = useState("A");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      // OJO con el orden: usa 'asc' si tu índice es ascendente; si lo cambiaste a desc, ajusta en services/matches.
      const list = await getMatchesByDivision(division, { order: "asc" });
      setRows(buildTableFromMatches(list));
    } catch (e) {
      console.error("Error cargando tabla", e);
      setError(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [division]);

  const header = useMemo(() => (
    <View style={[styles.row, styles.header]}>
      <Text style={[styles.cellTeam, styles.bold]}>Equipo</Text>
      <Text style={[styles.cell, styles.bold]}>PJ</Text>
      <Text style={[styles.cell, styles.bold]}>PTS</Text>
      <Text style={[styles.cell, styles.bold]}>DG</Text>
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <View style={styles.divRow}>
        {["A","B"].map(d => (
          <TouchableOpacity key={d}
            style={[styles.divBtn, division === d && styles.divBtnActive]}
            onPress={() => setDivision(d)}>
            <Text style={[styles.divText, division === d && styles.divTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={APP_COLORS.campo} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.empty} onPress={load}>Error al cargar. Toca para reintentar.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.teamId}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.cellTeam}>{item.name}</Text>
              <Text style={styles.cell}>{item.pj}</Text>
              <Text style={styles.cell}>{item.pts}</Text>
              <Text style={styles.cell}>{item.dg}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Sin datos.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  divRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  divBtn: { borderWidth: 1, borderColor: APP_COLORS.campo, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  header: { backgroundColor: APP_COLORS.cielo, borderRadius: 10 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: APP_COLORS.cielo },
  cellTeam: { flex: 1.6, color: APP_COLORS.texto },
  cell: { width: 48, textAlign: "right", color: APP_COLORS.texto },
  bold: { fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 32, color: APP_COLORS.texto },
});

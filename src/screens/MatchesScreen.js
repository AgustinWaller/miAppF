import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import {
  getDivisionData,
  getUltimaFechaNumero,
  partidosPorFecha,
  nombreEquipo,
  getJugador,
} from "../utils/storage";
import { APP_COLORS } from "../theme/colors";

const DIVISIONES = ["A", "B"];

export default function MatchesScreen({ route, navigation }) {
  const routeDivision = route?.params?.division ?? "A";
  const [division, setDivision] = useState(routeDivision);
  const [fechaSel, setFechaSel] = useState(() => getUltimaFechaNumero(routeDivision) || 1);

  useEffect(() => {
    if (routeDivision !== division) {
      setDivision(routeDivision);
    }
  }, [routeDivision]);

  useEffect(() => {
    navigation?.setParams?.({ division });
  }, [division, navigation]);

  const divisionData = useMemo(() => getDivisionData(division) || { partidos: [] }, [division]);

  const fechas = useMemo(() => {
    const lista = [...new Set((divisionData.partidos || []).map((match) => match.fechaNumero))]
      .filter((num) => typeof num === "number" && !Number.isNaN(num))
      .sort((a, b) => a - b);
    return lista;
  }, [divisionData]);

  useEffect(() => {
    if (fechas.length === 0) return;
    if (!fechas.includes(fechaSel)) {
      setFechaSel(fechas[fechas.length - 1]);
    }
  }, [fechas, fechaSel]);

  const partidos = useMemo(() => partidosPorFecha(division, fechaSel), [division, fechaSel]);

  const goHome = () => navigation.navigate("Noticias", { division });

  const getScorers = (match, teamId) => {
    return (match.eventos || [])
      .filter((evt) => evt.tipo === "gol")
      .map((evt) => ({ evt, player: getJugador(division, evt.jugadorId) }))
      .filter((data) => data.player && data.player.equipoId === teamId)
      .map((data) => data.player.nombre);
  };

  const renderMatch = ({ item }) => {
    const localName = nombreEquipo(division, item.localId);
    const visitaName = nombreEquipo(division, item.visitanteId);
    const localGoals = getScorers(item, item.localId);
    const visitaGoals = getScorers(item, item.visitanteId);

    return (
      <View style={styles.matchCard}>
        <View style={styles.scoreRow}>
          <Text style={styles.teamName}>{localName}</Text>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreText}>{item.golesLocal}</Text>
            <Text style={styles.scoreDivider}>-</Text>
            <Text style={styles.scoreText}>{item.golesVisitante}</Text>
          </View>
          <Text style={styles.teamName}>{visitaName}</Text>
        </View>
        {item.fechaCalendario ? (
          <Text style={styles.dateText}>Jugado el {item.fechaCalendario}</Text>
        ) : null}

        <View style={styles.goalsSection}>
          <Text style={styles.goalsTitle}>Goles {localName}</Text>
          {localGoals.length === 0 ? (
            <Text style={styles.goalLine}>Sin goles</Text>
          ) : (
            localGoals.map((nombre, index) => (
              <Text key={`${item.id}-loc-${index}`} style={styles.goalLine}>
                • {nombre}
              </Text>
            ))
          )}
        </View>

        <View style={styles.goalsSection}>
          <Text style={styles.goalsTitle}>Goles {visitaName}</Text>
          {visitaGoals.length === 0 ? (
            <Text style={styles.goalLine}>Sin goles</Text>
          ) : (
            visitaGoals.map((nombre, index) => (
              <Text key={`${item.id}-vis-${index}`} style={styles.goalLine}>
                • {nombre}
              </Text>
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.detailBtn}
          onPress={() => navigation.navigate("ScoreDetail", { division, match: item })}
        >
          <Text style={styles.detailText}>Ver detalle</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={goHome}>
          <Text style={styles.actionText}>Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.openDrawer()}>
          <Text style={styles.actionText}>Menu</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Partidos - Division {division}</Text>

      <View style={styles.divisionRow}>
        {DIVISIONES.map((key) => (
          <TouchableOpacity
            key={key}
            onPress={() => setDivision(key)}
            style={[styles.divBtn, division === key && styles.divBtnActive]}
          >
            <Text style={[styles.divText, division === key && styles.divTextActive]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {fechas.length === 0 ? (
        <Text style={styles.empty}>No hay datos para esta division.</Text>
      ) : (
        <>
          <View style={styles.fechasRow}>
            {fechas.map((num) => (
              <TouchableOpacity
                key={num}
                onPress={() => setFechaSel(num)}
                style={[styles.fechaBtn, fechaSel === num && styles.fechaBtnActive]}
              >
                <Text style={[styles.fechaText, fechaSel === num && styles.fechaTextActive]}>Fecha {num}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={partidos}
            keyExtractor={(item) => item.id}
            renderItem={renderMatch}
            contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 12, color: APP_COLORS.texto, textAlign: "center" },
  divisionRow: { flexDirection: "row", gap: 12, marginBottom: 12, justifyContent: "center" },
  divBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  fechasRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16, justifyContent: "center" },
  fechaBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: APP_COLORS.cielo, backgroundColor: APP_COLORS.blanco },
  fechaBtnActive: { backgroundColor: APP_COLORS.campo, borderColor: APP_COLORS.campo },
  fechaText: { color: APP_COLORS.texto, fontWeight: "700" },
  fechaTextActive: { color: APP_COLORS.blanco },
  matchCard: { backgroundColor: APP_COLORS.blanco, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: APP_COLORS.campo, gap: 12 },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teamName: { flex: 1, fontWeight: "700", color: APP_COLORS.texto },
  scoreBox: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: APP_COLORS.cielo },
  scoreText: { fontSize: 18, fontWeight: "800", color: APP_COLORS.texto },
  scoreDivider: { fontSize: 18, fontWeight: "800", color: APP_COLORS.texto },
  dateText: { color: APP_COLORS.campo, fontWeight: "600" },
  goalsSection: { backgroundColor: "#E3F2FD", borderRadius: 16, padding: 12 },
  goalsTitle: { fontWeight: "700", marginBottom: 6, color: APP_COLORS.texto },
  goalLine: { color: APP_COLORS.texto },
  detailBtn: { alignSelf: "flex-end", backgroundColor: APP_COLORS.campo, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  detailText: { color: APP_COLORS.blanco, fontWeight: "700" },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 24 },
});

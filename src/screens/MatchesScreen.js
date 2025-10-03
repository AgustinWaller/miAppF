import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  getDivisionData,
  getUltimaFechaNumero,
  partidosPorFecha,
  nombreEquipo,
  getJugador,
} from "../utils/storage";
import { APP_COLORS } from "../theme/colors";
import { getClubLogo } from "../assets/images";

const DIVISIONES = ["A", "B"];
const MAX_SCORERS_DISPLAY = 3;

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
    return [...new Set((divisionData.partidos || []).map((match) => match.fechaNumero))]
      .filter((num) => typeof num === "number" && !Number.isNaN(num))
      .sort((a, b) => a - b);
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

  const renderScorersCompact = (list) => {
    if (list.length === 0) return "Sin goles";
    if (list.length <= MAX_SCORERS_DISPLAY) return list.join(", ");
    return `${list.slice(0, MAX_SCORERS_DISPLAY).join(", ")} (+${list.length - MAX_SCORERS_DISPLAY})`;
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "";
    const [yyyy, mm, dd] = fecha.split("-");
    return `${dd}/${mm}`;
  };

  const renderMatch = ({ item }) => {
    const localName = nombreEquipo(division, item.localId);
    const visitaName = nombreEquipo(division, item.visitanteId);
    const localGoals = getScorers(item, item.localId);
    const visitaGoals = getScorers(item, item.visitanteId);
    const localLogo = getClubLogo(item.localId);
    const visitaLogo = getClubLogo(item.visitanteId);

    return (
      <View style={styles.matchCard}>
        <LinearGradient
          colors={["#021B79", "#0575E6", "#021B79"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scoreboard}
        >
          <View style={[styles.sidePanel, styles.sidePanelLeft]}>
            <View style={styles.teamBadge}>
              <Image source={localLogo} style={styles.teamLogo} />
            </View>
            <Text style={[styles.teamLabel, { textAlign: "left" }]}>{localName}</Text>
            <Text style={[styles.scorersSmall, { textAlign: "left" }]}>{renderScorersCompact(localGoals)}</Text>
          </View>

          <View style={styles.centerStack}>
            <Text style={styles.scoreNumber}>{item.golesLocal}</Text>
            <View style={styles.minuteBubble}>
              <Text style={styles.minuteText}>
                {item.fechaCalendario ? formatFecha(item.fechaCalendario) : `F${item.fechaNumero}`}
              </Text>
            </View>
            <Text style={styles.scoreNumber}>{item.golesVisitante}</Text>
          </View>

          <View style={[styles.sidePanel, styles.sidePanelRight]}>
            <View style={styles.teamBadge}>
              <Image source={visitaLogo} style={styles.teamLogo} />
            </View>
            <Text style={[styles.teamLabel, { textAlign: "right" }]}>{visitaName}</Text>
            <Text style={[styles.scorersSmall, { textAlign: "right" }]}>{renderScorersCompact(visitaGoals)}</Text>
          </View>
        </LinearGradient>

        <Text style={styles.metaText}>
          {`Fecha ${item.fechaNumero}`} {item.fechaCalendario ? `• Jugado el ${item.fechaCalendario}` : ""}
        </Text>

        <View style={styles.scorersRow}>
          <View style={styles.scorersColumn}>
            <Text style={styles.scorersTitle}>Goles {localName}</Text>
            {localGoals.length === 0 ? (
              <Text style={styles.scorerLine}>Sin goles</Text>
            ) : (
              localGoals.map((nombre, index) => (
                <Text key={`${item.id}-loc-${index}`} style={styles.scorerLine}>
                  - {nombre}
                </Text>
              ))
            )}
          </View>

          <View style={styles.scorersColumn}>
            <Text style={styles.scorersTitle}>Goles {visitaName}</Text>
            {visitaGoals.length === 0 ? (
              <Text style={styles.scorerLine}>Sin goles</Text>
            ) : (
              visitaGoals.map((nombre, index) => (
                <Text key={`${item.id}-vis-${index}`} style={styles.scorerLine}>
                  - {nombre}
                </Text>
              ))
            )}
          </View>
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
  divBtn: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 6, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  fechasRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16, justifyContent: "center" },
  fechaBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: APP_COLORS.cielo, backgroundColor: APP_COLORS.blanco },
  fechaBtnActive: { backgroundColor: APP_COLORS.campo, borderColor: APP_COLORS.campo },
  fechaText: { color: APP_COLORS.texto, fontWeight: "700" },
  fechaTextActive: { color: APP_COLORS.blanco },
  matchCard: {
    backgroundColor: "#06142E",
    borderRadius: 26,
    padding: 18,
    borderWidth: 2,
    borderColor: "#0B2A5B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  scoreboard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  sidePanel: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  sidePanelLeft: {
    alignItems: "flex-start",
  },
  sidePanelRight: {
    alignItems: "flex-end",
  },
  teamBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  teamLogo: { width: 48, height: 48, resizeMode: "contain" },
  teamLabel: { color: "#F3F7FF", fontWeight: "700", fontSize: 14 },
  scorersSmall: { color: "#CCE7FF", fontSize: 12 },
  centerStack: {
    width: 150,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginHorizontal: 8,
  },
  scoreNumber: { fontSize: 30, fontWeight: "900", color: "#FFFFFF" },
  minuteBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  minuteText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  metaText: {
    marginTop: 12,
    color: APP_COLORS.cielo,
    fontWeight: "600",
    textAlign: "center",
  },
  scorersRow: {
    flexDirection: "row",
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  scorersColumn: { flex: 1 },
  scorersTitle: { color: "#BBDEFB", fontWeight: "700", marginBottom: 6 },
  scorerLine: { color: "#E3F2FD", marginBottom: 2 },
  detailBtn: {
    marginTop: 16,
    alignSelf: "flex-end",
    backgroundColor: APP_COLORS.campo,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  detailText: { color: APP_COLORS.blanco, fontWeight: "700" },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 24 },
});

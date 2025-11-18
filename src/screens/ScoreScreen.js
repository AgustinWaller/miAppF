import React, { useMemo } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { APP_COLORS } from "../theme/colors";

export default function ScoreScreen({ route, navigation }) {
  const division = route?.params?.division ?? "A";
  const match = route?.params?.match;
  const jugadores = route?.params?.jugadores || [];

  const playerMap = useMemo(() => {
    return new Map(
      jugadores.map((player) => [player.id, player.name || player.nombre || player.displayName])
    );
  }, [jugadores]);

  const goHome = () => navigation.navigate("Noticias", { division });

  if (!match) {
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
        <Text style={styles.title}>No se recibieron datos del partido.</Text>
      </View>
    );
  }

  const local = match.localName || match.local || "";
  const visitante = match.visitaName || match.visitante || "";

  const getNombreJugador = (jugadorId) => playerMap.get(jugadorId) || jugadorId;

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

      <Text style={styles.title}>Detalle de partido</Text>
      <Text style={styles.score}>
        {local} {match.golesLocal} - {match.golesVisitante} {visitante}
      </Text>
      {match.fechaCalendario ? (
        <Text style={styles.date}>Jugado el {match.fechaCalendario}</Text>
      ) : null}

      <Text style={styles.subtitle}>Eventos</Text>
      <FlatList
        data={match.eventos || []}
        keyExtractor={(_, index) => `${match.id}-ev-${index}`}
        renderItem={({ item }) => (
          <View style={styles.eventRow}>
            <Text style={styles.eventType}>{item.tipo}</Text>
            <Text style={styles.eventInfo}>{getNombreJugador(item.jugadorId)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay eventos para este partido.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 8, color: APP_COLORS.texto, textAlign: "center" },
  score: { fontSize: 18, fontWeight: "700", marginBottom: 4, color: APP_COLORS.texto, textAlign: "center" },
  date: { color: APP_COLORS.campo, marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 16, fontWeight: "700", marginBottom: 8, marginTop: 12, color: APP_COLORS.texto },
  eventRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 0.5, borderColor: "#C8E6C9", backgroundColor: APP_COLORS.blanco, borderRadius: 12, marginBottom: 8 },
  eventType: { fontWeight: "700", color: APP_COLORS.campo },
  eventInfo: { color: APP_COLORS.texto },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 12 },
});

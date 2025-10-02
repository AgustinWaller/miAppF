import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from "react-native";
import { calcularGoleadores } from "../utils/storage";
import { APP_COLORS } from "../theme/colors";

export default function TopPlayersScreen({ route, navigation }) {
  const routeDivision = route?.params?.division ?? "A";
  const [division, setDivision] = useState(routeDivision);

  useEffect(() => {
    if (routeDivision !== division) {
      setDivision(routeDivision);
    }
  }, [routeDivision]);

  useEffect(() => {
    navigation?.setParams?.({ division });
  }, [division, navigation]);

  const goleadores = useMemo(() => calcularGoleadores(division), [division]);

  const goHome = () => navigation.navigate("Noticias", { division });

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

      <Text style={styles.title}>Goleadores - Division {division}</Text>

      <View style={styles.divRow}>
        {(["A", "B"]).map((key) => (
          <TouchableOpacity
            key={key}
            onPress={() => setDivision(key)}
            style={[styles.divBtn, division === key && styles.divBtnActive]}
          >
            <Text style={[styles.divText, division === key && styles.divTextActive]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={goleadores}
        keyExtractor={(item) => item.jugadorId}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item, index }) => (
          <View style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
            <Text style={styles.pos}>{index + 1}</Text>
            <Image source={{ uri: item.foto }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.nombre}</Text>
              <Text style={styles.team}>{item.equipo}</Text>
            </View>
            <Text style={styles.goals}>{item.goles}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay datos para esta division.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: APP_COLORS.fondo },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 12, color: APP_COLORS.texto, textAlign: "center" },
  divRow: { flexDirection: "row", gap: 12, marginBottom: 12, justifyContent: "center" },
  divBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5, borderColor: "#C8E6C9", paddingHorizontal: 12, borderRadius: 12, marginBottom: 8 },
  rowEven: { backgroundColor: APP_COLORS.blanco },
  rowOdd: { backgroundColor: "#E3F2FD" },
  pos: { width: 28, textAlign: "center", fontWeight: "700", color: APP_COLORS.campo },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10, backgroundColor: APP_COLORS.cielo },
  name: { fontWeight: "700", color: APP_COLORS.texto },
  team: { color: "#2F4F4F", fontSize: 12 },
  goals: { width: 36, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 20 },
});

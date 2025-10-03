import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from "react-native";
import { calcularGoleadores } from "../utils/storage";
import { APP_COLORS } from "../theme/colors";
import { getPlayerPhoto } from "../assets/images";

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

  const renderItem = ({ item, index }) => {
    const photo = getPlayerPhoto(item.jugadorId);
    return (
      <View style={[styles.row, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
        <Text style={styles.pos}>{index + 1}</Text>
        <Image source={photo} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.nombre}</Text>
          <Text style={styles.team}>{item.equipo}</Text>
        </View>
        <Text style={styles.goals}>{item.goles}</Text>
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
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No hay datos para esta division.</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
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
  divBtn: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  rowEven: { backgroundColor: APP_COLORS.blanco },
  rowOdd: { backgroundColor: "#E3F2FD" },
  pos: { width: 32, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo, fontSize: 16 },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12, backgroundColor: APP_COLORS.cielo },
  name: { fontWeight: "700", fontSize: 16, color: APP_COLORS.texto },
  team: { color: "#2F4F4F", fontSize: 12 },
  goals: { width: 40, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo, fontSize: 16 },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 20 },
});

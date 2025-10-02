import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { getDivisionData } from "../utils/storage";
import { APP_COLORS } from "../theme/colors";

export default function TeamsScreen({ route, navigation }) {
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

  const teams = useMemo(() => getDivisionData(division)?.equipos || [], [division]);

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

      <Text style={styles.title}>Equipos - Division {division}</Text>

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
        data={teams}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("TeamDetail", { division, teamId: item.id })}
          >
            <Text style={styles.teamName}>{item.nombre}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay equipos para esta division.</Text>}
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
  card: { flex: 1, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco, alignItems: "center", justifyContent: "center" },
  teamName: { fontSize: 16, fontWeight: "700", color: APP_COLORS.texto },
  empty: { textAlign: "center", color: APP_COLORS.texto, marginTop: 20 },
});

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getUltimaFechaNumero } from "../utils/storage";
import { APP_COLORS } from "../theme/colors";

export default function HomeScreen({ route, navigation }) {
  const initialDivision = route?.params?.division ?? "A";
  const [division, setDivision] = React.useState(initialDivision);

  useFocusEffect(
    React.useCallback(() => {
      if (route?.params?.division && route.params.division !== division) {
        setDivision(route.params.division);
      }
    }, [route?.params?.division, division])
  );

  React.useEffect(() => {
    navigation.setParams({ division });
  }, [division, navigation]);

  const ultima = getUltimaFechaNumero(division);

  const goTo = (screen) => {
    navigation.navigate(screen, { division });
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Noticias", { division })}>
          <Text style={styles.actionText}>Noticias</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.openDrawer()}>
          <Text style={styles.actionText}>Menu</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Liga Local - Division {division}</Text>

      <View style={styles.row}>
        {(["A", "B"]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.divBtn, division === key && styles.active]}
            onPress={() => setDivision(key)}
          >
            <Text style={[styles.divText, division === key && styles.divTextActive]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.info}>Ultima fecha disputada: {ultima}</Text>

      <View style={styles.links}>
        {[
          { screen: "Partidos", label: "Partidos" },
          { screen: "Tabla de posiciones", label: "Tabla de posiciones" },
          { screen: "Goleadores", label: "Goleadores" },
          { screen: "Jugador de la fecha", label: "Jugador de la fecha" },
          { screen: "Equipos", label: "Equipos" },
        ].map((item) => (
          <TouchableOpacity key={item.screen} style={styles.linkBtn} onPress={() => goTo(item.screen)}>
            <Text style={styles.linkText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: APP_COLORS.fondo },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center", color: APP_COLORS.texto },
  row: { flexDirection: "row", justifyContent: "center", marginBottom: 16, gap: 12 },
  divBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  active: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "bold" },
  divTextActive: { color: APP_COLORS.blanco },
  info: { textAlign: "center", marginVertical: 10, color: APP_COLORS.texto },
  links: { marginTop: 20, gap: 12 },
  linkBtn: { backgroundColor: APP_COLORS.campo, padding: 14, borderRadius: 12 },
  linkText: { color: APP_COLORS.blanco, textAlign: "center", fontWeight: "600" },
});

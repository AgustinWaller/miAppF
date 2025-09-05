import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { getUltimaFechaNumero } from "../utils/storage";

export default function HomeScreen({ division, setDivision, navigation }) {
  const ultima = getUltimaFechaNumero(division);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Liga Local — Divisional {division}</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.divBtn, division === "A" && styles.active]}
          onPress={() => setDivision("A")}
        >
          <Text style={styles.divText}>A</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.divBtn, division === "B" && styles.active]}
          onPress={() => setDivision("B")}
        >
          <Text style={styles.divText}>B</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.info}>Última fecha disputada: {ultima}</Text>

      <View style={styles.links}>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate("Partidos")}>
          <Text style={styles.linkText}>Ver Partidos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate("Tabla de posiciones")}>
          <Text style={styles.linkText}>Tabla de posiciones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate("Goleadores")}>
          <Text style={styles.linkText}>Goleadores</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate("Mejor jugador de la fecha")}>
          <Text style={styles.linkText}>Jugador de la fecha</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:20, justifyContent:"center" },
  title:{ fontSize:24, fontWeight:"bold", marginBottom:20, textAlign:"center" },
  row:{ flexDirection:"row", justifyContent:"center", marginBottom:10, gap:12 },
  divBtn:{ paddingVertical:10, paddingHorizontal:20, borderRadius:10, borderWidth:1 },
  active:{ backgroundColor:"#1e1e1e", borderColor:"#1e1e1e" },
  divText:{ color:"#000", fontWeight:"bold" },
  info:{ textAlign:"center", marginVertical:10 },
  links:{ marginTop:20, gap:10 },
  linkBtn:{ backgroundColor:"#1e1e1e", padding:14, borderRadius:12 },
  linkText:{ color:"#fff", textAlign:"center", fontWeight:"600" }
});

import React from "react";
import { View, Text, FlatList, Image, StyleSheet } from "react-native";
import { calcularGoleadores } from "../utils/storage";

export default function ScorersScreen({ division }) {
  const list = calcularGoleadores(division);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Goleadores — Divisional {division}</Text>
      <FlatList
        data={list}
        keyExtractor={(item) => item.jugadorId}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.pos}>{index + 1}</Text>
            <Image source={{ uri: item.foto }} style={styles.avatar} />
            <View style={{ flex:1 }}>
              <Text style={styles.name}>{item.nombre}</Text>
              <Text style={styles.team}>{item.equipo}</Text>
            </View>
            <Text style={styles.goals}>{item.goles}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:16 },
  title:{ fontSize:20, fontWeight:"bold", marginBottom:12 },
  row:{ flexDirection:"row", alignItems:"center", paddingVertical:10, borderBottomWidth:0.5 },
  pos:{ width:24, textAlign:"center", fontWeight:"600" },
  avatar:{ width:40, height:40, borderRadius:20, marginRight:10 },
  name:{ fontWeight:"600" },
  team:{ color:"#666", fontSize:12 },
  goals:{ width:30, textAlign:"center", fontWeight:"700" }
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import league from '../data/league.json';

export default function HomeScreen({ navigation }) {
  const topNews = [];
  // extraer primeras noticias de división A para mostrar en home
  try {
    const teams = league.divisions.A.teams;
    for (const t of Object.keys(teams)) {
      const news = teams[t].news || [];
      if (news.length) topNews.push({ team: t, headline: news[0] });
    }
  } catch (e) {}

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Noticias principales</Text>
      {topNews.length === 0 && <Text>No hay noticias por ahora.</Text>}
      {topNews.map((n, idx) => (
        <View key={idx} style={styles.card}>
          <Text style={styles.team}>{n.team}</Text>
          <Text>{n.headline}</Text>
        </View>
      ))}

      <Text style={[styles.title, { marginTop: 20 }]}>Accesos rápidos</Text>
      <Pressable style={styles.btn} onPress={() => navigation.navigate('Partidos')}>
        <Text>Ver Partidos</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => navigation.navigate('Tabla')}>
        <Text>Ver Tabla</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => navigation.navigate('Top')}>
        <Text>Top jugadores</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => navigation.navigate('Votos')}>
        <Text>Votar al mejor jugador</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  card: { backgroundColor: '#f5f5f5', padding: 12, marginBottom: 8, borderRadius: 8 },
  team: { fontWeight: '700', marginBottom: 4 },
  btn: {
    padding: 12,
    marginVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    alignItems: 'center'
  }
});

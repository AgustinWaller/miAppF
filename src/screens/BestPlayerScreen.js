import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import {
  getDivisionData,
  jugadoresPorEquipo,
  calcularGanadoresVotaciones,
  getJugador,
} from "../utils/storage";
import { APP_COLORS } from "../theme/colors";
import { getPlayerPhoto } from "../assets/images";

const DEMO_USER_ID = "demoUser";

export default function BestPlayerScreen({ route, navigation }) {
  const routeDivision = route?.params?.division ?? "A";
  const [division, setDivision] = useState(routeDivision);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (routeDivision !== division) {
      setDivision(routeDivision);
    }
  }, [routeDivision]);

  useEffect(() => {
    navigation?.setParams?.({ division });
  }, [division, navigation]);

  const divData = useMemo(() => getDivisionData(division) || { votaciones: {}, equipos: [], jugadores: [] }, [division]);

  const votacionesKeys = useMemo(() => {
    return Object.keys(divData.votaciones || {}).sort((a, b) => (b > a ? 1 : -1));
  }, [divData]);

  const [keyVotacion, setKeyVotacion] = useState(() => votacionesKeys[0] || null);

  useEffect(() => {
    setKeyVotacion(votacionesKeys[0] || null);
  }, [votacionesKeys]);

  const votacion = keyVotacion ? divData.votaciones[keyVotacion] : null;
  const [equipoSel, setEquipoSel] = useState(divData.equipos[0]?.id);

  useEffect(() => {
    setEquipoSel(divData.equipos[0]?.id);
  }, [divData]);

  const plantilla = useMemo(() => jugadoresPorEquipo(division, equipoSel), [division, equipoSel]);

  const topFecha = useMemo(() => {
    if (!votacion) return [];
    const tally = {};
    (votacion.votos || []).forEach((v) => {
      tally[v.jugadorId] = (tally[v.jugadorId] || 0) + 1;
    });
    return Object.entries(tally)
      .map(([jugadorId, votos]) => {
        const jugador = getJugador(division, jugadorId);
        if (!jugador) return null;
        const team = divData.equipos.find((t) => t.id === jugador.equipoId);
        return {
          jugadorId,
          votos,
          nombre: jugador.nombre,
          equipo: team?.nombre || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
      .slice(0, 5);
  }, [votacion, divData, division, refreshKey]);

  const rankingAnual = useMemo(() => {
    const mapa = calcularGanadoresVotaciones(division);
    return Object.entries(mapa)
      .map(([jugadorId, puntos]) => {
        const jugador = getJugador(division, jugadorId);
        if (!jugador) return null;
        const team = divData.equipos.find((t) => t.id === jugador.equipoId);
        return {
          jugadorId,
          puntos,
          nombre: jugador.nombre,
          equipo: team?.nombre || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
      .slice(0, 5);
  }, [division, divData, refreshKey]);

  const yaVoto = useMemo(() => {
    if (!votacion) return false;
    return (votacion.votos || []).some((v) => v.usuarioId === DEMO_USER_ID);
  }, [votacion, refreshKey]);

  const estaAbierta = useMemo(() => {
    if (!votacion) return false;
    const ahora = new Date();
    const abre = new Date(votacion.abre);
    const cierra = new Date(votacion.cierra);
    const day = ahora.getDay();
    const esEntreLunesYSabado = day >= 1 && day <= 6;
    return votacion.abierto && esEntreLunesYSabado && ahora >= abre && ahora <= cierra;
  }, [votacion]);

  const votar = (jugadorId) => {
    if (!votacion) return;
    if (!estaAbierta) {
      Alert.alert("La votacion no esta abierta en este momento.");
      return;
    }
    if (yaVoto) {
      Alert.alert("Solo podes votar una vez por fecha.");
      return;
    }
    const nuevosVotos = [...(votacion.votos || []), { usuarioId: DEMO_USER_ID, jugadorId }];
    divData.votaciones[keyVotacion] = { ...votacion, votos: nuevosVotos };
    setRefreshKey((value) => value + 1);
    Alert.alert("Voto registrado");
  };

  const goHome = () => navigation.navigate("Noticias", { division });

  const renderPlayerRow = (player) => {
    const photo = getPlayerPhoto(player.id);
    return (
      <View key={player.id} style={styles.playerRow}>
        <Image source={photo} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{player.nombre}</Text>
          <Text style={styles.teamSmall}>Goles en el torneo: {player.goles ?? 0}</Text>
        </View>
        <TouchableOpacity
          style={[styles.voteBtn, (!estaAbierta || yaVoto) && { opacity: 0.5 }]}
          onPress={() => votar(player.id)}
          disabled={!estaAbierta || yaVoto}
        >
          <Text style={styles.voteText}>{yaVoto ? "Votaste" : "Votar"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRankingRow = (item, index, label) => {
    const photo = getPlayerPhoto(item.jugadorId);
    return (
      <View key={`${label}-${item.jugadorId}`} style={styles.rankingRow}>
        <Text style={styles.pos}>{index + 1}</Text>
        <Image source={photo} style={styles.avatarSmall} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.nombre}</Text>
          <Text style={styles.teamSmall}>{item.equipo}</Text>
        </View>
        <Text style={styles.votes}>{label === "fecha" ? item.votos : item.puntos}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={goHome}>
          <Text style={styles.actionText}>Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.openDrawer()}>
          <Text style={styles.actionText}>Menu</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Jugador de la fecha - Division {division}</Text>

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

      {votacionesKeys.length > 1 ? (
        <View style={styles.votacionesRow}>
          {votacionesKeys.map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => setKeyVotacion(key)}
              style={[styles.votacionBtn, keyVotacion === key && styles.votacionBtnActiva]}
            >
              <Text style={[styles.votacionText, keyVotacion === key && styles.votacionTextActiva]}>
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!votacion && <Text style={styles.warning}>No hay votacion configurada.</Text>}

      {votacion && (
        <View style={styles.card}>
          <Text style={styles.periodo}>
            {estaAbierta ? "Votacion abierta" : "Votacion cerrada"} - Abre: {new Date(votacion.abre).toLocaleString()} -
            Cierra: {new Date(votacion.cierra).toLocaleString()} - Ventana: lunes a sabado
          </Text>

          <View style={styles.teamRow}>
            {divData.equipos.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.teamBtn, equipoSel === e.id && styles.teamBtnActive]}
                onPress={() => setEquipoSel(e.id)}
              >
                <Text style={[styles.teamText, equipoSel === e.id && styles.teamTextActive]}>{e.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.subtitle}>Plantel</Text>
          <View style={styles.playerList}>
            {plantilla.length === 0 ? (
              <Text style={styles.empty}>No hay jugadores para este equipo.</Text>
            ) : (
              plantilla.map((player) => renderPlayerRow(player))
            )}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.subtitle}>Top 5 de la fecha</Text>
        {topFecha.length === 0 ? (
          <Text style={styles.empty}>No hay votos aun.</Text>
        ) : (
          topFecha.map((item, index) => renderRankingRow(item, index, "fecha"))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>Top 5 del anio</Text>
        {rankingAnual.length === 0 ? (
          <Text style={styles.empty}>Todavia no hay ganadores registrados.</Text>
        ) : (
          rankingAnual.map((item, index) => renderRankingRow(item, index, "anio"))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: APP_COLORS.fondo },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  actionBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionText: { color: APP_COLORS.blanco, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "bold", color: APP_COLORS.texto, textAlign: "center" },
  divRow: { flexDirection: "row", gap: 12, justifyContent: "center" },
  divBtn: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  divBtnActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto, fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco },
  votacionesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  votacionBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderColor: APP_COLORS.cielo, backgroundColor: APP_COLORS.blanco },
  votacionBtnActiva: { backgroundColor: APP_COLORS.campo, borderColor: APP_COLORS.campo },
  votacionText: { color: APP_COLORS.texto, fontWeight: "700" },
  votacionTextActiva: { color: APP_COLORS.blanco },
  warning: { color: "#B71C1C", textAlign: "center", marginTop: 12 },
  card: {
    backgroundColor: APP_COLORS.blanco,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    gap: 12,
  },
  periodo: { color: APP_COLORS.texto },
  teamRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  teamBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderColor: APP_COLORS.campo, backgroundColor: APP_COLORS.blanco },
  teamBtnActive: { backgroundColor: APP_COLORS.campo },
  teamText: { color: APP_COLORS.texto, fontWeight: "700" },
  teamTextActive: { color: APP_COLORS.blanco },
  subtitle: { fontWeight: "700", fontSize: 16, color: APP_COLORS.texto },
  playerList: { gap: 10 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12, backgroundColor: APP_COLORS.cielo },
  name: { fontWeight: "700", color: APP_COLORS.texto },
  teamSmall: { color: "#607D8B", fontSize: 12 },
  voteBtn: { backgroundColor: APP_COLORS.campo, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  voteText: { color: APP_COLORS.blanco, fontWeight: "700" },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  pos: { width: 28, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo },
  avatarSmall: { width: 42, height: 42, borderRadius: 21, marginRight: 10, backgroundColor: APP_COLORS.cielo },
  votes: { width: 36, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo, fontSize: 16 },
  empty: { textAlign: "center", color: APP_COLORS.texto },
});

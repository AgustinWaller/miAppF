// src/screens/ExtrasScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";

import { APP_COLORS } from "../theme/colors";
import { db } from "../services/firebase";
import { getMatchesByDivision } from "../services/matches";
import { getPlayersByDivision } from "../services/players";
import { getTeamsByDivision } from "../services/teams";
import { getOpenVotacionesByDivision } from "../services/votacion";
import { safeImage, FALLBACK_PLAYER, FALLBACK_TEAM } from "../utils/images";
import { TEAMS_MAP } from "../data/teamsMap";
import { TEAM_LOGOS } from "../data/teamLogos";

const normalizeKey = (value) => {
  const raw = String(value || "");
  if (typeof raw.normalize === "function") {
    return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  return raw.toLowerCase();
};

const TEAM_NAME_LOOKUP = Object.entries(TEAMS_MAP).reduce((acc, [key, value]) => {
  acc[normalizeKey(key)] = value;
  return acc;
}, {});

const resolveTeamName = (teamId, teamDoc) => {
  if (teamDoc) {
    return (
      teamDoc.name ||
      teamDoc.nombre ||
      teamDoc.teamName ||
      teamDoc.shortName ||
      teamId ||
      "Equipo"
    );
  }
  const normalized = normalizeKey(teamId);
  if (TEAM_NAME_LOOKUP[normalized]) return TEAM_NAME_LOOKUP[normalized];
  const fuzzy = Object.entries(TEAM_NAME_LOOKUP).find(
    ([key]) => normalized.startsWith(key) || key.startsWith(normalized)
  );
  if (fuzzy) return fuzzy[1];
  return teamId || "Equipo";
};

const resolveTeamLogo = (teamDoc, teamId) => {
  const normalized = normalizeKey(teamId);
  const buildAvatarLogo = (name) => {
    const label = encodeURIComponent(name || teamId || "Equipo");
    return `https://ui-avatars.com/api/?name=${label}&background=0B4FA7&color=fff&bold=true&rounded=true&size=256`;
  };
  const nameCandidate =
    teamDoc?.name ||
    teamDoc?.nombre ||
    TEAM_NAME_LOOKUP[normalized] ||
    TEAM_NAME_LOOKUP[teamId] ||
    teamId ||
    "";
  const mappedLogo =
    TEAM_LOGOS[normalized] ||
    TEAM_LOGOS[teamId] ||
    TEAM_LOGOS[nameCandidate?.toLowerCase?.()] ||
    buildAvatarLogo(nameCandidate);
  return safeImage(
    teamDoc?.logoUrl || teamDoc?.logoURL || teamDoc?.logo || mappedLogo,
    FALLBACK_TEAM
  );
};

async function shareRanking(title, items) {
  if (!items?.length) return;
  const body = items
    .map((item, idx) => `${idx + 1}. ${item.label || item.nombre} ${item.extra || ""}`.trim())
    .join("\n");
  try {
    await Share.share({
      title,
      message: `${title}\n${body}`,
    });
  } catch {
    // ignore
  }
}

const BlueSection = ({ title, onShare, children }) => (
  <LinearGradient
    colors={["#042C63", "#0B4FA7"]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.sectionCard}
  >
    <View style={styles.sectionCardHeader}>
      <Text style={styles.sectionCardTitle}>{title}</Text>
      {onShare ? (
        <TouchableOpacity
          style={styles.sectionCardShare}
          onPress={onShare}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="share-social-outline" size={18} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
    <View style={styles.sectionCardBody}>{children}</View>
  </LinearGradient>
);

/**
 * ExtrasScreen
 *
 * - Lee partidos, jugadores, equipos y votaciones desde Firestore.
 * - Top 5 equipos mas votados: usa coleccion "teamFavorites" (documentos por teamId con campo count).
 * - Top 5 votacion actual: votacion con abierto === true (por division).
 * - Top 5 votos acumulados: suma de todos los votos en todas las fechas.
 * - Jugador del año: por cada fecha cerrada se suma 1 punto al/los ganador(es).
 * - Goleadores: conteo de eventos de tipo "gol" en matches.
 * - Equipo mas goleador / mas goleado: suma gf/gc por equipo desde matches.
 *
 * Nota: asumimos que las colecciones se llaman tal como las mostraste:
 *   - "votacion" -> documentos por fecha -> subcoleccion "votes"
 *   - "teamFavorites" -> documentos por teamId, con campo count y subcol "votes"
 */

function parseDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value?.toDate) {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  return null;
}
function formatDate(value) {
  const d = parseDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ExtrasScreen() {
  const [division, setDivision] = useState("A");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Rankings y datos
  const [scorers, setScorers] = useState([]); // top goleadores
  const [openVoteRanking, setOpenVoteRanking] = useState([]); // votacion abierta (top 5)
  const [voteRanking, setVoteRanking] = useState([]); // votos acumulados (top 5)
  const [vpRanking, setVpRanking] = useState([]); // jugador del año (top)
  const [recentVotes, setRecentVotes] = useState([]); // ultimos ganadores resumen
  const [teamGoalsLeader, setTeamGoalsLeader] = useState(null);
  const [teamConcededLeader, setTeamConcededLeader] = useState(null);
  const [playerMostVotes, setPlayerMostVotes] = useState(null);
  const [playerYearLeader, setPlayerYearLeader] = useState(null);
  const [teamRanking, setTeamRanking] = useState([]); // TOP 5 equipos mas votados (global)
  const getShareHandler = useCallback((title, data, mapFn) => {
    if (!data?.length) return undefined;
    return () =>
      shareRanking(
        title,
        data.map((item, idx) => mapFn(item, idx))
      );
  }, []);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // traemos datos base
      const [
        matchesList,
        playersList,
        teamsListForDiv, // equipos de la division (para mapear equipos de jugadores)
        voteDocsSnap, // votaciones historicas (query snapshot)
        openVoteDocs,
      ] = await Promise.all([
        getMatchesByDivision(division),
        getPlayersByDivision(division),
        getTeamsByDivision(division),
        // votaciones (limit 20 ordenadas por cierra desc)
        getDocs(
          query(
            collection(db, "votacion"),
            where("divisionId", "==", division),
            orderBy("cierra", "desc"),
            limit(20)
          )
        ),
        getOpenVotacionesByDivision(division),
      ]);

      // playersMap (por id)
      const playersMap = new Map(playersList.map((p) => [p.id, p]));
      // teamsMap por id (necesario para nombres/logos)
      // NOTA: getTeamsByDivision trae solo equipos de la division: para logos de jugadores esta bien.
      const teamsMap = new Map(teamsListForDiv.map((t) => [t.id, t]));
      const teamsNormalizedMap = new Map(teamsListForDiv.map((t) => [normalizeKey(t.id), t]));
      const getTeamDocForId = (teamId) => {
        if (!teamId) return null;
        return teamsMap.get(teamId) || teamsNormalizedMap.get(normalizeKey(teamId)) || null;
      };
      const resolvePlayerTeamData = (player) => {
        if (!player) return { name: "", logo: safeImage("", FALLBACK_TEAM) };
        const candidateId = player.teamId || player.team || player.equipo || "";
        const normalized = normalizeKey(candidateId);
        const teamDoc = getTeamDocForId(candidateId);
        const fallback =
          teamDoc?.name ||
          teamDoc?.nombre ||
          TEAM_NAME_LOOKUP[normalized] ||
          candidateId;
        const name =
          player.teamName ||
          player.team ||
          player.equipo ||
          fallback ||
          "";
        const logo = resolveTeamLogo(teamDoc, candidateId);
        return { name, logo };
      };

      //
      // 1) EQUIPOS MAS GOLEADORES / GOLEADOS
      //
      const teamStats = new Map();
      const ensureTeam = (teamId) => {
        if (!teamId) return null;
        if (!teamStats.has(teamId)) teamStats.set(teamId, { gf: 0, gc: 0 });
        return teamStats.get(teamId);
      };

      matchesList.forEach((match) => {
        const localId = match.localId || match.local || "";
        const visitanteId = match.visitanteId || match.visitante || "";
        const golesLocal = Number(match.golesLocal ?? match.goles_local ?? 0);
        const golesVisitante = Number(match.golesVisitante ?? match.goles_visitante ?? 0);

        const localStats = ensureTeam(localId);
        const visitaStats = ensureTeam(visitanteId);
        if (localStats) {
          localStats.gf += golesLocal;
          localStats.gc += golesVisitante;
        }
        if (visitaStats) {
          visitaStats.gf += golesVisitante;
          visitaStats.gc += golesLocal;
        }
      });

      if (teamStats.size) {
        const statsArray = Array.from(teamStats.entries());
        const attackLeader = statsArray.sort((a, b) => b[1].gf - a[1].gf)[0];
        const concededLeader = statsArray.sort((a, b) => b[1].gc - a[1].gc)[0];
        setTeamGoalsLeader(
          attackLeader && attackLeader[1].gf > 0
            ? {
                id: attackLeader[0],
                nombre:
                  (teamsMap.get(attackLeader[0])?.name ||
                    teamsMap.get(attackLeader[0])?.nombre ||
                    attackLeader[0]) ?? attackLeader[0],
                goles: attackLeader[1].gf,
              }
            : null
        );
        setTeamConcededLeader(
          concededLeader && concededLeader[1].gc > 0
            ? {
                id: concededLeader[0],
                nombre:
                  (teamsMap.get(concededLeader[0])?.name ||
                    teamsMap.get(concededLeader[0])?.nombre ||
                    concededLeader[0]) ?? concededLeader[0],
                goles: concededLeader[1].gc,
              }
            : null
        );
      } else {
        setTeamGoalsLeader(null);
        setTeamConcededLeader(null);
      }

      //
      // 2) GOLEADORES (top 5)
      //
      const scorerTotals = {};
      matchesList.forEach((match) => {
        const eventos = match.eventos || match.evento || [];
        eventos.forEach((ev) => {
          const tipo = String(ev?.tipo || ev?.type || "").toLowerCase();
          const isGol = tipo.includes("gol") || tipo === "gol" || tipo.startsWith("gol");
          const jugadorId = ev.jugadorId || ev.jugador || ev.playerId || ev.player || "";
          if (isGol && jugadorId) scorerTotals[jugadorId] = (scorerTotals[jugadorId] || 0) + 1;
        });
      });

      const scorerRanking = Object.entries(scorerTotals)
        .map(([playerId, goals]) => {
          const p = playersMap.get(playerId) || {};
          const teamData = resolvePlayerTeamData(p);
          return {
            id: playerId,
            nombre: p.name || p.nombre || playerId,
            equipo: teamData.name,
            goles: goals,
            photo: safeImage(p.photoUrl || p.photoURL || p.photo || "", FALLBACK_PLAYER),
            teamLogo: teamData.logo,
          };
        })
        .sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      setScorers(scorerRanking);

      //
      // 3) VOTACIONES: abierta (top actual), acumulado (total por jugador), jugador del año (VP)
      //
      const voteDocsMap = new Map();
      // voteDocsSnap es QuerySnapshot de las ultimas 20 por cierra desc (solo de esa division)
      voteDocsSnap?.docs?.forEach((snap) => {
        voteDocsMap.set(snap.id, { id: snap.id, ...snap.data() });
      });
      // openVoteDocs viene del helper getOpenVotacionesByDivision (si existe en tu proyecto)
      (openVoteDocs || []).forEach((docItem) => {
        voteDocsMap.set(docItem.id, docItem);
      });
      const voteDocs = Array.from(voteDocsMap.values());

      const voteTotals = {}; // acumulado por jugador (sum of all votes)
      const vpTotalsLocal = {}; // jugador del año: sum de victorias por fecha cerrada
      let openVoteRankingLocal = [];
      const recentSummaries = [];

      await Promise.all(
        voteDocs.map(async (voteDoc) => {
          // votes subcollection
          const votesSnap = await getDocs(collection(doc(db, "votacion", voteDoc.id), "votes"));
          const voteCount = votesSnap.docs.reduce((acc, vdoc) => {
            const d = vdoc.data() || {};
            // votos por jugadorId (varios nombres segun tus datos)
            const pid = d.jugadorId || d.jugador || d.playerId || d.player || "";
            if (!pid) return acc;
            acc[pid] = (acc[pid] || 0) + 1;
            return acc;
          }, {});

          // sumar al acumulado global
          Object.entries(voteCount).forEach(([pid, c]) => {
            voteTotals[pid] = (voteTotals[pid] || 0) + c;
          });

          // si la votacion esta abierta -> ranking actual
          if (voteDoc.abierto === true) {
            openVoteRankingLocal = Object.entries(voteCount)
              .map(([pid, c]) => {
                const p = playersMap.get(pid);
                const teamData = resolvePlayerTeamData(p);
                return {
                  id: pid,
                  nombre: p?.name || p?.nombre || pid,
                  equipo: teamData.name,
                  votos: c,
                  teamLogo: teamData.logo,
                };
              })
              .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
              .slice(0, 5);
          }

          // si la votacion esta cerrada -> determinamos ganadores para VP y resumen
          if (voteDoc.abierto !== true && Object.keys(voteCount).length) {
            const maxVotes = Math.max(...Object.values(voteCount));
            const winners = Object.entries(voteCount)
              .filter(([, c]) => c === maxVotes)
              .map(([pid, c]) => {
                vpTotalsLocal[pid] = (vpTotalsLocal[pid] || 0) + 1; // +1 punto por victoria en esa fecha (empates cuentan para todos)
                const p = playersMap.get(pid);
                const teamData = resolvePlayerTeamData(p);
                return {
                  id: pid,
                  nombre: p?.name || p?.nombre || pid,
                  equipo: teamData.name,
                  votos: c,
                  teamLogo: teamData.logo,
                };
              });

            recentSummaries.push({
              id: voteDoc.id,
              fecha: formatDate(voteDoc.cierra || voteDoc.abre || voteDoc.createdAt),
              winners,
            });
          }
        })
      );

      // ordenar y setear abiertos / acumulados / vp
      setOpenVoteRanking(openVoteRankingLocal);

      const voteRankingTop5 = Object.entries(voteTotals || {})
        .map(([pid, votos]) => {
          const p = playersMap.get(pid) || {};
          const teamData = resolvePlayerTeamData(p);
          return {
            id: pid,
            nombre: p?.name || p?.nombre || pid,
            equipo: teamData.name,
            votos,
            teamLogo: teamData.logo,
          };
        })
        .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      const vpRankingTop5 = Object.entries(vpTotalsLocal || {})
        .map(([pid, pts]) => {
          const p = playersMap.get(pid) || {};
          const teamData = resolvePlayerTeamData(p);
          return {
            id: pid,
            nombre: p?.name || p?.nombre || pid,
            equipo: teamData.name,
            victorias: pts,
            teamLogo: teamData.logo,
          };
        })
        .sort((a, b) => b.victorias - a.victorias || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      recentSummaries.sort((a, b) => {
        const da = parseDate(a.fecha)?.getTime() ?? 0;
        const db = parseDate(b.fecha)?.getTime() ?? 0;
        return db - da;
      });

      setRecentVotes(recentSummaries.slice(0, 5));
      setVoteRanking(voteRankingTop5);
      setVpRanking(vpRankingTop5);
      setPlayerMostVotes(voteRankingTop5[0] || null);
      setPlayerYearLeader(vpRankingTop5[0] || null);

      //
      //
      // 4) RANKING DE EQUIPOS MAS VOTADOS (GLOBAL)
      //
      
      // A. Traemos los votos de favoritos
      const teamFavSnap = await getDocs(collection(db, "teamFavorites"));

      // B. Traemos los equipos de la 'A' y la 'B' usando tus servicios existentes
      // Esto asegura que tengamos los nombres reales aunque esten en divisiones separadas
      const [teamsDivA, teamsDivB] = await Promise.all([
        getTeamsByDivision("A"),
        getTeamsByDivision("B")
      ]);
      const allTeamsList = [...teamsDivA, ...teamsDivB];

      // C. Cruzamos la informacion y consolidamos por teamId normalizado (evita duplicados tipo "progre"/"progreso")
      const rankingMap = new Map();
      teamFavSnap.docs.forEach((doc) => {
        const data = doc.data() || {};
        const teamId = doc.id;
        const normalizedTeamId = normalizeKey(teamId);
        const votos = Math.max(Number(data.count || 0), 0);
        if (!votos) return;

        const teamFound = allTeamsList.find(
          (t) => normalizeKey(t.id) === normalizedTeamId
        );
        const teamName = resolveTeamName(teamId, teamFound);
        const teamLogo = resolveTeamLogo(teamFound, teamId);

        if (rankingMap.has(normalizedTeamId)) {
          const prev = rankingMap.get(normalizedTeamId);
          prev.votos += votos;
          // conserva el logo/nombre ya calculado
        } else {
          rankingMap.set(normalizedTeamId, {
            id: teamFound?.id || teamId,
            nombre: teamName,
            teamLogo,
            votos,
          });
        }
      });

      const rankingTeams = Array.from(rankingMap.values())
        .filter((t) => t.votos > 0)
        .sort((a, b) => b.votos - a.votos)
        .slice(0, 5);

      setTeamRanking(rankingTeams);
    } catch (err) {
      console.error("Extras load error:", err);
      setError("Error al cargar");
      // limpiar
      setScorers([]);
      setOpenVoteRanking([]);
      setVoteRanking([]);
      setVpRanking([]);
      setRecentVotes([]);
      setTeamRanking([]);
      setTeamGoalsLeader(null);
      setTeamConcededLeader(null);
      setPlayerMostVotes(null);
      setPlayerYearLeader(null);
    } finally {
      setLoading(false);
    }
  }, [division]);

  useEffect(() => {
    load();
  }, [load]);

  // resumen superior (texto con varios items)
  const summaryItems = useMemo(
    () => [
      {
        label: "Equipo mas goleador",
        value: teamGoalsLeader ? `${teamGoalsLeader.nombre} (${teamGoalsLeader.goles} goles)` : "Sin datos",
      },
      {
        label: "Equipo mas goleado",
        value: teamConcededLeader ? `${teamConcededLeader.nombre} (${teamConcededLeader.goles} goles en contra)` : "Sin datos",
      },
      {
        label: "Jugador con mas votos acumulados",
        value: playerMostVotes ? `${playerMostVotes.nombre}${playerMostVotes.equipo ? ` (${playerMostVotes.equipo})` : ""} - ${playerMostVotes.votos} votos` : "Sin datos",
      },
      {
        label: "Jugador del año (VP)",
        value: playerYearLeader ? `${playerYearLeader.nombre}${playerYearLeader.equipo ? ` (${playerYearLeader.equipo})` : ""} - ${playerYearLeader.victorias} VP` : "Sin datos",
      },
    ],
    [teamGoalsLeader, teamConcededLeader, playerMostVotes, playerYearLeader]
  );

  return (
    <View style={styles.container}>
      <View style={styles.divisionRow}>
        {["A", "B"].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.divButton, division === d && styles.divButtonActive]}
            onPress={() => setDivision(d)}
          >
            <Text style={[styles.divText, division === d && styles.divTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={load} style={styles.reload}>
          <Text style={styles.reloadTxt}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" color={APP_COLORS.campo} />
      ) : error ? (
        <Text style={styles.error} onPress={load}>{error}. Toca para reintentar.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <BlueSection title="Resumen de tabla">
            {summaryItems.map((item) => (
              <View key={item.label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value}</Text>
              </View>
            ))}
          </BlueSection>

          <BlueSection
            title="Top 5 Jugador de la fecha (votacion actual)"
            onShare={getShareHandler(
              "Top 5 Jugador de la fecha (votacion actual)",
              openVoteRanking,
              (item) => ({
                label: `${item.nombre}${item.equipo ? ` (${item.equipo})` : ""}`,
                extra: `${item.votos} votos`,
              })
            )}
          >
            {openVoteRanking.length ? (
              openVoteRanking.map((item, index) => (
                <View key={`open-${item.id}`} style={styles.listRow}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={styles.listPlayerInfo}>
                    <Image source={item.teamLogo} style={styles.listLogo} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{item.nombre}</Text>
                      {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                    </View>
                  </View>
                  <Text style={styles.rowValue}>{item.votos} votos</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>No hay votacion abierta.</Text>
            )}
          </BlueSection>

          <BlueSection
            title="Top 5 Jugador mas votado (acumulado)"
            onShare={getShareHandler(
              "Top 5 Jugador mas votado (acumulado)",
              voteRanking,
              (item) => ({
                label: `${item.nombre}${item.equipo ? ` (${item.equipo})` : ""}`,
                extra: `${item.votos} votos`,
              })
            )}
          >
            {voteRanking.length ? (
              voteRanking.map((item, index) => (
                <View key={`votes-${item.id}`} style={styles.listRow}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={styles.listPlayerInfo}>
                    <Image source={item.teamLogo} style={styles.listLogo} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{item.nombre}</Text>
                      {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                    </View>
                  </View>
                  <Text style={styles.rowValue}>{item.votos} votos</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Sin votos registrados.</Text>
            )}
          </BlueSection>

          <BlueSection
            title="Top 5 Jugador del año (VP)"
            onShare={getShareHandler(
              "Top 5 Jugador del año (VP)",
              vpRanking,
              (item) => ({
                label: `${item.nombre}${item.equipo ? ` (${item.equipo})` : ""}`,
                extra: `${item.victorias} VP`,
              })
            )}
          >
            {vpRanking.length ? (
              vpRanking.map((item, index) => (
                <View key={`vp-${item.id}`} style={styles.listRow}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={styles.listPlayerInfo}>
                    <Image source={item.teamLogo} style={styles.listLogo} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{item.nombre}</Text>
                      {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                    </View>
                  </View>
                  <Text style={styles.rowValue}>{item.victorias} VP</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Sin ganadores todavia.</Text>
            )}
          </BlueSection>

          <BlueSection
            title="Top 5 Goleadores"
            onShare={getShareHandler(
              "Top 5 Goleadores",
              scorers,
              (item) => ({
                label: `${item.nombre}${item.equipo ? ` (${item.equipo})` : ""}`,
                extra: `${item.goles} goles`,
              })
            )}
          >
            {scorers.length ? (
              scorers.map((item, index) => (
                <View key={`scorer-${item.id}`} style={styles.listRow}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
                    <Image source={item.photo} style={styles.playerAvatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{item.nombre}</Text>
                      {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.rowValue}>{item.goles} goles</Text>
                    {item.teamLogo ? (
                      <Image source={item.teamLogo} style={styles.miniLogo} />
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Sin goles registrados.</Text>
            )}
          </BlueSection>

          <BlueSection
            title="Top 5 equipos favoritos"
            onShare={getShareHandler(
              "Top 5 equipos favoritos",
              teamRanking,
              (item) => ({
                label: item.nombre,
                extra: `${item.votos} votos`,
              })
            )}
          >
            {teamRanking.length ? (
              teamRanking.map((t, i) => (
                <View key={t.id} style={styles.listRow}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={styles.listPlayerInfo}>
                    <Image source={t.teamLogo} style={styles.teamLogo} />
                    <Text style={styles.rowName}>{t.nombre}</Text>
                  </View>
                  <Text style={styles.rowValue}>{t.votos} votos</Text>
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Aun no hay votos registrados.</Text>
            )}
          </BlueSection>

          <BlueSection title="Ultimos ganadores (Jugador de la fecha)">
            {recentVotes.length ? (
              recentVotes.map((vote) => (
                <View key={`vote-${vote.id}`} style={styles.voteCard}>
                  <Text style={styles.voteDate}>{vote.fecha || vote.id}</Text>
                  {vote.winners.map((w) => (
                    <View key={`${vote.id}-${w.id}`} style={styles.recentWinnerRow}>
                      <Image source={w.teamLogo} style={styles.listLogo} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.voteWinner}>{w.nombre}</Text>
                        {w.equipo ? (
                          <Text style={styles.voteWinnerTeam}>{w.equipo}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.rowValue}>{w.votos} votos</Text>
                    </View>
                  ))}
                </View>
              ))
            ) : (
              <Text style={styles.empty}>Aun no hay votaciones cerradas.</Text>
            )}
          </BlueSection>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_COLORS.fondo || "#fff", padding: 16 },
  divisionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  divButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: APP_COLORS.campo || "#2f7d32",
    backgroundColor: APP_COLORS.blanco || "#fff",
    marginRight: 8,
  },
  divButtonActive: { backgroundColor: APP_COLORS.campo },
  divText: { color: APP_COLORS.texto || "#333", fontWeight: "700" },
  divTextActive: { color: APP_COLORS.blanco || "#fff" },
  reload: { marginLeft: "auto" },
  reloadTxt: { color: APP_COLORS.campo || "#2f7d32", fontWeight: "700" },
  error: { textAlign: "center", color: APP_COLORS.texto || "#333" },

  sectionCard: {
    borderRadius: 20,
    padding: 14,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#03193d",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionCardTitle: { color: "#E3F2FD", fontSize: 17, fontWeight: "800", flex: 1 },
  sectionCardShare: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sectionCardBody: { gap: 10 },
  summaryRow: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  summaryLabel: { fontWeight: "700", color: "#CFE7FF", fontSize: 13 },
  summaryValue: { color: "#fff", marginTop: 4, fontWeight: "600", fontSize: 15 },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 10,
  },
  listPlayerInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  listLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)" },
  rank: { width: 28, textAlign: "center", fontWeight: "800", color: "#CFE7FF" },
  rowName: { fontWeight: "700", color: "#fff" },
  rowSub: { color: "rgba(255,255,255,0.8)" },
  rowValue: { fontWeight: "700", color: "#CDE9FF" },

  teamLogo: { width: 32, height: 32, marginRight: 8, borderRadius: 16, backgroundColor: "rgba(3,31,74,0.4)" },
  playerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)" },
  miniLogo: { width: 26, height: 26, marginTop: 6, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.1)" },

  empty: { color: "#E0ECFF", textAlign: "center", marginVertical: 12 },

  voteCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 8,
    gap: 8,
  },
  voteDate: { fontWeight: "700", color: "#CFE7FF", marginBottom: 4 },
  recentWinnerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  voteWinner: { color: "#fff", fontWeight: "700" },
  voteWinnerTeam: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
});




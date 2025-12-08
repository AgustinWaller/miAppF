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

const SectionHeader = ({ title, onShare }) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, styles.sectionHeaderTitle]}>{title}</Text>
    {onShare ? (
      <TouchableOpacity
        style={styles.shareButton}
        onPress={onShare}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="share-social-outline"
          size={18}
          color={APP_COLORS.campo || "#2f7d32"}
        />
      </TouchableOpacity>
    ) : null}
  </View>
);

/**
 * ExtrasScreen
 *
 * - Lee partidos, jugadores, equipos y votaciones desde Firestore.
 * - Top 5 equipos mÃ¡s votados: usa colecciÃ³n "teamFavorites" (documentos por teamId con campo count).
 * - Top 5 votaciÃ³n actual: votaciÃ³n con abierto === true (por division).
 * - Top 5 votos acumulados: suma de todos los votos en todas las fechas.
 * - Jugador del aÃ±o: por cada fecha cerrada se suma 1 punto al/los ganador(es).
 * - Goleadores: conteo de eventos de tipo "gol" en matches.
 * - Equipo mÃ¡s goleador / mÃ¡s goleado: suma gf/gc por equipo desde matches.
 *
 * Nota: asumimos que las colecciones se llaman tal como las mostraste:
 *   - "votacion" -> documentos por fecha -> subcolecciÃ³n "votes"
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
  const [openVoteRanking, setOpenVoteRanking] = useState([]); // votaciÃ³n abierta (top 5)
  const [voteRanking, setVoteRanking] = useState([]); // votos acumulados (top 5)
  const [vpRanking, setVpRanking] = useState([]); // jugador del aÃ±o (top)
  const [recentVotes, setRecentVotes] = useState([]); // Ãºltimos ganadores resumen
  const [teamGoalsLeader, setTeamGoalsLeader] = useState(null);
  const [teamConcededLeader, setTeamConcededLeader] = useState(null);
  const [playerMostVotes, setPlayerMostVotes] = useState(null);
  const [playerYearLeader, setPlayerYearLeader] = useState(null);
  const [teamRanking, setTeamRanking] = useState([]); // TOP 5 equipos mÃ¡s votados (global)
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
        teamsListForDiv, // equipos de la divisiÃ³n (para mapear equipos de jugadores)
        voteDocsSnap,
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
      // NOTA: getTeamsByDivision trae solo equipos de la divisiÃ³n: para logos de jugadores estÃ¡ bien.
      const teamsMap = new Map(teamsListForDiv.map((t) => [t.id, t]));
      const teamsNormalizedMap = new Map(teamsListForDiv.map((t) => [normalizeKey(t.id), t]));
      const resolvePlayerTeamName = (player) => {
        if (!player) return "";
        const candidateId = player.teamId || player.team || player.equipo || "";
        const normalized = normalizeKey(candidateId);
        const teamDoc =
          teamsMap.get(candidateId) ||
          teamsNormalizedMap.get(normalized) ||
          null;
        const fallback =
          teamDoc?.name ||
          teamDoc?.nombre ||
          TEAM_NAME_LOOKUP[normalized] ||
          candidateId;
        return (
          player.teamName ||
          player.team ||
          player.equipo ||
          fallback ||
          ""
        );
      };

      //
      // 1) EQUIPOS MÃS GOLEADORES / GOLEADOS
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
          const teamId = p.teamId || p.team || p.equipo || "";
          const normalizedTeamId = normalizeKey(teamId);
          const team =
            teamsMap.get(teamId) ||
            teamsNormalizedMap.get(normalizedTeamId) ||
            {};
          const teamName = resolvePlayerTeamName(p);
          return {
            id: playerId,
            nombre: p.name || p.nombre || playerId,
            equipo: teamName,
            goles: goals,
            photo: safeImage(p.photoUrl || p.photoURL || p.photo || "", FALLBACK_PLAYER),
            teamLogo: safeImage(team?.logoUrl || team?.logoURL || "", FALLBACK_TEAM),
          };
        })
        .sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      setScorers(scorerRanking);

      //
      // 3) VOTACIONES: abierta (top actual), acumulado (total por jugador), jugador del aÃ±o (VP)
      //
      const voteDocsMap = new Map();
      // voteDocsSnap es QuerySnapshot de las Ãºltimas 20 por cierra desc (solo de esa division)
      voteDocsSnap.docs.forEach((d) => voteDocsMap.set(d.id, { id: d.id, ...d.data() }));
      // openVoteDocs viene del helper getOpenVotacionesByDivision (si existe en tu proyecto)
      openVoteDocs.forEach((d) => voteDocsMap.set(d.id, d));
      const voteDocs = Array.from(voteDocsMap.values());

      const voteTotals = {}; // acumulado por jugador (sum of all votes)
      const vpTotalsLocal = {}; // jugador del aÃ±o: sum de victorias por fecha cerrada
      let openVoteRankingLocal = [];
      const recentSummaries = [];

      await Promise.all(
        voteDocs.map(async (voteDoc) => {
          // votes subcollection
          const votesSnap = await getDocs(collection(doc(db, "votacion", voteDoc.id), "votes"));
          const voteCount = votesSnap.docs.reduce((acc, vdoc) => {
            const d = vdoc.data() || {};
            // votos por jugadorId (varios nombres segÃºn tus datos)
            const pid = d.jugadorId || d.jugador || d.playerId || d.player || "";
            if (!pid) return acc;
            acc[pid] = (acc[pid] || 0) + 1;
            return acc;
          }, {});

          // sumar al acumulado global
          Object.entries(voteCount).forEach(([pid, c]) => {
            voteTotals[pid] = (voteTotals[pid] || 0) + c;
          });

          // si la votaciÃ³n estÃ¡ abierta -> ranking actual
          if (voteDoc.abierto === true) {
            openVoteRankingLocal = Object.entries(voteCount)
              .map(([pid, c]) => {
                const p = playersMap.get(pid);
                const teamName = resolvePlayerTeamName(p);
                return {
                  id: pid,
                  nombre: p?.name || p?.nombre || pid,
                  equipo: teamName,
                  votos: c,
                };
              })
              .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
              .slice(0, 5);
          }

          // si la votaciÃ³n estÃ¡ cerrada -> determinamos ganadores para VP y resumen
          if (voteDoc.abierto !== true && Object.keys(voteCount).length) {
            const maxVotes = Math.max(...Object.values(voteCount));
            const winners = Object.entries(voteCount)
              .filter(([, c]) => c === maxVotes)
              .map(([pid, c]) => {
                vpTotalsLocal[pid] = (vpTotalsLocal[pid] || 0) + 1; // +1 punto por victoria en esa fecha (empates cuentan para todos)
                const p = playersMap.get(pid);
                const teamName = resolvePlayerTeamName(p);
                return {
                  id: pid,
                  nombre: p?.name || p?.nombre || pid,
                  equipo: teamName,
                  votos: c,
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
          const teamName = resolvePlayerTeamName(p);
          return {
            id: pid,
            nombre: p?.name || p?.nombre || pid,
            equipo: teamName,
            votos,
          };
        })
        .sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      const vpRankingTop5 = Object.entries(vpTotalsLocal || {})
        .map(([pid, pts]) => {
          const p = playersMap.get(pid) || {};
          const teamName = resolvePlayerTeamName(p);
          return {
            id: pid,
            nombre: p?.name || p?.nombre || pid,
            equipo: teamName,
            victorias: pts,
          };
        })
        .sort((a, b) => b.victorias - a.victorias || a.nombre.localeCompare(b.nombre))
        .slice(0, 5);

      recentSummaries.sort((a, b) => {
        const da = parseDate(a.fecha)?.getTime() ?? 0;
        const db = parseDate(b.fecha)?.getTime() ?? 0;
        return db - da;
      });

      setVoteRanking(voteRankingTop5);
      setVpRanking(vpRankingTop5);
      setRecentVotes(recentSummaries.slice(0, 5));
      setPlayerMostVotes(voteRankingTop5[0] || null);
      setPlayerYearLeader(vpRankingTop5[0] || null);

      //
      //
      // 4) RANKING DE EQUIPOS MÃS VOTADOS (GLOBAL)
      //
      
      // A. Traemos los votos de favoritos
      const teamFavSnap = await getDocs(collection(db, "teamFavorites"));

      // B. Traemos los equipos de la 'A' y la 'B' usando tus servicios existentes
      // Esto asegura que tengamos los nombres reales aunque estÃ©n en divisiones separadas
      const [teamsDivA, teamsDivB] = await Promise.all([
        getTeamsByDivision("A"),
        getTeamsByDivision("B")
      ]);
      const allTeamsList = [...teamsDivA, ...teamsDivB];

      // C. Cruzamos la informaciÃ³n
      const rankingTeams = teamFavSnap.docs
        .map((doc) => {
          const data = doc.data();
          const teamId = doc.id; // En tu base de datos, el ID del documento es el ID del equipo (ej: "sancarlos")
          const normalizedTeamId = normalizeKey(teamId);

          const teamFound = allTeamsList.find(
            (t) => normalizeKey(t.id) === normalizedTeamId
          );

          const teamName = resolveTeamName(teamId, teamFound);

          return {
            id: teamId,
            nombre: teamName,
            logo: safeImage(
              teamFound?.logoUrl || teamFound?.logoURL || teamFound?.logo || "",
              FALLBACK_TEAM
            ),
            votos: Number(data.count || 0),
          };
        })
      .filter((t) => t.votos > 0) // Opcional: Ocultar los que tienen 0 votos
      .sort((a, b) => b.votos - a.votos) // Ordenar de mayor a menor
      .slice(0, 5); // Tomar solo los top 5

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
        label: "Equipo mÃ¡s goleador",
        value: teamGoalsLeader ? `${teamGoalsLeader.nombre} (${teamGoalsLeader.goles} goles)` : "Sin datos",
      },
      {
        label: "Equipo mÃ¡s goleado",
        value: teamConcededLeader ? `${teamConcededLeader.nombre} (${teamConcededLeader.goles} goles en contra)` : "Sin datos",
      },
      {
        label: "Jugador con mÃ¡s votos acumulados",
        value: playerMostVotes ? `${playerMostVotes.nombre}${playerMostVotes.equipo ? ` (${playerMostVotes.equipo})` : ""} - ${playerMostVotes.votos} votos` : "Sin datos",
      },
      {
        label: "Jugador del aÃ±o (VP)",
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
          <Text style={styles.sectionTitle}>Resumen</Text>
          {summaryItems.map((item) => (
            <View key={item.label} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}

          <SectionHeader
            title="Top 5 Jugador de la fecha (votación actual)"
            onShare={getShareHandler(
              "Top 5 Jugador de la fecha (votación actual)",
              openVoteRanking,
              (item) => ({
                label: `${item.nombre}${item.equipo ? ` (${item.equipo})` : ""}`,
                extra: `${item.votos} votos`,
              })
            )}
          />
          {openVoteRanking.length ? (
            openVoteRanking.map((item, index) => (
              <View key={`open-${item.id}`} style={styles.listRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.nombre}</Text>
                  {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                </View>
                <Text style={styles.rowValue}>{item.votos} votos</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No hay votaciÃ³n abierta.</Text>
          )}

          <SectionHeader
            title="Top 5 Jugador más votado (acumulado)"
            onShare={getShareHandler(
              "Top 5 Jugador más votado (acumulado)",
              voteRanking,
              (item) => ({
                label: `${item.nombre}${item.equipo ? ` (${item.equipo})` : ""}`,
                extra: `${item.votos} votos`,
              })
            )}
          />
          {voteRanking.length ? (
            voteRanking.map((item, index) => (
              <View key={`votes-${item.id}`} style={styles.listRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.nombre}</Text>
                  {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                </View>
                <Text style={styles.rowValue}>{item.votos} votos</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Sin votos registrados.</Text>
          )}

          <SectionHeader
            title="Top 5 Jugador del año (VP)"
            onShare={getShareHandler(
              "Top 5 Jugador del año (VP)",
              vpRanking,
              (item) => ({
                label: `${item.nombre}${item.equipo ? ` (${item.equipo})` : ""}`,
                extra: `${item.victorias} VP`,
              })
            )}
          />
          {vpRanking.length ? (
            vpRanking.map((item, index) => (
              <View key={`vp-${item.id}`} style={styles.listRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.nombre}</Text>
                  {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                </View>
                <Text style={styles.rowValue}>{item.victorias} VP</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Sin ganadores todavÃ­a.</Text>
          )}

          <SectionHeader
            title="Top 5 Goleadores"
            onShare={getShareHandler(
              "Top 5 Goleadores",
              scorers,
              (item) => ({
                label: `${item.nombre}${item.equipo ? ` (${item.equipo})` : ""}`,
                extra: `${item.goles} goles`,
              })
            )}
          />
          {scorers.length ? (
            scorers.map((item, index) => (
              <View key={`scorer-${item.id}`} style={styles.listRow}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Image source={item.photo} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{item.nombre}</Text>
                    {!!item.equipo && <Text style={styles.rowSub}>{item.equipo}</Text>}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.rowValue}>{item.goles} goles</Text>
                  {item.teamLogo && <Image source={item.teamLogo} style={{ width: 24, height: 24, marginTop: 6 }} />}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Sin goles registrados.</Text>
          )}

          <SectionHeader
            title="Top 5 Equipos más votados"
            onShare={getShareHandler(
              "Top 5 Equipos más votados",
              teamRanking,
              (item) => ({
                label: item.nombre,
                extra: `${item.votos} votos`,
              })
            )}
          />
          {teamRanking.length ? (
            teamRanking.map((t, i) => (
              <View key={t.id} style={styles.listRow}>
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={{ flexDirection: "row", flex: 1, alignItems: "center" }}>
                  <Image source={t.logo} style={styles.teamLogo} />
                  <Text style={styles.rowName}>{t.nombre}</Text>
                </View>
                <Text style={styles.rowValue}>{t.votos} votos</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>AÃºn no hay votos registrados.</Text>
          )}

          <Text style={styles.sectionTitle}>Ãšltimos ganadores (Jugador de la fecha)</Text>
          {recentVotes.length ? (
            recentVotes.map((vote) => (
              <View key={`vote-${vote.id}`} style={styles.voteCard}>
                <Text style={styles.voteDate}>{vote.fecha || vote.id}</Text>
                {vote.winners.map((w) => (
                  <Text key={`${vote.id}-${w.id}`} style={styles.voteWinner}>
                    {w.nombre}
                    {w.equipo ? ` (${w.equipo})` : ""} â€” {w.votos} votos
                  </Text>
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.empty}>AÃºn no hay votaciones cerradas.</Text>
          )}
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

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: APP_COLORS.texto || "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
    gap: 12,
  },
  sectionHeaderTitle: { marginTop: 0, marginBottom: 0 },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: APP_COLORS.campo || "#2f7d32",
    backgroundColor: APP_COLORS.blanco || "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: "rgba(4,44,99,0.08)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(4,44,99,0.25)",
    marginBottom: 8,
  },
  summaryLabel: { fontWeight: "700", color: "#0a356a" },
  summaryValue: { color: APP_COLORS.texto || "#333", marginTop: 4 },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: APP_COLORS.blanco || "#fff",
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo || "#C8E6C9",
  },
  rank: { width: 28, textAlign: "center", fontWeight: "800", color: APP_COLORS.campo || "#2f7d32" },
  rowName: { fontWeight: "700", color: APP_COLORS.texto || "#333" },
  rowSub: { color: APP_COLORS.texto || "#333" },
  rowValue: { fontWeight: "700", color: APP_COLORS.campo || "#2f7d32" },

  teamLogo: { width: 32, height: 32, marginRight: 8, borderRadius: 16 },

  empty: { color: APP_COLORS.texto || "#333", textAlign: "center", marginVertical: 12 },

  voteCard: {
    backgroundColor: APP_COLORS.blanco || "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.cielo || "#C8E6C9",
    marginBottom: 8,
  },
  voteDate: { fontWeight: "700", color: APP_COLORS.campo || "#2f7d32", marginBottom: 4 },
  voteWinner: { color: APP_COLORS.texto || "#333" },
});




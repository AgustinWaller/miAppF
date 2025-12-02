import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { collection, onSnapshot } from "firebase/firestore";

import NewsScreen from "./src/screens/NewsScreen";
import MatchesScreen from "./src/screens/MatchesScreen";
import StandingsScreen from "./src/screens/StandingsScreen";
import TopPlayersScreen from "./src/screens/TopPlayersScreen";
import BestPlayerScreen from "./src/screens/BestPlayerScreen";
import TeamsScreen from "./src/screens/TeamsScreen";
import ExtrasScreen from "./src/screens/ExtrasScreen";
import TeamDetailScreen from "./src/screens/TeamDetailScreen";
import ScoreScreen from "./src/screens/ScoreScreen";
import LoginScreen from "./src/screens/LoginScreen";
import LogoutScreen from "./src/screens/LogoutScreen";
import NewsDetailScreen from "./src/screens/NewsDetailScreen";


import { APP_COLORS } from "./src/theme/colors";
import RootErrorBoundary from "./src/components/RootErrorBoundary";
import { loadFavoriteTeams, subscribeFavorites } from "./src/utils/favoritesStorage";

import { db, auth } from "./src/services/firebase";
import { onAuthStateChanged } from "firebase/auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: APP_COLORS.fondo,
    primary: APP_COLORS.campo,
    card: "#E8F5E9",
    text: APP_COLORS.texto,
    border: APP_COLORS.campo,
  },
};

function MainDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="Inicio"
      screenOptions={{
        headerStyle: { backgroundColor: APP_COLORS.campo },
        headerTintColor: APP_COLORS.blanco,
        headerTitleAlign: "center",
        drawerActiveTintColor: APP_COLORS.campo,
        drawerInactiveTintColor: APP_COLORS.texto,
        drawerStyle: { backgroundColor: "#E3F2FD" },
        drawerLabelStyle: { fontWeight: "600" },
      }}
    >
      <Drawer.Screen name="Inicio" component={NewsScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Partidos" component={MatchesScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Tabla de posiciones" component={StandingsScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Jugador del año" component={TopPlayersScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Jugador de la fecha" component={BestPlayerScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Equipos" component={TeamsScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Resumen" component={ExtrasScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Cerrar sesión" component={LogoutScreen} />
    </Drawer.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // === Listener de autenticación ===
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  // === Notificaciones + favoritos ===
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("vote-reminders", {
        name: "Recordatorios",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let unsubscribeMatches = null;
    const lastSignature = new Map();

    const attachMatchListener = (favoriteList) => {
      if (unsubscribeMatches) {
        unsubscribeMatches();
        unsubscribeMatches = null;
      }
      if (!favoriteList.length) return;
      const favSet = new Set(favoriteList);
      unsubscribeMatches = onSnapshot(collection(db, "matches"), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") {
            lastSignature.delete(change.doc.id);
            return;
          }
          const data = change.doc.data() || {};
          const isFav =
            favSet.has(data.localId) ||
            favSet.has(data.visitanteId) ||
            favSet.has(data.local) ||
            favSet.has(data.visitante);

          const signature = `${data.golesLocal}-${data.golesVisitante}-${(data.eventos || []).length}`;

          if (!isFav) {
            lastSignature.set(change.doc.id, signature);
            return;
          }

          const previous = lastSignature.get(change.doc.id);

          if (change.type === "modified" && signature !== previous) {
            const title = "Partido actualizado";
            const body = `${data.localName || data.localId || ""} ${data.golesLocal ?? "-"} - ${
              data.golesVisitante ?? "-"
            } ${data.visitanteName || data.visitanteId || ""}`;

            Notifications.scheduleNotificationAsync({
              content: { title, body, sound: "default" },
              trigger: null,
            }).catch(() => {});
          }

          lastSignature.set(change.doc.id, signature);
        });
      });
    };

    const setup = async () => {
      const initial = await loadFavoriteTeams();
      attachMatchListener(initial);
    };
    setup().catch(() => {});

    const unsubscribeFavorites = subscribeFavorites((list) => attachMatchListener(list));
    return () => {
      unsubscribeFavorites();
      if (unsubscribeMatches) unsubscribeMatches();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootErrorBoundary>
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: APP_COLORS.campo },
                headerTintColor: APP_COLORS.blanco,
              }}
            >
              {loadingAuth ? (
                <Stack.Screen name="Loading" component={() => null} options={{ headerShown: false }} />
              ) : user ? (
                <>
                  <Stack.Screen name="Main" component={MainDrawer} options={{ headerShown: false }} />
                  <Stack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: "Equipo" }} />
                  <Stack.Screen name="ScoreDetail" component={ScoreScreen} options={{ title: "Resultado" }} />
                  <Stack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ title: "Noticia" }} />
                </>
              ) : (
                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </RootErrorBoundary>
      </SafeAreaProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

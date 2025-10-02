import "react-native-gesture-handler";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import NewsScreen from "./src/screens/NewsScreen";
import MatchesScreen from "./src/screens/MatchesScreen";
import StandingsScreen from "./src/screens/StandingsScreen";
import TopPlayersScreen from "./src/screens/TopPlayersScreen";
import BestPlayerScreen from "./src/screens/BestPlayerScreen";
import TeamsScreen from "./src/screens/TeamsScreen";
import TeamDetailScreen from "./src/screens/TeamDetailScreen";
import ScoreScreen from "./src/screens/ScoreScreen";
import { APP_COLORS } from "./src/theme/colors";

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
      initialRouteName="Noticias"
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
      <Drawer.Screen name="Noticias" component={NewsScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Partidos" component={MatchesScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Tabla de posiciones" component={StandingsScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Goleadores" component={TopPlayersScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Jugador de la fecha" component={BestPlayerScreen} initialParams={{ division: "A" }} />
      <Drawer.Screen name="Equipos" component={TeamsScreen} initialParams={{ division: "A" }} />
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: APP_COLORS.campo },
              headerTintColor: APP_COLORS.blanco,
            }}
          >
            <Stack.Screen name="Main" component={MainDrawer} options={{ headerShown: false }} />
            <Stack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: "Equipo" }} />
            <Stack.Screen name="ScoreDetail" component={ScoreScreen} options={{ title: "Resultado" }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

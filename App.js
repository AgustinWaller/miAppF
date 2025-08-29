import 'react-native-gesture-handler'; // debe ser la primera importación
import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import HomeScreen from "./src/screens/HomeScreen";
import MatchesScreen from "./src/screens/MatchesScreen";
import StandingsScreen from "./src/screens/StandingsScreen";
import ScorersScreen from "./src/screens/ScorersScreen";
import BestPlayerScreen from "./src/screens/BestPlayerScreen";

const Drawer = createDrawerNavigator();

export default function App() {
  // División seleccionada global (A/B)
  const [division, setDivision] = useState("A");

  return (
    <NavigationContainer>
      <Drawer.Navigator
        initialRouteName="Inicio"
        screenOptions={{
          headerStyle: { backgroundColor: "#1e1e1e" },
          headerTintColor: "#fff",
          drawerStyle: { backgroundColor: "#121212", width: 260 },
          drawerActiveTintColor: "#fff",
          drawerInactiveTintColor: "#ccc",
        }}
      >
        <Drawer.Screen name="Inicio">
          {(props) => (
            <HomeScreen {...props} division={division} setDivision={setDivision} />
          )}
        </Drawer.Screen>

        <Drawer.Screen name="Partidos">
          {(props) => <MatchesScreen {...props} division={division} />}
        </Drawer.Screen>

        <Drawer.Screen name="Tabla de posiciones">
          {(props) => <StandingsScreen {...props} division={division} />}
        </Drawer.Screen>

        <Drawer.Screen name="Goleadores">
          {(props) => <ScorersScreen {...props} division={division} />}
        </Drawer.Screen>

        <Drawer.Screen name="Mejor jugador de la fecha">
          {(props) => <BestPlayerScreen {...props} division={division} />}
        </Drawer.Screen>
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

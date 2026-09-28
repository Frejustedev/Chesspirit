import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { colors } from "@/lib/theme";

const icon =
  (glyph: string) =>
  ({ color }: { color: ColorValue }) => (
    <Text
      style={{ color, fontSize: 20 }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {glyph}
    </Text>
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.bordeaux,
        tabBarInactiveTintColor: colors.stone,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Tournois", tabBarIcon: icon("♜") }} />
      <Tabs.Screen name="cotes" options={{ title: "Cotes", tabBarIcon: icon("♛") }} />
      <Tabs.Screen name="parties" options={{ title: "Parties", tabBarIcon: icon("♞") }} />
      <Tabs.Screen name="notifications" options={{ title: "Alertes", tabBarIcon: icon("♝") }} />
      <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: icon("♚") }} />
    </Tabs>
  );
}

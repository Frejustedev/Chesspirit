import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/session";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.ink,
            headerStyle: { backgroundColor: colors.paper },
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="connexion" options={{ title: "Connexion", presentation: "modal" }} />
          <Stack.Screen name="tournoi/[slug]" options={{ title: "Tournoi" }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

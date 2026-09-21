import { Stack } from "expo-router";
import { useEffect } from "react";
import { initDb } from "@/lib/db";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="index" options={{ title: "Soloracer" }} />
      <Stack.Screen name="create-trail" options={{ title: "Create Trail" }} />
      <Stack.Screen name="trails" options={{ title: "Trails" }} />
      <Stack.Screen name="drive" options={{ title: "Drive" }} />
    </Stack>
  );
}

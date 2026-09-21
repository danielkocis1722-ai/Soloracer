import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { getTrails } from "@/lib/db";
import { colors } from "@/lib/theme";

type Trail = {
  id: number;
  name: string;
  created_at: string;
  distance_m: number;
};

export default function TrailsScreen() {
  const [trails, setTrails] = useState<Trail[]>([]);

  useFocusEffect(
    useCallback(() => {
      getTrails().then(setTrails).catch(console.error);
    }, [])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={trails}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No trails yet. Record your first trail.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {new Date(item.created_at).toLocaleString()} · #{item.id}
            </Text>
            <Text style={styles.todo}>Checkpoint editor coming next.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 20, gap: 12, flexGrow: 1 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 60 },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6
  },
  name: { color: colors.text, fontSize: 20, fontWeight: "800" },
  meta: { color: colors.muted },
  todo: { color: colors.accent, marginTop: 4, fontWeight: "700" }
});

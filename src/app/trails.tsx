import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getTrails, TrailRow } from "@/lib/db";
import { colors } from "@/lib/theme";
import { formatDistance } from "@/lib/geo";

export default function TrailsScreen() {
  const [trails, setTrails] = useState<TrailRow[]>([]);

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
          <Link href={{ pathname: "/trail/[id]", params: { id: String(item.id) } }} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.distance}>{formatDistance(item.distance_m)}</Text>
              </View>
              <Text style={styles.meta}>
                {new Date(item.created_at).toLocaleString()} · #{item.id}
              </Text>
              <Text style={styles.open}>Open map →</Text>
            </Pressable>
          </Link>
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
    gap: 7
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { color: colors.text, fontSize: 20, fontWeight: "800", flex: 1 },
  distance: { color: colors.accent, fontWeight: "900", fontSize: 16 },
  meta: { color: colors.muted },
  open: { color: colors.accent, marginTop: 4, fontWeight: "800" }
});

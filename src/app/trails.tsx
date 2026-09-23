import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { deleteTrail, getTrails, TrailRow } from "@/lib/db";
import { colors } from "@/lib/theme";
import { formatDistance } from "@/lib/geo";

export default function TrailsScreen() {
  const [trails, setTrails] = useState<TrailRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      getTrails().then(setTrails).catch(console.error);
    }, [])
  );

  async function refreshTrails() {
    setTrails(await getTrails());
  }

  function confirmDelete(item: TrailRow) {
    Alert.alert(
      "Delete trail?",
      `"${item.name}" and its checkpoints/runs will be permanently deleted from this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteTrail(item.id)
              .then(refreshTrails)
              .catch((error) => {
                console.error(error);
                Alert.alert("Delete failed", "Could not delete this trail.");
              });
          }
        }
      ]
    );
  }

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
            <Link href={{ pathname: "/trail/[id]", params: { id: String(item.id) } }} asChild>
              <Pressable style={styles.openArea}>
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

            <Pressable
              style={styles.deleteButton}
              onPress={() => confirmDelete(item)}
              hitSlop={8}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
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
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden"
  },
  openArea: {
    padding: 18,
    gap: 7
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { color: colors.text, fontSize: 20, fontWeight: "800", flex: 1 },
  distance: { color: colors.accent, fontWeight: "900", fontSize: 16 },
  meta: { color: colors.muted },
  open: { color: colors.accent, marginTop: 4, fontWeight: "800" },
  deleteButton: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 11,
    alignItems: "center"
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: "900"
  }
});

import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { getTrail, getTrailPoints, TrailPointRow, TrailRow } from "@/lib/db";
import { colors } from "@/lib/theme";
import { formatDistance } from "@/lib/geo";

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trailId = Number(id);
  const [trail, setTrail] = useState<TrailRow | null>(null);
  const [points, setPoints] = useState<TrailPointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getTrail(trailId), getTrailPoints(trailId)])
      .then(([trailRow, pointRows]) => {
        if (!active) return;
        setTrail(trailRow ?? null);
        setPoints(pointRows);
      })
      .catch(console.error)
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [trailId]);

  useEffect(() => {
    if (points.length < 2) return;

    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
        animated: true
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [points]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!trail) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Trail not found.</Text>
      </View>
    );
  }

  const start = points[0];
  const finish = points[points.length - 1];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: trail.name }} />

      <MapView ref={mapRef} style={StyleSheet.absoluteFill} loadingEnabled>
        {points.length > 1 && (
          <Polyline
            coordinates={points}
            strokeColor={colors.accent}
            strokeWidth={6}
          />
        )}

        {start && (
          <Marker
            coordinate={start}
            title="START"
            description="Recorded trail start"
            pinColor="#44C477"
          />
        )}

        {finish && (
          <Marker
            coordinate={finish}
            title="FINISH"
            description="Recorded trail finish"
            pinColor="#FF4D4F"
          />
        )}
      </MapView>

      <View style={styles.infoCard}>
        <View>
          <Text style={styles.label}>DISTANCE</Text>
          <Text style={styles.value}>{formatDistance(trail.distance_m)}</Text>
        </View>
        <View>
          <Text style={styles.label}>GPS POINTS</Text>
          <Text style={styles.value}>{points.length}</Text>
        </View>
        <View style={styles.editorHint}>
          <Text style={styles.hintTitle}>Next: checkpoint editor</Text>
          <Text style={styles.hintText}>
            START and FINISH are shown from the recorded route. Next we will make them editable and add checkpoint placement directly on this map.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  empty: { color: colors.muted },
  infoCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    backgroundColor: "rgba(9,10,12,0.92)",
    borderWidth: 1,
    borderColor: colors.border
  },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  value: { color: colors.text, fontSize: 21, fontWeight: "900" },
  editorHint: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4
  },
  hintTitle: { color: colors.accent, fontWeight: "900" },
  hintText: { color: colors.muted, lineHeight: 19 }
});

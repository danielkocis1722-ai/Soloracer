import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation
} from "@maplibre/maplibre-react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { getTrail, getTrailPoints, TrailPointRow, TrailRow } from "@/lib/db";
import { colors } from "@/lib/theme";
import { formatDistance } from "@/lib/geo";
import { MAP_STYLE_URL, toLineFeature, toLngLat } from "@/lib/map";

function boundsFromPoints(points: TrailPointRow[]): [number, number, number, number] | undefined {
  if (points.length === 0) return undefined;

  const longitudes = points.map((point) => point.longitude);
  const latitudes = points.map((point) => point.latitude);

  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes)
  ];
}

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trailId = Number(id);
  const [trail, setTrail] = useState<TrailRow | null>(null);
  const [points, setPoints] = useState<TrailPointRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const bounds = useMemo(() => boundsFromPoints(points), [points]);
  const routeFeature = useMemo(() => toLineFeature(points), [points]);

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

      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        logo
        attribution
        compass
        compassPosition={{ top: 16, right: 16 }}
      >
        {bounds && (
          <Camera
            initialViewState={{
              bounds,
              padding: { top: 80, right: 50, bottom: 210, left: 50 }
            }}
          />
        )}

        {points.length > 1 && (
          <GeoJSONSource id="saved-route" data={routeFeature}>
            <Layer
              id="saved-route-line"
              type="line"
              source="saved-route"
              paint={{
                "line-color": colors.accent,
                "line-width": 6,
                "line-opacity": 0.95
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round"
              }}
            />
          </GeoJSONSource>
        )}

        {start && (
          <ViewAnnotation lngLat={toLngLat(start)} anchor="center">
            <View style={[styles.marker, styles.startMarker]}>
              <Text style={styles.markerText}>S</Text>
            </View>
          </ViewAnnotation>
        )}

        {finish && (
          <ViewAnnotation lngLat={toLngLat(finish)} anchor="center">
            <View style={[styles.marker, styles.finishMarker]}>
              <Text style={styles.markerText}>F</Text>
            </View>
          </ViewAnnotation>
        )}
      </Map>

      <View style={styles.infoCard}>
        <View style={styles.metricsRow}>
          <View>
            <Text style={styles.label}>DISTANCE</Text>
            <Text style={styles.value}>{formatDistance(trail.distance_m)}</Text>
          </View>
          <View>
            <Text style={styles.label}>GPS POINTS</Text>
            <Text style={styles.value}>{points.length}</Text>
          </View>
        </View>

        <View style={styles.editorHint}>
          <Text style={styles.hintTitle}>Next: checkpoint editor</Text>
          <Text style={styles.hintText}>
            START and FINISH are shown from the recorded route. Next we will make them editable and add checkpoints directly on the route.
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
  marker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  startMarker: { backgroundColor: colors.success },
  finishMarker: { backgroundColor: colors.danger },
  markerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  infoCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    backgroundColor: "rgba(9,10,12,0.94)",
    borderWidth: 1,
    borderColor: colors.border
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  },
  value: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "900"
  },
  editorHint: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4
  },
  hintTitle: {
    color: colors.accent,
    fontWeight: "900"
  },
  hintText: {
    color: colors.muted,
    lineHeight: 19
  }
});

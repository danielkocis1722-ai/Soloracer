import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation
} from "@maplibre/maplibre-react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  addCheckpoint,
  CheckpointRow,
  deleteCheckpoint,
  deleteTrail,
  getCheckpoints,
  getTrail,
  getTrailPoints,
  TrailPointRow,
  TrailRow
} from "@/lib/db";
import { colors } from "@/lib/theme";
import { distanceBetweenMeters, formatDistance } from "@/lib/geo";
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

function nearestTrailPoint(
  latitude: number,
  longitude: number,
  points: TrailPointRow[]
) {
  if (points.length === 0) return undefined;

  let nearest = points[0];
  let nearestDistance = distanceBetweenMeters(
    { latitude, longitude },
    nearest
  );

  for (let index = 1; index < points.length; index += 1) {
    const distance = distanceBetweenMeters(
      { latitude, longitude },
      points[index]
    );

    if (distance < nearestDistance) {
      nearest = points[index];
      nearestDistance = distance;
    }
  }

  return {
    point: nearest,
    distance: nearestDistance,
    index: points.findIndex((point) => point.id === nearest.id)
  };
}

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trailId = Number(id);
  const router = useRouter();
  const [trail, setTrail] = useState<TrailRow | null>(null);
  const [points, setPoints] = useState<TrailPointRow[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCheckpoints, setEditingCheckpoints] = useState(false);

  async function refreshCheckpoints() {
    setCheckpoints(await getCheckpoints(trailId));
  }

  useEffect(() => {
    let active = true;

    Promise.all([getTrail(trailId), getTrailPoints(trailId), getCheckpoints(trailId)])
      .then(([trailRow, pointRows, checkpointRows]) => {
        if (!active) return;
        setTrail(trailRow ?? null);
        setPoints(pointRows);
        setCheckpoints(checkpointRows);
      })
      .catch(console.error)
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [trailId]);

  const bounds = useMemo(() => boundsFromPoints(points), [points]);
  const routeFeature = useMemo(() => toLineFeature(points), [points]);

  async function handleMapPress(latitude: number, longitude: number) {
    if (!editingCheckpoints || points.length === 0) return;

    const nearest = nearestTrailPoint(latitude, longitude, points);
    if (!nearest) return;

    // Prevent accidental checkpoints far away from the recorded trail.
    if (nearest.distance > 100) {
      Alert.alert("Too far from trail", "Tap closer to the recorded route.");
      return;
    }

    const start = points[0];
    const finish = points[points.length - 1];
    const endpointGuardM = 50;

    const nearStart =
      nearest.index === 0 ||
      distanceBetweenMeters(nearest.point, start) < endpointGuardM;
    const nearFinish =
      nearest.index === points.length - 1 ||
      distanceBetweenMeters(nearest.point, finish) < endpointGuardM;

    if (nearStart || nearFinish) {
      Alert.alert(
        "Start / finish zone",
        "Checkpoint cannot be placed within 50 m of START or FINISH."
      );
      return;
    }

    await addCheckpoint(
      trailId,
      nearest.point.latitude,
      nearest.point.longitude
    );
    await refreshCheckpoints();
  }

  async function handleDeleteCheckpoint(checkpoint: CheckpointRow) {
    if (!editingCheckpoints) return;

    Alert.alert(
      `Delete ${checkpoint.name}?`,
      "This checkpoint will be removed from the trail.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteCheckpoint(checkpoint.id, trailId).then(refreshCheckpoints);
          }
        }
      ]
    );
  }

  function handleDeleteTrail() {
    Alert.alert(
      "Delete trail?",
      `"${trail?.name ?? "Trail"}" and its checkpoints/runs will be permanently deleted from this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteTrail(trailId)
              .then(() => router.replace("/trails"))
              .catch((error) => {
                console.error(error);
                Alert.alert("Delete failed", "Could not delete this trail.");
              });
          }
        }
      ]
    );
  }

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
        onPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          void handleMapPress(latitude, longitude);
        }}
      >
        {bounds && (
          <Camera
            initialViewState={{
              bounds,
              padding: { top: 80, right: 50, bottom: 245, left: 50 }
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

        {checkpoints.map((checkpoint) => (
          <ViewAnnotation
            key={checkpoint.id}
            lngLat={toLngLat(checkpoint)}
            anchor="center"
            onPress={(event) => {
              event.stopPropagation();
              void handleDeleteCheckpoint(checkpoint);
            }}
          >
            <View
              style={[
                styles.marker,
                styles.checkpointMarker,
                editingCheckpoints && styles.checkpointMarkerEditing
              ]}
            >
              <Text style={styles.markerText}>{checkpoint.checkpoint_order}</Text>
            </View>
          </ViewAnnotation>
        ))}
      </Map>

      {editingCheckpoints && (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerTitle}>Checkpoint editor</Text>
          <Text style={styles.editBannerText}>
            Tap near the orange route to add a checkpoint. Tap a checkpoint to delete it.
          </Text>
        </View>
      )}

      <View style={styles.infoCard}>
        <View style={styles.metricsRow}>
          <View>
            <Text style={styles.label}>DISTANCE</Text>
            <Text style={styles.value}>{formatDistance(trail.distance_m)}</Text>
          </View>
          <View>
            <Text style={styles.label}>CHECKPOINTS</Text>
            <Text style={styles.value}>{checkpoints.length}</Text>
          </View>
          <View>
            <Text style={styles.label}>GPS POINTS</Text>
            <Text style={styles.value}>{points.length}</Text>
          </View>
        </View>

        <Pressable
          style={[
            styles.editorButton,
            editingCheckpoints && styles.editorButtonActive
          ]}
          onPress={() => setEditingCheckpoints((current) => !current)}
        >
          <Text style={styles.editorButtonText}>
            {editingCheckpoints ? "Done editing" : "Edit checkpoints"}
          </Text>
        </Pressable>

        <Text style={styles.hintText}>
          {editingCheckpoints
            ? "New checkpoints snap to the nearest recorded GPS point. START and FINISH have a protected 50 m zone."
            : "START and FINISH come from the recorded route. Add checkpoints before using timed Drive mode."}
        </Text>

        {!editingCheckpoints && (
          <Pressable style={styles.deleteButton} onPress={handleDeleteTrail}>
            <Text style={styles.deleteButtonText}>Delete trail</Text>
          </Pressable>
        )}
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
  checkpointMarker: { backgroundColor: "#1F6FEB" },
  checkpointMarkerEditing: {
    width: 34,
    height: 34,
    borderRadius: 17
  },
  markerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  editBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 80,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(9,10,12,0.94)",
    borderWidth: 1,
    borderColor: colors.accent
  },
  editBannerTitle: {
    color: colors.accent,
    fontWeight: "900"
  },
  editBannerText: {
    marginTop: 2,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17
  },
  infoCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    borderRadius: 18,
    padding: 16,
    gap: 12,
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
  editorButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent
  },
  editorButtonActive: {
    backgroundColor: "#2A2D33",
    borderWidth: 1,
    borderColor: colors.accent
  },
  editorButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  },
  hintText: {
    color: colors.muted,
    lineHeight: 18
  },
  deleteButton: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(255,77,79,0.08)"
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: "900",
    fontSize: 14
  }
});

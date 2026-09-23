import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { ensureForegroundLocationPermission, watchDrivingLocation } from "@/lib/gps";
import { saveTrail } from "@/lib/db";
import { colors } from "@/lib/theme";
import { formatDistance, polylineDistanceMeters } from "@/lib/geo";
import { MAP_STYLE_URL, toLineFeature, toLngLat } from "@/lib/map";

type RecordedPoint = {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  timestamp: number;
};

export default function CreateTrailScreen() {
  const [name, setName] = useState("");
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<RecordedPoint[]>([]);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const subscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => subscription.current?.remove();
  }, []);

  async function startRecording() {
    if (!(await ensureForegroundLocationPermission())) {
      Alert.alert("Location required", "Soloracer needs GPS access while recording a trail.");
      return;
    }

    setPoints([]);

    subscription.current = await watchDrivingLocation((location) => {
      const point: RecordedPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp
      };

      setAccuracy(location.coords.accuracy);
      setPoints((current) => [...current, point]);
    });

    setRecording(true);
  }

  async function finishRecording() {
    subscription.current?.remove();
    subscription.current = null;
    setRecording(false);

    if (points.length < 2) {
      Alert.alert("Not enough GPS points", "Record a little more of the route first.");
      return;
    }

    const trailName = name.trim() || `Trail ${new Date().toLocaleDateString()}`;
    await saveTrail(trailName, points);

    Alert.alert(
      "Trail saved",
      `${trailName} saved · ${formatDistance(polylineDistanceMeters(points))} · ${points.length} GPS points`
    );

    setPoints([]);
    setName("");
    setAccuracy(null);
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const distance = polylineDistanceMeters(points);
  const routeFeature = toLineFeature(points);

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE_URL}
          logo
          attribution
          compass
          compassPosition={{ top: 16, right: 16 }}
        >
          {lastPoint && (
            <Camera
              center={toLngLat(lastPoint)}
              zoom={17}
              pitch={recording ? 28 : 0}
              duration={500}
              easing="ease"
            />
          )}

          {points.length > 1 && (
            <>
              <GeoJSONSource id="recorded-route" data={routeFeature}>
                <Layer
                  id="recorded-route-line"
                  type="line"
                  source="recorded-route"
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
            </>
          )}

          {firstPoint && (
            <ViewAnnotation lngLat={toLngLat(firstPoint)} anchor="center">
              <View style={[styles.marker, styles.startMarker]}>
                <Text style={styles.markerText}>S</Text>
              </View>
            </ViewAnnotation>
          )}

          {lastPoint && (
            <ViewAnnotation lngLat={toLngLat(lastPoint)} anchor="center">
              <View style={[styles.marker, styles.currentMarker]} />
            </ViewAnnotation>
          )}
        </Map>

        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>
            {recording ? "● RECORDING" : "MAPLIBRE"}
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <TextInput
          value={name}
          onChangeText={setName}
          editable={!recording}
          placeholder="Trail name"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <View style={styles.metrics}>
          <View>
            <Text style={styles.metricLabel}>DISTANCE</Text>
            <Text style={styles.metricValue}>{formatDistance(distance)}</Text>
          </View>
          <View>
            <Text style={styles.metricLabel}>GPS POINTS</Text>
            <Text style={styles.metricValue}>{points.length}</Text>
          </View>
          <View>
            <Text style={styles.metricLabel}>ACCURACY</Text>
            <Text style={styles.metricValue}>
              {accuracy == null ? "—" : `±${accuracy.toFixed(0)} m`}
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.button, recording && styles.stopButton]}
          onPress={recording ? finishRecording : startRecording}
        >
          <Text style={styles.buttonText}>
            {recording ? "Finish & Save Trail" : "Start Recording"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1, minHeight: 360 },
  mapBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(9,10,12,0.88)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  mapBadgeText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#FFFFFF"
  },
  startMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center"
  },
  currentMarker: {
    backgroundColor: colors.accent
  },
  markerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  panel: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    gap: 14
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    color: colors.text,
    padding: 14,
    fontSize: 16
  },
  metrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3
  },
  button: {
    borderRadius: 16,
    backgroundColor: colors.accent,
    paddingVertical: 17,
    alignItems: "center"
  },
  stopButton: { backgroundColor: colors.danger },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900"
  }
});

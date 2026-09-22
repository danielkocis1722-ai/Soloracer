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
import MapView, { Marker, Polyline } from "react-native-maps";
import { ensureForegroundLocationPermission, watchDrivingLocation } from "@/lib/gps";
import { saveTrail } from "@/lib/db";
import { colors } from "@/lib/theme";
import { formatDistance, polylineDistanceMeters } from "@/lib/geo";

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
  const mapRef = useRef<MapView | null>(null);

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

      mapRef.current?.animateCamera(
        {
          center: {
            latitude: point.latitude,
            longitude: point.longitude
          },
          zoom: 17,
          heading: location.coords.heading ?? 0,
          pitch: 20
        },
        { duration: 450 }
      );
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
    const id = await saveTrail(trailName, points);
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

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          showsUserLocation
          showsMyLocationButton
          loadingEnabled
          mapType="standard"
        >
          {points.length > 1 && (
            <Polyline
              coordinates={points}
              strokeColor={colors.accent}
              strokeWidth={6}
            />
          )}

          {firstPoint && (
            <Marker
              coordinate={firstPoint}
              title="START"
              pinColor="#44C477"
            />
          )}

          {lastPoint && points.length > 1 && (
            <Marker
              coordinate={lastPoint}
              title="Current end"
              pinColor={colors.accent}
            />
          )}
        </MapView>

        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>
            {recording ? "● RECORDING" : "GPS MAP"}
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
    backgroundColor: "rgba(9,10,12,0.86)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  mapBadgeText: { color: colors.text, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
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
  metrics: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 3 },
  button: {
    borderRadius: 16,
    backgroundColor: colors.accent,
    paddingVertical: 17,
    alignItems: "center"
  },
  stopButton: { backgroundColor: colors.danger },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" }
});

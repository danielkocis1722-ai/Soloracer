import * as Location from "expo-location";
import { useRef, useState } from "react";
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
  const subscription = useRef<Location.LocationSubscription | null>(null);

  async function startRecording() {
    if (!(await ensureForegroundLocationPermission())) {
      Alert.alert("Location required", "Soloracer needs GPS access while recording a trail.");
      return;
    }

    setPoints([]);
    subscription.current = await watchDrivingLocation((location) => {
      setPoints((current) => [
        ...current,
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp
        }
      ]);
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
    Alert.alert("Trail saved", `${trailName} saved with ${points.length} GPS points (ID ${id}).`);
    setPoints([]);
    setName("");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>TRAIL NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        editable={!recording}
        placeholder="Mountain Road"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />

      <View style={styles.status}>
        <Text style={styles.statusTitle}>{recording ? "Recording route" : "Ready to record"}</Text>
        <Text style={styles.statusValue}>{points.length} GPS points</Text>
        <Text style={styles.hint}>
          Start recording before entering the route. Keep Soloracer open while recording.
        </Text>
      </View>

      <Pressable
        style={[styles.button, recording && styles.stopButton]}
        onPress={recording ? finishRecording : startRecording}
      >
        <Text style={styles.buttonText}>{recording ? "Finish Trail" : "Start Recording"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, gap: 16 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    color: colors.text,
    padding: 16,
    fontSize: 17
  },
  status: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
    gap: 8
  },
  statusTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  statusValue: { color: colors.accent, fontSize: 34, fontWeight: "900" },
  hint: { color: colors.muted, lineHeight: 20 },
  button: {
    marginTop: "auto",
    borderRadius: 16,
    backgroundColor: colors.accent,
    paddingVertical: 18,
    alignItems: "center"
  },
  stopButton: { backgroundColor: colors.danger },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" }
});

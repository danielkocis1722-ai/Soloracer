import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ensureForegroundLocationPermission, speedToKmh, watchDrivingLocation } from "@/lib/gps";
import { colors } from "@/lib/theme";

export default function DriveScreen() {
  useKeepAwake();

  const [watching, setWatching] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const subscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (startedAt.current) setElapsedMs(Date.now() - startedAt.current);
    }, 50);

    return () => {
      clearInterval(interval);
      subscription.current?.remove();
    };
  }, []);

  async function armDrive() {
    if (!(await ensureForegroundLocationPermission())) {
      Alert.alert("Location required", "GPS permission is required for Drive mode.");
      return;
    }

    subscription.current = await watchDrivingLocation((location) => {
      setSpeed(speedToKmh(location.coords.speed));
      setAccuracy(location.coords.accuracy);
    });

    startedAt.current = Date.now();
    setElapsedMs(0);
    setWatching(true);
    Speech.speak("Soloracer armed", { rate: 0.95 });
  }

  function stopDrive() {
    subscription.current?.remove();
    subscription.current = null;
    startedAt.current = null;
    setWatching(false);
    Speech.stop();
  }

  const seconds = elapsedMs / 1000;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.label}>STATUS</Text>
          <Text style={[styles.status, watching && styles.active]}>
            {watching ? "ARMED" : "IDLE"}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.label}>GPS ACCURACY</Text>
          <Text style={styles.smallValue}>
            {accuracy == null ? "—" : `±${accuracy.toFixed(0)} m`}
          </Text>
        </View>
      </View>

      <View style={styles.center}>
        <Text style={styles.bigSpeed}>{speed.toFixed(0)}</Text>
        <Text style={styles.unit}>km/h</Text>
        <Text style={styles.timer}>{seconds.toFixed(2)} s</Text>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.label}>NEXT PACE NOTE</Text>
        <Text style={styles.note}>—</Text>
        <Text style={styles.noteHint}>
          Trail matching, auto-start, checkpoints and pace-note generation are the next milestone.
        </Text>
      </View>

      <Pressable
        style={[styles.button, watching && styles.stopButton]}
        onPress={watching ? stopDrive : armDrive}
      >
        <Text style={styles.buttonText}>{watching ? "Stop" : "Arm Drive Mode"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, gap: 18 },
  topRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  right: { alignItems: "flex-end" },
  label: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  status: { color: colors.muted, fontWeight: "900", fontSize: 18, marginTop: 4 },
  active: { color: colors.success },
  smallValue: { color: colors.text, fontWeight: "800", fontSize: 18, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bigSpeed: { color: colors.text, fontSize: 100, lineHeight: 104, fontWeight: "900" },
  unit: { color: colors.muted, fontSize: 20, fontWeight: "700" },
  timer: { color: colors.accent, fontSize: 34, fontWeight: "900", marginTop: 24 },
  noteCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    gap: 8
  },
  note: { color: colors.text, fontSize: 40, fontWeight: "900" },
  noteHint: { color: colors.muted, lineHeight: 19 },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center"
  },
  stopButton: { backgroundColor: colors.danger },
  buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 17 }
});

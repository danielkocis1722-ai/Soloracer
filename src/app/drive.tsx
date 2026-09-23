import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  ViewAnnotation
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  CheckpointRow,
  createRun,
  finishRun,
  getCheckpoints,
  getTrailPoints,
  getTrails,
  saveRunSplit,
  TrailPointRow,
  TrailRow
} from "@/lib/db";
import { distanceBetweenMeters, formatDistance } from "@/lib/geo";
import {
  ensureForegroundLocationPermission,
  speedToKmh,
  watchDrivingLocation
} from "@/lib/gps";
import { MAP_STYLE_URL, toLineFeature, toLngLat } from "@/lib/map";
import { colors } from "@/lib/theme";

type DriveStatus = "IDLE" | "ARMED" | "RUNNING" | "FINISHED";

type SplitValue = {
  checkpointId: number;
  name: string;
  elapsedMs: number;
};

const START_FINISH_RADIUS_M = 25;

function formatTime(ms: number) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  if (minutes === 0) return `${seconds.toFixed(2)} s`;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export default function DriveScreen() {
  useKeepAwake();

  const [trails, setTrails] = useState<TrailRow[]>([]);
  const [selectedTrailId, setSelectedTrailId] = useState<number | null>(null);
  const [points, setPoints] = useState<TrailPointRow[]>([]);
  const [checkpoints, setCheckpoints] = useState<CheckpointRow[]>([]);
  const [status, setStatus] = useState<DriveStatus>("IDLE");
  const [speed, setSpeed] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  const [splits, setSplits] = useState<SplitValue[]>([]);

  const subscription = useRef<Location.LocationSubscription | null>(null);
  const statusRef = useRef<DriveStatus>("IDLE");
  const startedAt = useRef<number | null>(null);
  const runIdRef = useRef<number | null>(null);
  const nextCheckpointIndex = useRef(0);
  const speedSamples = useRef<number[]>([]);
  const pointsRef = useRef<TrailPointRow[]>([]);
  const checkpointsRef = useRef<CheckpointRow[]>([]);
  const selectedTrailIdRef = useRef<number | null>(null);

  useEffect(() => {
    getTrails()
      .then((rows) => {
        setTrails(rows);
        if (rows.length > 0) setSelectedTrailId(rows[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    selectedTrailIdRef.current = selectedTrailId;

    if (selectedTrailId == null) {
      setPoints([]);
      setCheckpoints([]);
      pointsRef.current = [];
      checkpointsRef.current = [];
      return;
    }

    Promise.all([
      getTrailPoints(selectedTrailId),
      getCheckpoints(selectedTrailId)
    ])
      .then(([pointRows, checkpointRows]) => {
        setPoints(pointRows);
        setCheckpoints(checkpointRows);
        pointsRef.current = pointRows;
        checkpointsRef.current = checkpointRows;
        resetSession(false);
      })
      .catch(console.error);
  }, [selectedTrailId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (statusRef.current === "RUNNING" && startedAt.current != null) {
        setElapsedMs(Date.now() - startedAt.current);
      }
    }, 50);

    return () => {
      clearInterval(interval);
      subscription.current?.remove();
    };
  }, []);

  const selectedTrail = trails.find((trail) => trail.id === selectedTrailId) ?? null;
  const routeFeature = useMemo(() => toLineFeature(points), [points]);
  const currentHeading =
    position?.coords.heading != null && position.coords.heading >= 0
      ? position.coords.heading
      : 0;

  function setDriveStatus(next: DriveStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  function resetSession(stopGps = true) {
    if (stopGps) {
      subscription.current?.remove();
      subscription.current = null;
    }

    startedAt.current = null;
    runIdRef.current = null;
    nextCheckpointIndex.current = 0;
    speedSamples.current = [];
    setElapsedMs(0);
    setSplits([]);
    setSpeed(0);
    setDriveStatus("IDLE");
    Speech.stop();
  }

  async function startTimedRun(now: number) {
    const trailId = selectedTrailIdRef.current;
    if (trailId == null || statusRef.current !== "ARMED") return;

    const runId = await createRun(trailId, now);
    runIdRef.current = runId;
    startedAt.current = now;
    nextCheckpointIndex.current = 0;
    speedSamples.current = [];
    setElapsedMs(0);
    setSplits([]);
    setDriveStatus("RUNNING");
    Speech.speak("Start", { rate: 1 });
  }

  async function completeRun(now: number) {
    const runId = runIdRef.current;
    const start = startedAt.current;
    if (runId == null || start == null || statusRef.current !== "RUNNING") return;

    const finalElapsed = now - start;
    const samples = speedSamples.current;
    const avgSpeed =
      samples.length === 0
        ? 0
        : samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const maxSpeed = samples.length === 0 ? 0 : Math.max(...samples);

    await finishRun(runId, now, finalElapsed, avgSpeed, maxSpeed);

    setElapsedMs(finalElapsed);
    setDriveStatus("FINISHED");
    subscription.current?.remove();
    subscription.current = null;
    Speech.speak("Finish", { rate: 1 });
  }

  async function processLocation(location: Location.LocationObject) {
    setPosition(location);
    setAccuracy(location.coords.accuracy);

    const kmh = speedToKmh(location.coords.speed);
    setSpeed(kmh);

    const current = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    };
    const routePoints = pointsRef.current;
    const routeCheckpoints = checkpointsRef.current;

    if (routePoints.length < 2) return;

    const startPoint = routePoints[0];
    const finishPoint = routePoints[routePoints.length - 1];

    if (statusRef.current === "ARMED") {
      const startDistance = distanceBetweenMeters(current, startPoint);
      if (startDistance <= START_FINISH_RADIUS_M) {
        await startTimedRun(Date.now());
      }
      return;
    }

    if (statusRef.current !== "RUNNING" || startedAt.current == null) return;

    speedSamples.current.push(kmh);

    const checkpoint = routeCheckpoints[nextCheckpointIndex.current];
    if (checkpoint) {
      const checkpointDistance = distanceBetweenMeters(current, checkpoint);

      if (checkpointDistance <= checkpoint.radius_m) {
        const splitElapsed = Date.now() - startedAt.current;
        const runId = runIdRef.current;

        if (runId != null) {
          await saveRunSplit(runId, checkpoint.id, splitElapsed);
        }

        setSplits((currentSplits) => [
          ...currentSplits,
          {
            checkpointId: checkpoint.id,
            name: checkpoint.name,
            elapsedMs: splitElapsed
          }
        ]);

        nextCheckpointIndex.current += 1;
        Speech.speak(checkpoint.name, { rate: 1.05 });
      }
      return;
    }

    const finishDistance = distanceBetweenMeters(current, finishPoint);
    if (finishDistance <= START_FINISH_RADIUS_M) {
      await completeRun(Date.now());
    }
  }

  async function armDrive() {
    if (selectedTrailId == null || points.length < 2) {
      Alert.alert("Select a trail", "Choose a saved trail before arming Drive mode.");
      return;
    }

    if (!(await ensureForegroundLocationPermission())) {
      Alert.alert("Location required", "GPS permission is required for Drive mode.");
      return;
    }

    resetSession(true);
    setDriveStatus("ARMED");

    subscription.current = await watchDrivingLocation((location) => {
      void processLocation(location).catch(console.error);
    });

    Speech.speak("Soloracer armed", { rate: 0.95 });
  }

  function stopDrive() {
    resetSession(true);
  }

  const nextCheckpoint =
    checkpoints[nextCheckpointIndex.current] ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE_URL}
          logo={false}
          attribution
          compass
          compassPosition={{ top: 12, right: 12 }}
        >
          {points.length > 1 && (
            <GeoJSONSource id="drive-route" data={routeFeature}>
              <Layer
                id="drive-route-line"
                type="line"
                source="drive-route"
                paint={{
                  "line-color": colors.accent,
                  "line-width": 7,
                  "line-opacity": 0.96
                }}
                layout={{
                  "line-cap": "round",
                  "line-join": "round"
                }}
              />
            </GeoJSONSource>
          )}

          {checkpoints.map((checkpoint) => (
            <ViewAnnotation
              key={checkpoint.id}
              lngLat={toLngLat(checkpoint)}
              anchor="center"
            >
              <View style={styles.checkpointDot}>
                <Text style={styles.checkpointDotText}>
                  {checkpoint.checkpoint_order}
                </Text>
              </View>
            </ViewAnnotation>
          ))}

          {position && (
            <ViewAnnotation
              lngLat={[
                position.coords.longitude,
                position.coords.latitude
              ]}
              anchor="center"
            >
              <View style={styles.carMarker}>
                <View style={styles.carMarkerCore} />
              </View>
            </ViewAnnotation>
          )}

          {position ? (
            <Camera
              centerCoordinate={[
                position.coords.longitude,
                position.coords.latitude
              ]}
              zoomLevel={16.7}
              pitch={48}
              heading={currentHeading}
              animationMode="easeTo"
              animationDuration={450}
              padding={{ top: 170, right: 40, bottom: 70, left: 40 }}
            />
          ) : points.length > 0 ? (
            <Camera
              initialViewState={{
                center: toLngLat(points[0]),
                zoom: 15
              }}
            />
          ) : null}
        </Map>

        <View style={styles.mapTopBar}>
          <View>
            <Text style={styles.label}>STATUS</Text>
            <Text
              style={[
                styles.status,
                status === "ARMED" && styles.armed,
                status === "RUNNING" && styles.active,
                status === "FINISHED" && styles.finished
              ]}
            >
              {status}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.label}>GPS</Text>
            <Text style={styles.smallValue}>
              {accuracy == null ? "—" : `±${accuracy.toFixed(0)} m`}
            </Text>
          </View>
        </View>

        <View style={styles.mapBottomBar}>
          <View>
            <Text style={styles.label}>NEXT</Text>
            <Text style={styles.nextText}>
              {status === "ARMED"
                ? "START"
                : status === "RUNNING"
                  ? nextCheckpoint?.name ?? "FINISH"
                  : status === "FINISHED"
                    ? "DONE"
                    : "SELECT TRAIL"}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.speed}>{speed.toFixed(0)}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trailPicker}
      >
        {trails.map((trail) => {
          const selected = trail.id === selectedTrailId;
          return (
            <Pressable
              key={trail.id}
              disabled={status === "ARMED" || status === "RUNNING"}
              onPress={() => setSelectedTrailId(trail.id)}
              style={[styles.trailChip, selected && styles.trailChipSelected]}
            >
              <Text
                style={[
                  styles.trailChipTitle,
                  selected && styles.trailChipTitleSelected
                ]}
              >
                {trail.name}
              </Text>
              <Text style={styles.trailChipMeta}>
                {formatDistance(trail.distance_m)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedTrail ? (
        <View style={styles.timingCard}>
          <View style={styles.timerRow}>
            <View>
              <Text style={styles.label}>TIME</Text>
              <Text style={styles.timer}>{formatTime(elapsedMs)}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.label}>TRAIL</Text>
              <Text style={styles.trailName}>{selectedTrail.name}</Text>
            </View>
          </View>

          <View style={styles.splitHeader}>
            <Text style={styles.label}>SPLITS</Text>
            <Text style={styles.splitProgress}>
              {splits.length}/{checkpoints.length}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.splitRow}
          >
            {checkpoints.length === 0 ? (
              <Text style={styles.noSplits}>No checkpoints on this trail.</Text>
            ) : (
              checkpoints.map((checkpoint) => {
                const split = splits.find(
                  (item) => item.checkpointId === checkpoint.id
                );

                return (
                  <View key={checkpoint.id} style={styles.splitPill}>
                    <Text style={styles.splitName}>{checkpoint.name}</Text>
                    <Text style={styles.splitTime}>
                      {split ? formatTime(split.elapsedMs) : "—"}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No trails yet</Text>
          <Text style={styles.emptyText}>
            Record a trail first, then come back to Drive mode.
          </Text>
        </View>
      )}

      <Pressable
        disabled={trails.length === 0}
        style={[
          styles.button,
          (status === "ARMED" || status === "RUNNING") && styles.stopButton,
          trails.length === 0 && styles.buttonDisabled
        ]}
        onPress={
          status === "ARMED" || status === "RUNNING"
            ? stopDrive
            : armDrive
        }
      >
        <Text style={styles.buttonText}>
          {status === "ARMED"
            ? "Cancel"
            : status === "RUNNING"
              ? "Stop Run"
              : status === "FINISHED"
                ? "Arm Again"
                : "Arm Drive Mode"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 14,
    gap: 12
  },
  mapWrap: {
    height: "46%",
    minHeight: 310,
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  mapTopBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "rgba(9,10,12,0.88)"
  },
  mapBottomBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(9,10,12,0.90)"
  },
  right: { alignItems: "flex-end" },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2
  },
  status: {
    color: colors.muted,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 2
  },
  armed: { color: "#FFB020" },
  active: { color: colors.success },
  finished: { color: colors.accent },
  smallValue: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
    marginTop: 2
  },
  nextText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2
  },
  speed: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 40,
    fontWeight: "900"
  },
  speedUnit: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  carMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,92,29,0.24)",
    borderWidth: 2,
    borderColor: colors.accent
  },
  carMarkerCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent
  },
  checkpointDot: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "#1F6FEB",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  checkpointDotText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900"
  },
  trailPicker: {
    gap: 8,
    paddingRight: 8
  },
  trailChip: {
    minWidth: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  trailChipSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(255,92,29,0.11)"
  },
  trailChipTitle: {
    color: colors.text,
    fontWeight: "800",
    maxWidth: 150
  },
  trailChipTitleSelected: {
    color: colors.accent
  },
  trailChipMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3
  },
  timingCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 10
  },
  timerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12
  },
  timer: {
    color: colors.accent,
    fontSize: 31,
    fontWeight: "900",
    marginTop: 2
  },
  trailName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    maxWidth: 180
  },
  splitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  splitProgress: {
    color: colors.muted,
    fontWeight: "800",
    fontSize: 12
  },
  splitRow: {
    gap: 8,
    minHeight: 54,
    alignItems: "center"
  },
  splitPill: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt
  },
  splitName: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900"
  },
  splitTime: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3
  },
  noSplits: {
    color: colors.muted,
    fontSize: 13
  },
  emptyCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  emptyText: {
    color: colors.muted,
    marginTop: 4
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center"
  },
  stopButton: {
    backgroundColor: colors.danger
  },
  buttonDisabled: {
    opacity: 0.45
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16
  }
});

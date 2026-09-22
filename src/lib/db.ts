import * as SQLite from "expo-sqlite";
import { polylineDistanceMeters } from "@/lib/geo";

let database: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (!database) {
    database = await SQLite.openDatabaseAsync("soloracer.db");
  }
  return database;
}

export async function initDb() {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS trails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      distance_m REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trail_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trail_id INTEGER NOT NULL,
      point_index INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude REAL,
      accuracy REAL,
      recorded_at INTEGER NOT NULL,
      FOREIGN KEY (trail_id) REFERENCES trails(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trail_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_m REAL NOT NULL DEFAULT 20,
      checkpoint_order INTEGER NOT NULL,
      FOREIGN KEY (trail_id) REFERENCES trails(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trail_id INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      elapsed_ms INTEGER,
      avg_speed_kmh REAL,
      max_speed_kmh REAL,
      rating INTEGER,
      road_condition TEXT,
      weather_condition TEXT,
      traffic_level TEXT,
      note TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (trail_id) REFERENCES trails(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS run_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      checkpoint_id INTEGER NOT NULL,
      elapsed_ms INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );
  `);
}

export type TrailRow = {
  id: number;
  name: string;
  created_at: string;
  distance_m: number;
};

export type TrailPointRow = {
  id: number;
  trail_id: number;
  point_index: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  recorded_at: number;
};

export async function saveTrail(
  name: string,
  points: Array<{
    latitude: number;
    longitude: number;
    altitude?: number | null;
    accuracy?: number | null;
    timestamp: number;
  }>
) {
  const db = await getDb();
  const distance = polylineDistanceMeters(points);

  const result = await db.runAsync(
    "INSERT INTO trails (name, created_at, distance_m) VALUES (?, ?, ?)",
    name,
    new Date().toISOString(),
    distance
  );

  const trailId = Number(result.lastInsertRowId);

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    await db.runAsync(
      `INSERT INTO trail_points
       (trail_id, point_index, latitude, longitude, altitude, accuracy, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      trailId,
      index,
      point.latitude,
      point.longitude,
      point.altitude ?? null,
      point.accuracy ?? null,
      point.timestamp
    );
  }

  return trailId;
}

export async function getTrails() {
  const db = await getDb();
  return db.getAllAsync<TrailRow>("SELECT * FROM trails ORDER BY id DESC");
}

export async function getTrail(id: number) {
  const db = await getDb();
  return db.getFirstAsync<TrailRow>("SELECT * FROM trails WHERE id = ?", id);
}

export async function getTrailPoints(trailId: number) {
  const db = await getDb();
  return db.getAllAsync<TrailPointRow>(
    "SELECT * FROM trail_points WHERE trail_id = ? ORDER BY point_index ASC",
    trailId
  );
}

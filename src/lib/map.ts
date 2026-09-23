export const MAP_STYLE_URL = "https://demotiles.maplibre.org/style.json";

export type LngLat = [number, number];

export function toLngLat(point: { latitude: number; longitude: number }): LngLat {
  return [point.longitude, point.latitude];
}

export function toLineFeature(points: Array<{ latitude: number; longitude: number }>) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: points.map(toLngLat)
    }
  };
}

import * as Location from "expo-location";

export async function ensureForegroundLocationPermission() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

export function watchDrivingLocation(
  onLocation: (location: Location.LocationObject) => void
) {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 3,
      timeInterval: 1000
    },
    onLocation
  );
}

export function speedToKmh(speedMetersPerSecond: number | null) {
  if (speedMetersPerSecond == null || speedMetersPerSecond < 0) return 0;
  return speedMetersPerSecond * 3.6;
}

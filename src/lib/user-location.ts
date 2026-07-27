export type GestifyUserLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

export const GESTIFY_USER_LOCATION_STORAGE_KEY = "gestify:user-location";
export const GESTIFY_USER_LOCATION_EVENT = "gestify:user-location-updated";

export function isValidUserLocation(value: Partial<GestifyUserLocation> | null | undefined) {
  return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);
}

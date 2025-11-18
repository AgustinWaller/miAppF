import * as FileSystem from "expo-file-system";

const DEVICE_ID_FILE = `${FileSystem.documentDirectory}device-id.txt`;
let cachedId = null;

export async function getPersistentDeviceId() {
  if (cachedId) return cachedId;
  try {
    const info = await FileSystem.getInfoAsync(DEVICE_ID_FILE);
    if (info.exists) {
      const value = await FileSystem.readAsStringAsync(DEVICE_ID_FILE);
      if (value) {
        cachedId = value;
        return value;
      }
    }
  } catch {
    // ignore and regenerate
  }
  const newId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await FileSystem.writeAsStringAsync(DEVICE_ID_FILE, newId);
  } catch {
    // ignore write failure
  }
  cachedId = newId;
  return newId;
}


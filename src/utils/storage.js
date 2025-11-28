import AsyncStorage from '@react-native-async-storage/async-storage';

export async function setJSON(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getJSON(key, fallback = null) {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

export async function remove(key) {
  await AsyncStorage.removeItem(key);
}
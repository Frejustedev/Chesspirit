import * as SecureStore from "expo-secure-store";
import { safeKey, split } from "./chunks";

/** Stockage de la session Supabase dans le trousseau (Keychain / Keystore), par morceaux. */
export const secureStorage = {
  async getItem(key: string) {
    const k = safeKey(key);
    const count = Number((await SecureStore.getItemAsync(`${k}.n`)) ?? 0);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) parts.push((await SecureStore.getItemAsync(`${k}.${i}`)) ?? "");
    return parts.join("");
  },
  async setItem(key: string, value: string) {
    const k = safeKey(key);
    await this.removeItem(key);
    const parts = split(value);
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(`${k}.${i}`, parts[i]!);
    await SecureStore.setItemAsync(`${k}.n`, String(parts.length));
  },
  async removeItem(key: string) {
    const k = safeKey(key);
    const count = Number((await SecureStore.getItemAsync(`${k}.n`)) ?? 0);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};

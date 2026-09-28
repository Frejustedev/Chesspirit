import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/**
 * Autorisation des notifications et enregistrement du jeton de l'appareil (Expo Push).
 * Rien n'est envoyé depuis l'application ; l'envoi passe par le serveur.
 */
export async function registerPush(
  profileId: string,
): Promise<"granted" | "denied" | "unavailable"> {
  if (!Device.isDevice) return "unavailable";
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return "unavailable";
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return "denied";
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Chesspirit",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await supabase
    .from("push_tokens")
    .upsert({ profile_id: profileId, token, platform: Platform.OS }, { onConflict: "token" });
  return "granted";
}

import { Platform } from 'react-native';
import { api } from './api';

let messagingModule: any = null;

async function getMessaging() {
  if (messagingModule) return messagingModule;
  try {
    const m = require('@react-native-firebase/messaging');
    messagingModule = m.default || m;
    return messagingModule;
  } catch {
    return null;
  }
}

export async function initFirebase(token: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const messaging = await getMessaging();
    if (!messaging) return;

    const authStatus = await messaging().requestPermission();
    const authorized = authStatus === 1 || authStatus === 2;
    if (!authorized) return;

    const fcmToken = await messaging().getToken();
    if (!fcmToken) return;

    await api.post('/api/consultations/fcm-token', { fcm_token: fcmToken }, token);

    messaging().onTokenRefresh(async (newToken: string) => {
      await api.post('/api/consultations/fcm-token', { fcm_token: newToken }, token);
    });
  } catch {
    // Firebase non disponible ou token absent — dégradation silencieuse
  }
}

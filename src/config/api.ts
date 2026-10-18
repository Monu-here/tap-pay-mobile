import { Platform } from 'react-native';

/**
 * Base URL of the Tap & Pay API.
 *
 * Defaults to the deployed backend. Override per environment with the
 * `EXPO_PUBLIC_API_BASE_URL` env var (e.g. a local `.env`) rather than editing
 * this constant.
 *
 * For LOCAL development against your own machine (instead of this deployed
 * default):
 *   - Android emulator: `http://10.0.2.2:8000/api/v1` (alias for the host loopback; `localhost`/`127.0.0.1` are swapped to it automatically below).
 *   - iOS simulator: `http://localhost:8000/api/v1`.
 *   - Physical device: `http://<your-LAN-IP>:8000/api/v1`. On iOS, Expo Go blocks cleartext HTTP to a bare LAN IP — use the Mac's `.local` name or an HTTPS tunnel.
 */

export const DEFAULT_API_BASE_URL = 'https://tap-pay-production.up.railway.app/api/v1';

function resolveApiBaseUrl(): string {
  const configured = process.env?.EXPO_PUBLIC_API_BASE_URL?.trim();
  // An explicit URL always wins so a physical device can use its configured
  // LAN address instead of being redirected to a host-only development proxy.
  if (!configured && process.env.NODE_ENV === 'development' && process.env.PROXY_PORT === '4000') {
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${host}:${process.env.PROXY_PORT}/api/v1`;
  }

  const base = configured && configured.length > 0 ? configured : DEFAULT_API_BASE_URL;

  // Android emulator only: point host loopback at the emulator's host alias.
  // No library required; physical devices still use the env var for their LAN IP.
  if (Platform.OS === 'android') {
    return base
      .replace('http://localhost:', 'http://10.0.2.2:')
      .replace('http://127.0.0.1:', 'http://10.0.2.2:');
  }
  return base;
}

export const API_BASE_URL: string = resolveApiBaseUrl();
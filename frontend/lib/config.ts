// App Configuration
// Set EXPO_PUBLIC_BACKEND_URL in your environment (or .env) to point at your backend.
// On a phone/simulator, this needs to be your machine's LAN IP (e.g. http://192.168.1.42:8000),
// not localhost. Run `ipconfig getifaddr en0` on macOS to find it.

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
export const API_TIMEOUT = 10000;

// config.ts
// Web version mein Vite ka `import.meta.env.VITE_*` tha - Expo mein uska
// equivalent `process.env.EXPO_PUBLIC_*` hai (sirf "EXPO_PUBLIC_" prefix
// wale env vars hi client bundle mein aate hain). .env file mein:
//   EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com

// export const API_BASE = "http://172.23.163.29:8000";
// export const WS_BASE = "ws://172.23.163.29:8000";

export const API_BASE = 'https://zeyero-stars-backend.onrender.com';
export const WS_BASE = 'wss://zeyero-stars-backend.onrender.com';

// Force-update check (UpdateRequiredModal) - backend ke app_config table
// ke latest_version se compare hota hai. Naya native build publish karte
// waqt ise badhana (aur Play Console version code bhi badhana).
export const APP_VERSION = 1;

// Google Cloud Console > Credentials > "Web client" ka Client ID.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
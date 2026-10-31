/* ============================================================
   firebase-config.js — QATTAN Store
   ============================================================ */

export const firebaseConfig = {
  apiKey: "AIzaSyBW9yNKrbLGwPTGeGou-sse8oD0uSu8ok8",
  authDomain: "qattan-baf60.firebaseapp.com",
  projectId: "qattan-baf60",
  storageBucket: "qattan-baf60.firebasestorage.app",
  messagingSenderId: "836992256046",
  appId: "1:836992256046:web:d22a0d22ae6eb350a8f7bf",
  measurementId: "G-NNHTHRXT74"
};

export const ADMIN_EMAIL = "admin@gmail.com";

/* ------------------------------------------------------------
   Default store data (loaded only on first run)
   After that, any change from the admin panel is saved to Firestore
   ------------------------------------------------------------ */
export const DEFAULT_STORE_CONFIG = {
  name: "Qattan",
  phone: "201225899225",
  address: "Cairo",
  workingHours: "10 AM — 10 PM"
};
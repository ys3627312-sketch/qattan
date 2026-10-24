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
   البيانات الافتراضية للمتجر (تتحمل أول مرة بس)
   بعد كده أي تعديل من لوحة الأدمن بيتحفظ في Firestore
   ------------------------------------------------------------ */
export const DEFAULT_STORE_CONFIG = {
  name: "قطان",
  phone: "201225899225",
  address: "القاهرة",
  workingHours: "١٠ ص — ١٠ م"
};
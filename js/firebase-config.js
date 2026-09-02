// ====================================================================
// firebase-config.js
// Firebase configuration and initialization for
// "Seniors Teach, Juniors Reach" - PVKN Govt Degree College
// ====================================================================

console.log("firebase-config.js loaded");

// Import Firebase SDK (ES modules from CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --------------------------------------------------------------------
// Project: registrations-29eb8
// Get it from: Firebase Console -> Project Settings -> Your apps -> SDK setup
// --------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyA_QLLUR_KeHrkt-EdM6HSFw_JMcYFZfmc",
  authDomain: "registrations-29eb8.firebaseapp.com",
  projectId: "registrations-29eb8",
  storageBucket: "registrations-29eb8.firebasestorage.app",
  messagingSenderId: "638950416576",
  appId: "1:638950416576:web:105268083e18a3cba48d25",
  measurementId: "G-K54QNCCNVP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Analytics is optional — wrap in try/catch so environments that
// block it (e.g. some browsers when cookies are denied) don't break the app.
let analytics = null;
try {
  analytics = getAnalytics(app);
  console.log("Firebase Analytics initialized");
} catch (err) {
  console.warn("Firebase Analytics not available:", err);
}

console.log("Firebase initialized");

// Export everything modules need
export {
  app,
  auth,
  db,
  analytics,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
};

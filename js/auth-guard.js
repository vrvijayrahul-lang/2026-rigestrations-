// ====================================================================
// auth-guard.js
// Protect admin pages. Include this script on every protected page
// BEFORE the rest of the admin scripts run.
//
// Behavior:
//  - On load, listen for auth state changes.
//  - If user is NOT logged in -> redirect to admin-login.html
//  - If user IS logged in -> expose `window.adminUser` and call
//    `window.onAdminReady(user)` so other scripts can run.
// ====================================================================

console.log("auth-guard.js loaded");

import { auth, onAuthStateChanged } from "./firebase-config.js";

// Allow pages to register a callback for "admin is ready"
window.onAdminReady = window.onAdminReady || function () {};

// Read ?redirect= from the URL so we can come back here after login
function getRedirectParam() {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("redirect") || null;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  const target = getRedirectParam();
  const loginUrl = target
    ? "admin-login.html?redirect=" + encodeURIComponent(target)
    : "admin-login.html";
  console.log("Admin not authenticated. Redirecting to:", loginUrl);
  window.location.replace(loginUrl);
}

console.log("auth-guard.js: attaching onAuthStateChanged");

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("auth-guard: admin authenticated as", user.email);
    window.adminUser = user;
    try {
      window.onAdminReady(user);
    } catch (err) {
      console.error("onAdminReady callback failed:", err);
    }
  } else {
    console.log("auth-guard: no admin user, redirecting to login");
    redirectToLogin();
  }
});

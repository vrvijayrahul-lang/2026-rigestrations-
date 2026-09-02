// ====================================================================
// admin-login.js
// Handles admin authentication via Firebase Auth
// ====================================================================

console.log("admin-login.js loaded");

import {
  auth,
  signInWithEmailAndPassword,
} from "./firebase-config.js";

const loginForm   = document.getElementById("adminLoginForm");
const loginBtn    = document.getElementById("loginBtn");
const loginAlert  = document.getElementById("loginAlert");
const togglePwBtn = document.getElementById("togglePw");
const emailField  = document.getElementById("adminEmail");
const passField   = document.getElementById("adminPassword");

console.log("Looking for admin login form...");
console.log("Admin login form:", loginForm);

function showAlert(message) {
  if (!loginAlert) return;
  loginAlert.textContent = message;
  loginAlert.classList.remove("alert-success", "alert-info");
  loginAlert.classList.add("alert-error", "show");
}

function setLoading(isLoading) {
  if (!loginBtn) return;
  if (isLoading) {
    loginBtn.disabled = true;
    loginBtn.dataset.originalText = loginBtn.textContent;
    loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
  } else {
    loginBtn.disabled = false;
    loginBtn.textContent = loginBtn.dataset.originalText || "Sign In";
  }
}

function init() {
  console.log("Attaching admin login submit event listener");

  if (!loginForm) {
    console.error("adminLoginForm element not found in DOM.");
    return;
  }

  // Show/hide password
  if (togglePwBtn && passField) {
    togglePwBtn.addEventListener("click", () => {
      if (passField.type === "password") {
        passField.type = "text";
        togglePwBtn.textContent = "Hide";
      } else {
        passField.type = "password";
        togglePwBtn.textContent = "Show";
      }
    });
  }

  // Submit handler
  loginForm.addEventListener("submit", async function (event) {
    console.log("Admin login form submitted");
    event.preventDefault();

    if (!emailField || !passField) {
      showAlert("Form fields missing.");
      return;
    }

    const email = emailField.value.trim();
    const password = passField.value;

    // Basic validation — also highlight the relevant bezel
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert("Please enter a valid email address.");
      document.getElementById("bezel-adminEmail")?.classList.add("input-error");
      return;
    } else {
      document.getElementById("bezel-adminEmail")?.classList.remove("input-error");
    }
    if (!password || password.length < 6) {
      showAlert("Please enter your password (at least 6 characters).");
      document.getElementById("bezel-adminPassword")?.classList.add("input-error");
      return;
    } else {
      document.getElementById("bezel-adminPassword")?.classList.remove("input-error");
    }

    setLoading(true);

    try {
      console.log("Calling Firebase signInWithEmailAndPassword");
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Firebase login successful");

      // Redirect only AFTER Firebase confirms login
      console.log("Redirecting to admin dashboard");
      window.location.href = "admin-dashboard.html";
    } catch (error) {
      console.error("Admin login failed:", error);
      let msg = "Login failed. Please check your credentials.";
      if (error.code === "auth/invalid-credential" ||
          error.code === "auth/wrong-password" ||
          error.code === "auth/user-not-found") {
        msg = "Invalid email or password.";
      } else if (error.code === "auth/too-many-requests") {
        msg = "Too many attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        msg = "Network error. Please check your internet connection.";
      } else if (error.message) {
        msg = error.message;
      }
      showAlert(msg);
      setLoading(false);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

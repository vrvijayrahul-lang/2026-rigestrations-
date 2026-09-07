// ====================================================================
// registration.js
// Handles the public registration form for the workshop
// "Seniors Teach, Juniors Reach"
// ====================================================================

console.log("registration.js loaded");

// Firebase imports from our config file
import {
  db,
  doc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from "./firebase-config.js";

// --------------------------------------------------------------------
// Year prefix for registration IDs (matches "STJR-2026-0001")
// --------------------------------------------------------------------
const ID_YEAR = "2026";
const ID_PREFIX = `STJR-${ID_YEAR}-`;

// --------------------------------------------------------------------
// DOM references
// --------------------------------------------------------------------
const registrationForm = document.getElementById("registrationForm");
const submitBtn = document.getElementById("submitBtn");
const formAlert = document.getElementById("formAlert");

console.log("Looking for registration form...");
console.log("Registration form:", registrationForm);

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------
function showFieldError(fieldId, message) {
  const err = document.getElementById(`err-${fieldId}`);
  const bezel = document.getElementById(`bezel-${fieldId}`);
  if (err) {
    err.textContent = message;
    err.classList.add("show");
  }
  if (bezel) bezel.classList.add("input-error");
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach(e => e.classList.remove("show"));
  document.querySelectorAll(".input-bezel.input-error").forEach(e => e.classList.remove("input-error"));
}

function showAlert(message) {
  if (!formAlert) return;
  formAlert.textContent = message;
  formAlert.classList.remove("alert-success", "alert-info");
  formAlert.classList.add("alert-error", "show");
}

function clearAlert() {
  if (!formAlert) return;
  formAlert.classList.remove("show");
  formAlert.textContent = "";
}

function setLoading(isLoading) {
  if (!submitBtn) return;
  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent = submitBtn.dataset.originalText || "Register Now";
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
}

function isValidMobile(mobile) {
  return /^[6-9]\d{9}$/.test(String(mobile).trim());
}

function validateForm(data) {
  let valid = true;

  if (!data.fullName || data.fullName.trim().length < 2) {
    showFieldError("fullName", "Please enter your full name.");
    valid = false;
  }
  if (!data.rollNumber || data.rollNumber.trim().length < 2) {
    showFieldError("rollNumber", "Please enter your roll number.");
    valid = false;
  }
  if (!data.department) {
    showFieldError("department", "Please select your department.");
    valid = false;
  }
  if (!data.year) {
    showFieldError("year", "Please select your year.");
    valid = false;
  }
  if (!isValidEmail(data.email)) {
    showFieldError("email", "Please enter a valid email address.");
    valid = false;
  }
  if (!isValidMobile(data.mobile)) {
    showFieldError("mobile", "Please enter a valid 10-digit mobile number starting with 6-9.");
    valid = false;
  }
  if (!data.gender) {
    showFieldError("gender", "Please select your gender.");
    valid = false;
  }
  if (!data.interests || data.interests.trim().length < 2) {
    showFieldError("interests", "Please mention at least one skill or interest.");
    valid = false;
  }
  if (!data.workshopTopic) {
    showFieldError("workshopTopic", "Please choose your preferred topic.");
    valid = false;
  }

  return valid;
}

// --------------------------------------------------------------------
// Generate next sequential ID using a Firestore transaction.
// metadata/counters -> { registrationCounter: number }
// This is safe even when multiple users register simultaneously.
// --------------------------------------------------------------------
async function getNextRegistrationId() {
  console.log("Generating next registration ID via transaction");
  const counterRef = doc(db, "metadata", "counters");

  const nextNumber = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? (snap.data().registrationCounter || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { registrationCounter: next }, { merge: true });
    return next;
  });

  const padded = String(nextNumber).padStart(4, "0");
  return `${ID_PREFIX}${padded}`;
}

// --------------------------------------------------------------------
// Initialize after DOM is ready
// --------------------------------------------------------------------
function init() {
  console.log("Attaching submit event listener");

  if (!registrationForm) {
    console.error("registrationForm element not found in DOM.");
    return;
  }

  registrationForm.addEventListener("submit", async function (event) {
    console.log("Registration form submitted");

    // 1. Prevent the page from reloading
    event.preventDefault();
    clearFieldErrors();
    clearAlert();

    // 2. Collect values
    const data = {
      fullName:      document.getElementById("fullName").value.trim(),
      rollNumber:    document.getElementById("rollNumber").value.trim(),
      department:    document.getElementById("department").value,
      year:          document.getElementById("year").value,
      email:         document.getElementById("email").value.trim(),
      mobile:        document.getElementById("mobile").value.trim(),
      gender:        document.getElementById("gender").value,
      interests:     document.getElementById("interests").value.trim(),
      workshopTopic: document.getElementById("workshopTopic").value,
      motivation:    document.getElementById("motivation").value.trim(),
    };

    // 3. Validate
    if (!validateForm(data)) {
      console.warn("Form validation failed");
      showAlert("Please correct the highlighted fields and try again.");
      return;
    }

    // 4. Disable submit & show loading
    setLoading(true);

    try {
      console.log("Starting Firestore save");

      // 5. Generate unique registration ID via transaction
      const registrationId = await getNextRegistrationId();
      console.log("Generated registration ID:", registrationId);

      // 6. Save to Firestore
      //    Use registrationId as document ID for easy retrieval
      const registrationRef = doc(db, "registrations", registrationId);
      await setDoc(registrationRef, {
        registrationId,
        fullName:      data.fullName,
        rollNumber:    data.rollNumber,
        department:    data.department,
        year:          data.year,
        email:         data.email,
        mobile:        data.mobile,
        gender:        data.gender,
        interests:     data.interests,
        workshopTopic: data.workshopTopic,
        motivation:    data.motivation,
        status:        "registered",
        createdAt:     serverTimestamp(),
      });

      console.log("Firestore save successful");

      // 7. Store info for the success page
      sessionStorage.setItem("registrationId", registrationId);
      sessionStorage.setItem("studentName", data.fullName);

      // 8. Redirect only AFTER Firestore confirms save
      console.log("Redirecting to success page");
      window.location.href = "success.html";
    } catch (error) {
      console.error("Registration failed:", error);
      showAlert(error.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  });
}

// Wait for the DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

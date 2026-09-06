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
  runTransaction,
  serverTimestamp,
} from "./firebase-config.js";

// --------------------------------------------------------------------
// Year prefix for registration IDs (matches "STJR-2026-0001")
// --------------------------------------------------------------------
const ID_YEAR = "2026";
const ID_PREFIX = `STJR-${ID_YEAR}-`;

// --------------------------------------------------------------------
// Duplicate-prevention
// --------------------------------------------------------------------
// Two dedicated single-document lookups, one per normalized identity
// field, act as a uniqueness index inside a Firestore transaction.
//
//   registrations_unique/email___{normalizedEmail}
//   registrations_unique/mobile___{normalizedMobile}
//
// Each doc stores the { registrationId, createdAt } of the owning
// registration. Because the transaction re-reads each index doc
// immediately before writing, two concurrent submissions with the
// same email or mobile cannot both pass the check — the second
// writer sees the first writer's commit and the transaction aborts.
//
// Normalization rules:
//   email   -> trim + lowercase
//   mobile  -> strip everything except digits, keep the last 10
//              (handles "0XXXXXXXXXX", "+91XXXXXXXXXX", spaces, dashes)
//
// The counter increment, duplicate check, and registration write all
// happen in ONE transaction. If the duplicate check fails, the
// transaction throws and the counter increment is rolled back —
// so duplicate submissions never burn a registration ID.
// --------------------------------------------------------------------
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeMobile(mobile) {
  const digits = String(mobile || "").replace(/\D+/g, "");
  // Keep the last 10 digits so leading "0" or country code "+91"
  // doesn't produce a different key for the same number.
  return digits.slice(-10);
}

function emailKeyDocId(normalizedEmail) {
  return `email__${normalizedEmail}`;
}

function mobileKeyDocId(normalizedMobile) {
  return `mobile__${normalizedMobile}`;
}

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
// Atomic registration write.
//
// Inside ONE Firestore transaction we:
//   1. Read + increment the global registration counter
//      (metadata/counters.registrationCounter).
//   2. Look up the two unique-index docs (email + mobile). If either
//      already exists, abort the transaction — no counter increment,
//      no registration write, no new ID consumed.
//   3. Write the two unique-index docs (so future submissions fail
//      this same check).
//   4. Write the registration document itself.
//
// Firestore transactions are serializable on the documents they
// touch, so two concurrent submissions with the same email or
// mobile will see each other's writes in step 2 and only one will
// succeed. The throw rolls back every write from the transaction,
// including the counter increment.
// --------------------------------------------------------------------
async function createRegistrationAtomically(payload, normalized) {
  const counterRef   = doc(db, "metadata", "counters");
  const emailKeyRef  = doc(db, "registrations_unique", emailKeyDocId(normalized.email));
  const mobileKeyRef = doc(db, "registrations_unique", mobileKeyDocId(normalized.mobile));

  return await runTransaction(db, async (transaction) => {
    // 1. Counter — increment first so the same ID is never used twice
    //    even if a duplicate is detected and we abort.
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().registrationCounter || 0) : 0;
    const nextNumber = current + 1;
    const padded = String(nextNumber).padStart(4, "0");
    const registrationId = `${ID_PREFIX}${padded}`;

    // 2. Duplicate check — re-read both unique-index docs. If either
    //    exists, abort BEFORE writing anything.
    const [emailSnap, mobileSnap] = await Promise.all([
      transaction.get(emailKeyRef),
      transaction.get(mobileKeyRef),
    ]);

    if (emailSnap.exists || mobileSnap.exists) {
      // Determine which one matched so the error message can be specific.
      // Snapshots are guaranteed to have non-undefined data() for existing
      // docs, but we still guard the access — a malformed legacy index
      // doc should produce a clean error, not a "Cannot read property"
      // crash.
      const field = emailSnap.exists ? "email" : "mobile";
      const emailData  = emailSnap.exists  ? (emailSnap.data()  || {}) : {};
      const mobileData = mobileSnap.exists ? (mobileSnap.data() || {}) : {};
      const existingRegId =
        emailData.registrationId || mobileData.registrationId || null;
      const err = new Error("DUPLICATE_REGISTRATION");
      err.code = "DUPLICATE_REGISTRATION";
      err.field = field;
      err.existingRegistrationId = existingRegId;
      throw err;
    }

    // 3. Commit the counter increment. (Will roll back if the
    //    transaction aborts after this point.)
    transaction.set(counterRef, { registrationCounter: nextNumber }, { merge: true });

    // 4. Reserve the unique-index docs.
    const keyTimestamp = serverTimestamp();
    transaction.set(emailKeyRef, {
      registrationId,
      email: normalized.email,
      createdAt: keyTimestamp,
    });
    transaction.set(mobileKeyRef, {
      registrationId,
      mobile: normalized.mobile,
      createdAt: keyTimestamp,
    });

    // 5. Write the registration doc at a path keyed by the new ID.
    const finalRegRef = doc(db, "registrations", registrationId);
    transaction.set(finalRegRef, {
      ...payload,
      registrationId,
      emailKey:  normalized.email,
      mobileKey: normalized.mobile,
      status:    "registered",
      createdAt: serverTimestamp(),
    });

    return registrationId;
  });
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

      // 5. Normalize identity fields for the duplicate check.
      //    Validation above already enforces well-formed email + 10-digit
      //    mobile, so normalize() here is safe to feed into the unique keys.
      const normalized = {
        email:  normalizeEmail(data.email),
        mobile: normalizeMobile(data.mobile),
      };

      // 6. Atomically: increment counter -> check duplicates -> write.
      //    Throws DUPLICATE_REGISTRATION if either unique index is taken.
      const registrationId = await createRegistrationAtomically(
        {
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
        },
        normalized
      );
      console.log("Registration saved with ID:", registrationId);

      // 7. Store info for the success page
      sessionStorage.setItem("registrationId", registrationId);
      sessionStorage.setItem("studentName", data.fullName);

      // 8. Redirect only AFTER Firestore confirms save
      console.log("Redirecting to success page");
      window.location.href = "success.html";
    } catch (error) {
      console.error("Registration failed:", error);

      // Duplicate — show a field-level error on the offending input
      // and a friendly alert. No registration ID was consumed.
      if (error && error.code === "DUPLICATE_REGISTRATION") {
        const fieldId = error.field === "email" ? "email" : "mobile";
        showFieldError(
          fieldId,
          `This ${fieldId} is already registered${
            error.existingRegistrationId ? ` (ID: ${error.existingRegistrationId})` : ""
          }.`
        );
        showAlert(
          "Registration already exists. This email address or mobile number has already been registered."
        );
        setLoading(false);
        return;
      }

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

// ====================================================================
// migrate-unique-index.js
//
// One-time data migration that backfills the
// `registrations_unique/email__*` and `registrations_unique/mobile__*`
// index documents for every registration that already exists in
// `registrations/`. This protects existing records from being
// registered-against again under the new duplicate-prevention
// logic.
//
// Idempotent: running it twice is safe — it skips an index doc
// that already exists.
//
// Usage:
//   1) Firebase Console -> Project Settings -> Service accounts
//      -> "Generate new private key" -> save as serviceAccountKey.json
//      in THIS project root (do NOT commit it).
//   2) node migrate-unique-index.js
//   3) The script reads every doc under `registrations/`, normalizes
//      the email and mobile, and writes the matching index docs
//      under `registrations_unique/`.
// ====================================================================

const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { cert } = require("firebase-admin/app");
const path  = require("path");

const keyFile = path.join(__dirname, "serviceAccountKey.json");

let app;
try {
  app = admin.initializeApp({
    credential: cert(require(keyFile)),
  });
} catch (err) {
  console.error("\nCould not initialize firebase-admin.");
  console.error("Make sure serviceAccountKey.json exists in the project root and is valid.");
  console.error("Generate one at:");
  console.error("  https://console.firebase.google.com/project/registrations-29eb8/settings/serviceaccounts/adminsdk\n");
  console.error("Underlying error:", err.message, "\n");
  process.exit(1);
}

const db = getFirestore(app);

// ---- Same normalization rules as js/registration.js ---------------
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeMobile(mobile) {
  const digits = String(mobile || "").replace(/\D+/g, "");
  return digits.slice(-10);
}

function emailKeyDocId(normalizedEmail) {
  return `email__${normalizedEmail}`;
}

function mobileKeyDocId(normalizedMobile) {
  return `mobile__${normalizedMobile}`;
}

// ---- Migrate ------------------------------------------------------
(async () => {
  try {
    const registrationsSnap = await db.collection("registrations").get();
    console.log(`\nFound ${registrationsSnap.size} registration(s).\n`);

    if (registrationsSnap.empty) {
      console.log("Nothing to migrate. Exiting.\n");
      process.exit(0);
    }

    let created = 0;
    let skipped = 0;
    let invalid = 0;

    for (const regDoc of registrationsSnap.docs) {
      const data = regDoc.data() || {};
      const regId = data.registrationId || regDoc.id;

      const normEmail  = normalizeEmail(data.email);
      const normMobile = normalizeMobile(data.mobile);

      if (!normEmail || !normEmail.includes("@")) {
        console.warn(`  ! ${regId}  -> invalid email, skipping.`);
        invalid++;
        continue;
      }
      if (!normMobile || normMobile.length !== 10) {
        console.warn(`  ! ${regId}  -> invalid mobile (${data.mobile}), skipping.`);
        invalid++;
        continue;
      }

      const emailRef  = db.collection("registrations_unique").doc(emailKeyDocId(normEmail));
      const mobileRef = db.collection("registrations_unique").doc(mobileKeyDocId(normMobile));

      // Use a transaction so the two writes either both land or
      // neither does. Skip a slot that's already populated.
      await db.runTransaction(async (tx) => {
        const [emailSnap, mobileSnap] = await Promise.all([
          tx.get(emailRef),
          tx.get(mobileRef),
        ]);

        if (!emailSnap.exists) {
          tx.set(emailRef, {
            registrationId: regId,
            email: normEmail,
            migratedAt: FieldValue.serverTimestamp(),
          });
          created++;
        } else {
          skipped++;
        }

        if (!mobileSnap.exists) {
          tx.set(mobileRef, {
            registrationId: regId,
            mobile: normMobile,
            migratedAt: FieldValue.serverTimestamp(),
          });
          created++;
        } else {
          skipped++;
        }
      });

      console.log(`  ✓ ${regId}  email=${normEmail}  mobile=${normMobile}`);
    }

    console.log(`\nDone. Created ${created} index doc(s), skipped ${skipped} pre-existing, ${invalid} invalid.\n`);
    process.exit(0);
  } catch (err) {
    console.error("\nMigration failed:", err.message, "\n");
    process.exit(1);
  }
})();

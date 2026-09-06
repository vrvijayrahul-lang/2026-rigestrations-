// ====================================================================
// cleanup-orphaned-indexes.js
//
// Removes registrations_unique index documents that reference a
// registration that no longer exists.
//
// Problem: when an admin deletes a registration from the dashboard,
// only the registrations/{id} doc is deleted — the corresponding
// registrations_unique/{email__,mobile__} index docs are left behind.
// This causes "already registered" errors when the same person tries
// to re-register.
//
// Idempotent: running it multiple times is safe.
//
// Usage:
//   1) Firebase Console -> Project Settings -> Service accounts
//      -> "Generate new private key" -> save as serviceAccountKey.json
//      in THIS project root (do NOT commit it).
//   2) node cleanup-orphaned-indexes.js
// ====================================================================

const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { cert } = require("firebase-admin/app");
const path = require("path");

const keyFile = path.join(__dirname, "serviceAccountKey.json");

let app;
try {
  app = admin.initializeApp({
    credential: cert(require(keyFile)),
  });
} catch (err) {
  console.error("\nCould not initialize firebase-admin.");
  console.error("Make sure serviceAccountKey.json exists in the project root.");
  console.error("Generate one at:");
  console.error("  https://console.firebase.google.com/project/registrations-29eb8/settings/serviceaccounts/adminsdk\n");
  console.error("Underlying error:", err.message, "\n");
  process.exit(1);
}

const db = getFirestore(app);

(async () => {
  try {
    const indexSnap = await db.collection("registrations_unique").get();
    console.log(`Found ${indexSnap.size} index doc(s).\n`);

    if (indexSnap.empty) {
      console.log("Nothing to clean up. Exiting.\n");
      process.exit(0);
    }

    let deleted = 0;
    let kept = 0;
    let errors = 0;

    for (const indexDoc of indexSnap.docs) {
      const indexData = indexDoc.data() || {};
      const regId = indexData.registrationId;

      if (!regId) {
        // No registrationId stored — safe to delete by doc ID alone.
        // These shouldn't exist but handle them gracefully.
        console.warn(`  ! index doc ${indexDoc.id} has no registrationId — deleting`);
        try {
          await indexDoc.ref.delete();
          deleted++;
        } catch (e) {
          console.error(`    failed to delete: ${e.message}`);
          errors++;
        }
        continue;
      }

      // Check whether the referenced registration still exists.
      const regRef = db.doc(`registrations/${regId}`);
      let regExists = false;
      try {
        const regSnap = await regRef.get();
        regExists = regSnap.exists;
      } catch (e) {
        console.warn(`  ? could not check registration ${regId}: ${e.message}`);
        errors++;
        continue;
      }

      if (!regExists) {
        console.log(`  ✗ orphaned  ${indexDoc.id}  (was → ${regId}) — deleting`);
        try {
          await indexDoc.ref.delete();
          deleted++;
        } catch (e) {
          console.error(`    failed to delete: ${e.message}`);
          errors++;
        }
      } else {
        console.log(`  ✓ valid    ${indexDoc.id}  → ${regId}`);
        kept++;
      }
    }

    console.log(`\nDone. Deleted ${deleted} orphaned index doc(s), kept ${kept} valid, ${errors} errors.\n`);
    if (errors > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error("\nCleanup failed:", err.message, "\n");
    process.exit(1);
  }
})();

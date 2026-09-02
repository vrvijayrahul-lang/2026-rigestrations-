// ====================================================================
// set-admin-claim.js
// One-time script to set the `admin: true` custom claim on a Firebase
// Auth user so they can read/update/delete registrations.
//
// Usage:
//   1) Firebase Console -> Project Settings -> Service accounts
//      -> "Generate new private key" -> save as serviceAccountKey.json
//      in THIS project root (do NOT commit it).
//   2) node set-admin-claim.js you@pvkn.edu
//   3) The user signs out and signs back in for the claim to take effect.
// ====================================================================

const admin = require("firebase-admin");
const path  = require("path");

const email = process.argv[2];

if (!email) {
  console.error("\nUsage: node set-admin-claim.js <user-email>\n");
  console.error("Example: node set-admin-claim.js admin@pvkn.edu\n");
  process.exit(1);
}

const keyFile = path.join(__dirname, "serviceAccountKey.json");

let app;
try {
  app = admin.initializeApp({
    credential: admin.credential.cert(require(keyFile)),
  });
} catch (err) {
  console.error("\nCould not initialize firebase-admin.");
  console.error("Make sure serviceAccountKey.json exists in the project root.");
  console.error("Generate one at:");
  console.error("  https://console.firebase.google.com/project/registrations-29eb8/settings/serviceaccounts/adminsdk\n");
  console.error("Underlying error:", err.message, "\n");
  process.exit(1);
}

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    // Force a token refresh by revoking & re-issuing
    await admin.auth().revokeRefreshTokens(user.uid);

    console.log("\n  admin: true claim set for", email);
    console.log("  uid:", user.uid);
    console.log("  refresh tokens revoked — the user must sign in again.\n");
    process.exit(0);
  } catch (err) {
    console.error("\nFailed to set admin claim:", err.message, "\n");
    process.exit(1);
  }
})();

# Seniors Teach, Juniors Reach — Workshop Registration

A modern, professional website for a two-day peer-learning workshop at
**P V K N Government Degree College, Andhra Pradesh**, where senior students
teach junior students at the **Cyber Cafe**.

Built with **HTML5 + CSS3 + ES6 Modules + Firebase (Auth + Firestore)**.
No PHP. No traditional backend.

---

## Project Structure

```
/
├── index.html                  # Landing page
├── register.html               # Public registration form
├── success.html                # Registration success / confirmation
├── admin-login.html            # Admin login (Firebase Auth)
├── admin-dashboard.html        # Admin dashboard (protected)
├── registration-details.html   # View a single registration (protected)
│
├── css/
│   └── style.css               # All styles
│
├── js/
│   ├── firebase-config.js      # Firebase init + exports
│   ├── main.js                 # UI helpers
│   ├── registration.js         # Public registration form logic
│   ├── admin-login.js          # Admin login form logic
│   ├── auth-guard.js           # Protects admin pages
│   └── admin-dashboard.js      # Dashboard logic
│
├── firestore.rules             # Security rules
├── firebase.json               # Firebase Hosting + Firestore config
└── README.md                   # This file
```

---

## Setup (Step by Step)

### 1. Create a Firebase project

1. Go to <https://console.firebase.google.com/>
2. Click **Add project** → name it → continue.
3. Disable Google Analytics if you want, then create.

### 2. Enable Authentication (Email/Password)

1. In your project, open **Build → Authentication → Get started**.
2. Click **Email/Password** → enable it → save.

### 3. Create your first admin user

1. In **Authentication → Users**, click **Add user**.
2. Enter the admin's email and password.
3. (Optional but recommended for production) Set a custom claim
   `admin: true` for that user using the Firebase Admin SDK on a
   trusted server or a Cloud Function. See "Admin access" below.

### 4. Create a Firestore database

1. Open **Build → Firestore Database → Create database**.
2. Choose production mode (we'll override rules next).
3. Pick a region close to your users.

### 5. Add your Firebase config

Open `js/firebase-config.js` and replace the placeholder
`firebaseConfig` object with your project's web config:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

You can find these values in
**Project settings → General → Your apps → SDK setup → Config**.

### 6. Deploy Firestore rules

1. In the Firebase Console, open **Firestore → Rules**.
2. Copy the contents of `firestore.rules` into the editor and **Publish**.

OR install the Firebase CLI and run:

```bash
firebase login
firebase use --add   # select your project
firebase deploy --only firestore:rules
```

### 7. Run the site

**Option A — Local testing (simplest):**

Because this project uses ES modules with relative imports, you MUST
serve the files over HTTP — opening `index.html` via `file://` will
NOT work in the browser. Use any static server, for example:

```bash
# Python 3
python -m http.server 5500

# Or with Node
npx serve .

# Or with VS Code
# Install the "Live Server" extension and click "Go Live"
```

Then open <http://localhost:5500>.

**Option B — Deploy to Firebase Hosting:**

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy
```

Your site will be live at `https://<project-id>.web.app`.

---

## How Registration Works

1. Junior student fills in `register.html` and clicks **Register Now**.
2. `js/registration.js`:
   - Prevents page reload.
   - Validates all fields.
   - Calls `getNextRegistrationId()` — a Firestore transaction on
     `metadata/counters.registrationCounter` that safely increments
     the counter even with concurrent users.
   - Saves the document at `registrations/STJR-2026-0001` etc.
   - **Only after Firestore confirms** the save, sets
     `sessionStorage` and redirects to `success.html`.
3. `success.html` reads from `sessionStorage` and shows the ID + name.
4. The counter transaction guarantees IDs like
   `STJR-2026-0001`, `STJR-2026-0002`, … without duplicates.

---

## How Admin Works

1. Admin goes to `admin-login.html` and signs in.
2. `admin-login.js` calls `signInWithEmailAndPassword`.
3. On success → redirect to `admin-dashboard.html`.
4. `auth-guard.js` (loaded FIRST on the dashboard) listens to
   `onAuthStateChanged`. If not signed in → redirect back to
   `admin-login.html`. If signed in → expose `window.adminUser` and
   fire `window.onAdminReady(user)`.
5. `admin-dashboard.js` registers `onAdminReady` and then loads
   registrations, renders stats, and wires up search / filters /
   delete / refresh.
6. Logout button calls `signOut(auth)` and redirects to
   `admin-login.html`.

---

## Admin Access (Security)

The provided `firestore.rules` allows any signed-in user to read/write
admin-only data. For production you should restrict this further by
setting a **custom claim** on your admin user.

### Add a custom claim (recommended for production)

Create a small Cloud Function (or run a one-off Node script with the
Firebase Admin SDK) that sets `{ admin: true }` on your admin user:

```js
// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.addAdminClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError(
      "permission-denied", "Only existing admins can grant admin."
    );
  }
  const uid = data.uid;
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  return { ok: true };
});
```

Then update `firestore.rules` (already done in the file) to require
`request.auth.token.admin == true` for admin-only data.

For the workshop, the simplest safe path is:
- Create the admin in Firebase Auth.
- Sign in once on the dashboard and verify everything works.
- For tighter security, add the custom claim later via the Admin SDK.

---

## File-by-File Notes

- `index.html` — Landing page with hero, about, objectives, benefits.
- `register.html` — Form with id **`registrationForm`** and
  submit button `<button type="submit">`. Loaded as a module.
- `js/registration.js` — All form logic, including validation,
  counter transaction, and Firestore save.
- `success.html` — Reads `sessionStorage` to display confirmation.
- `admin-login.html` — Form with id **`adminLoginForm`** and
  submit button `<button type="submit">`.
- `js/admin-login.js` — Auth + redirect.
- `auth-guard.js` — `onAuthStateChanged` redirect for protected pages.
- `admin-dashboard.html` — Loads `auth-guard.js` BEFORE
  `admin-dashboard.js`.
- `js/admin-dashboard.js` — Reads registrations, builds the table,
  wires search, filter, delete, refresh, logout.
- `registration-details.html` — Single-record view, also auth-guarded.
- `firestore.rules` — Allows public creates, blocks public reads,
  and gates admin data behind signed-in (and ideally `admin` claim) users.
- `firebase.json` — Hosting + Firestore config (deploy-ready).

---

## Debugging Tips

Every JS file `console.log`s when it loads and at key checkpoints:

```
registration.js loaded
Looking for registration form...
Registration form: <form id="registrationForm">
Attaching submit event listener
Registration form submitted
Starting Firestore save
Generated registration ID: STJR-2026-0001
Firestore save successful
Redirecting to success page
```

Open the browser DevTools **Console** tab and you'll see exactly
where execution stops if anything goes wrong.

Common issues:
- **`firebaseConfig` not set** → set it in `js/firebase-config.js`.
- **Firestore permission denied** → check `firestore.rules` were published.
- **`auth/user-not-found` on login** → create the admin user in
  Firebase Auth first.
- **CORS / module errors when opening `file://`** → use a local
  static server (`python -m http.server`, `npx serve`, Live Server, etc.).

---

## Customization

- **College name & event name** — edit `index.html` directly, or change
  the brand text in the navbar.
- **Departments / years** — edit the `<select>` options in
  `register.html` and the `known` arrays in `admin-dashboard.js`.
- **Workshop topics** — edit the `<select>` in `register.html`.
- **Color scheme** — change the CSS variables at the top of
  `css/style.css`.
- **ID prefix** — change `ID_PREFIX` in `js/registration.js`.

---

© 2026 P V K N Government Degree College — Seniors Teach, Juniors Reach.
# 2026-rigestrations-

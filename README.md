# BYFB — free Firestore leaderboard

No Cloud Functions. No Blaze upgrade. No terminal login or backend deployment. Keep Firebase on Spark (the free plan). This version replaces the earlier Cloud Functions implementation.

## 1. Enable Google sign-in

In Firebase Console, choose your project → Authentication → Sign-in method → Google. Enable it, select a support email, and save.

Under Authentication → Settings → Authorized domains, add your Vercel hostname, such as your-site.vercel.app (no https://). Add localhost only if testing locally.

## 2. Create the database and paste its rules

Open Firestore Database → Create database → Standard edition → default database → Production mode. Choose a location. Use the default database, which is eligible for Firebase's free quota.

Then open Firestore Database → Rules. Copy the entire contents of the included firestore.rules file, paste it there, and click Publish. Use a dedicated project for BYFB; these rules deny access to unrelated collections. If this database serves another app, merge the BYFB match blocks into that app's rules instead of replacing its rules wholesale.

You do not need to create collections, rows, indexes, or documents manually. The app creates each participant's attempt and leaderboard entry. The ranking query uses Firestore's built-in single-field elapsed index.

## 3. Paste your Firebase config into the code

Open index.html. Near the top, replace the clearly marked const firebaseConfig object with your Firebase Web App config from Project settings → General → Your apps → Web → Config. No setup page. No private keys or Vercel secrets.

Leave USE_FIREBASE_EMULATORS = false.

## 4. Deploy on Vercel

Upload this folder to GitHub and import it into Vercel using the Other framework preset. The included vercel.json runs node build.cjs to copy index.html into public/, and Vercel serves that file. No npm installation is needed. Redeploy after editing your config.

The old firebase deploy command is no longer needed. Do not enable Cloud Build or upgrade to Blaze for this version.

## Behavior

The opening screen contains only the Google sign-in button. Sign-in is followed by the rules and Start button. Google names are used on the leaderboard. Each Google UID has one attempt for bears-v1, retained across devices and reloads.

Firestore records the start and finish with serverTimestamp. Rules reject answers arriving 70 seconds or more after the original start. Completed attempts cannot be edited or deleted by clients. For a correct B answer, the app creates an immutable ranking entry whose elapsed milliseconds must match the two stored timestamps exactly. Incorrect, invalid, and expired attempts cannot produce ranking entries. Times use millisecond rounding, so a valid result may display 70.00s at the boundary. Equal times share rank (1, 1, 3). The top 100 and your own rank are displayed.

A failed ranking write is retried from the saved completed attempt when you reopen the page or leaderboard. Going offline never pauses the deadline. Tab hiding, losing focus, and duplicate tabs trigger best-effort invalidation. Reloads preserve the original deadline; closing/reopening an active saved attempt invalidates it.

The browser cannot reliably detect screenshots or prove you stayed on the quiz. The answer is visible in the client/rules, and a different Google account gets a separate attempt. This is suitable for a casual quiz, not a high-stakes exam. Google UIDs are document IDs in the authenticated leaderboard collection; emails are not stored in it.

## Free usage limits

Firestore has free daily quotas. On Spark, requests can stop working when a quota is exhausted; this version does not require adding a payment method or billing account. Monitor Firestore → Usage. Keep the project on Spark to avoid usage-based billing. Reference: https://firebase.google.com/docs/firestore/pricing

## Verification

Frontend syntax and the direct-database adapter are checked locally. A real Firebase project and the rules have not been tested live because no project configuration was supplied. Java is unavailable locally, so the Firestore rules were not run in the emulator. After publishing the rules, test one Google login and complete an attempt, then check Firestore for the saved record and ranking.


## Connection fix

This repo uses Firestore Lite (REST-only HTTPS requests), rather than the streaming/offline SDK. Google sign-in restores the saved attempt directly. There is no separate clock-sync document or server-clock preflight; the original Firestore start timestamp anchors the countdown, with its display offset saved for reloads. Database security rules still reject answers after 70 seconds and validate leaderboard times from the two server timestamps.

Publish the included firestore.rules in Firebase Console → Firestore Database → Rules, then click Publish. This file was missing from the repo. No Cloud Functions, paid server, billing upgrade, or Firebase CLI deployment is required.

If requests still fail, the screen now distinguishes permission errors from network errors. Check that this project's default Firestore database exists and that the rules are published. Do not replace the rules with public read/write access. The app no longer blocks submissions solely because navigator.onLine reports false.

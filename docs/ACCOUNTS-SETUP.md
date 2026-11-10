# Turn on Friprep accounts and classrooms

The website code uses the existing Firebase project `broyourefriedbro`. It does not use Cloud Functions, a service account, or billing-only features. Firebase's normal free-plan quotas still apply.

## One-time Firebase setup

1. Sign into [Firebase Console](https://console.firebase.google.com/project/broyourefriedbro/overview) with the account that owns this project.
2. Open **Build → Authentication → Sign-in method** and ensure **Google** is enabled.
3. In **Authentication → Settings → Authorized domains**, add your live hostname (for example `byfbsat.vercel.app`). For local testing add `127.0.0.1` and `localhost` if they are not listed.
4. Open **Build → Firestore Database → Rules**. Replace the editor contents with this repository's complete `firestore.rules`, then **Publish**. This file includes the existing daily-challenge rules as well as the new account rules. Never select test mode or replace it with `allow read, write: if true`.
5. Manually create a Vercel deployment from `main`. Automatic deployments stay disabled.
6. Open `/dashboard` and sign in with **ray.r.hossain@gmail.com**. Teacher access requires Google's verified email, checked in both the client and Firestore rules. No student can assign themselves a teacher role.

The Codex machine's existing Firebase CLI login did not have this project in its accessible projects, so no live Firebase rules were published by Codex. Rules also could not be tested with the Firestore emulator because Java is not installed. Firebase Console validates the rules before publishing; test the two-account checklist below before distributing access.

## Teacher workflow

- Generate an activation code under **Student activation**, and copy it immediately. Only its SHA-256 hash is saved, not the original code. It expires in 30 days and can only activate one Google account.
- Create a classroom and copy its separate classroom join code. This code can be shared with the group; students must activate their own accounts first. You can generate another join code later. Existing join codes remain active until disabled in Firestore.
- Publish assignments using question IDs from the question bank. An assignment link opens only those questions. Students can submit after checking each question in their saved practice.
- Post a grade by selecting the student and assignment. Posting again for that pair updates the existing grade instead of creating a duplicate. Only the teacher writes classroom grades.
- Classroom and category averages are points-weighted across teacher-posted grades. Practice accuracy is shown separately and is self-reported practice, not a protected exam score.

## Student workflow

Google sign-in → one-use activation code → join classroom or self-study. Students who choose self-study can join a classroom later. Practice records save under their Firebase UID and are also cached under a UID-specific device key. Anonymous device practice is not silently imported into a signed-in account.

Students see only their own grades and submissions. The teacher can see the classroom roster and grades. The static question bank remains publicly accessible; activation protects account/classroom features, not downloads of the public question JSON.

## Two-account smoke test

1. Teacher signs in and creates an activation code and a classroom.
2. A separate Google student account activates, then joins using the classroom code.
3. A different student cannot reuse the consumed activation code.
4. Teacher publishes an assignment. Student sees it, opens the limited question set, checks each answer, and submits.
5. Teacher posts a grade. Student refreshes the dashboard and sees the grade and category average. Another student must not be able to read that grade.
6. Sign out and sign into another account on the same device: saved answers from the first account must not appear.

## Developer configuration

The public Firebase web configuration now lives in `assets/firebase-config.js` and is shared by the daily challenge and accounts. It contains public application settings, never a service-account key or activation code. Teacher email must be updated in both `assets/account-model.js` and `firestore.rules` if ownership changes.

The next-SAT countdown uses the confirmed calendar in `assets/account-model.js`, sourced from [College Board](https://satsuite.collegeboard.org/sat/dates-deadlines). It stops showing a date when the confirmed calendar is exhausted; add future confirmed dates there rather than inventing a schedule.

## Daily focus planner and question selection

Publish the latest complete `firestore.rules` again to enable `/friprepUsers/{uid}/planner/{date}`. Daily labels are private to that account and limited to 140 characters. Device storage keeps a dated local copy if cloud syncing fails.

In the teacher dashboard, choose a classroom and click **Choose questions**. In the question bank, **Select questions** switches on checkboxes and previews. Select up to 100 questions across filters and pages; **Select this page** adds the current page. The selection tray keeps every chosen question visible. **Review & assign** lets you expand the full questions and answers, remove any, choose the classroom, title, category and due date, then publish the assignment. Selections are kept in session storage until cleared or published.

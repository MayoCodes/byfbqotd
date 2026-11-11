# Turn on Friprep accounts and classrooms

The website code uses the existing Firebase project `broyourefriedbro`. It does not use Cloud Functions, a service account, or billing-only features. Firebase's normal free-plan quotas still apply.

## One-time Firebase setup

1. Sign into [Firebase Console](https://console.firebase.google.com/project/broyourefriedbro/overview) with the account that owns this project.
2. Open **Build → Authentication → Sign-in method** and ensure **Google** is enabled.
3. In **Authentication → Settings → Authorized domains**, add your live hostname (for example `byfbsat.vercel.app`). For local testing add `127.0.0.1` and `localhost` if they are not listed.
4. Open **Build → Firestore Database → Rules**. Replace the editor contents with this repository's complete `firestore.rules`, then **Publish**. This file includes the existing daily-challenge rules as well as the new account rules. Never select test mode or replace it with `allow read, write: if true`.
5. Manually create a Vercel deployment from `main`. Automatic deployments stay disabled.
6. Open `/dashboard` and sign in with **ray.r.hossain@gmail.com**. Teacher access requires Google's verified email, checked in both the client and Firestore rules. No student can assign themselves a teacher role.

The Codex machine's existing Firebase CLI login did not have this project in its accessible projects, so no live Firebase rules were published by Codex. The assignment rules were verified locally with the Firestore emulator. Firebase Console also validates the rules before publishing; use the two-account checklist below before distributing access.

## Teacher workflow

- Generate an activation code under **Student activation**, and copy it immediately. Only its SHA-256 hash is saved, not the original code. It expires in 30 days and can only activate one Google account.
- Create a classroom and copy its separate classroom join code. This code can be shared with the group; students must activate their own accounts first. You can generate another join code later. Existing join codes remain active until disabled in Firestore.
- Publish assignments using question IDs from the question bank. An assignment link opens a separate test screen with only those questions. Students submit their work from the test’s review screen.
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

## Timed assignments and teacher activity

Choose **Timed** or **Untimed** in **Review & assign**. Timed assignments have a total limit from 1 to 240 minutes. Students open a dedicated split-pane assignment screen with answer selection, short answers, review marks, an answer eliminator, and a question navigator. Old assignment links redirect to the new screen; previously submitted work is retained.

A timed attempt uses the server-stamped start and original limit. Reloading, navigating questions, or leaving the tab does not extend it. Late answers are denied by Firestore. At expiry, the open page submits the last saved answers; a closed page finalizes when the student reopens and resumes it. The teacher report indicates expired attempts awaiting final submission.

In **Teacher dashboard → Assignment activity**, select the assignment and student. The report shows answers, visible time up to the latest answer change, total time with each question visible, time away, and the most recent tab-visibility events. Leaving the tab does not show a pop-up or invalidate the attempt. Before starting, students are told that their teacher can see this activity. The data is browser-reported and may be incomplete if the device is offline or closed. No other tab's URL, title, or content is collected.

Publish the latest **complete** Firestore rules before manually deploying `main`. For local rule checks, run `npm run test:rules` with the Firebase CLI and Java 21 installed. This command uses an isolated demo project.

## Student results and explanations

Submitting either assignment mode opens a results screen with the final percentage, counts, a filterable question review, and source explanations with math formatting. Unanswered questions with valid keys count toward the denominator. Missing or image-only keys are labeled not scored and excluded. Historical capture-time wrong-choice feedback is omitted. Results read the acknowledged saved answers; teacher grades remain teacher-controlled. Opening an already submitted assignment returns to this review automatically. No extra Firestore rules are needed for this results feature.

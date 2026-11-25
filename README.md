# Friprep — Cloudflare Pages

The question bank is now static. There is no Google Sheets API, service account, secret environment variable, serverless function, or database request for the question bank. The timed challenge's Google sign-in and live leaderboard still use Firebase and remain subject to its free quotas.

## Deploy on Cloudflare Pages

1. Push all current repo changes to GitHub. Keep the repo private if you want the raw question source private.
2. In Cloudflare, choose Workers & Pages → Create application → Pages → Connect to Git (or Import an existing Git repository).
3. Connect GitHub and select byfbqotd.
4. Set project name friprep, framework None, build command `node build.cjs`, build output `public`, and leave root directory blank. Choose the production branch you use (normally main).
5. Save and deploy. No environment variables or paid plan are needed for this static question-bank build.
6. Add your actual production hostname (for example friprep.pages.dev) in Firebase Authentication → Settings → Authorized domains so Google sign-in works on the new host.

Vercel is optional; vercel.json remains compatible with the same static build. Cloudflare's unlimited static requests do not make Firebase's separate live leaderboard unlimited.

## Add or update questions

The source is `data/questions.csv`. Only its header row is currently provided: no questions have been invented or manually copied from the inaccessible Google Sheet.

To transfer your existing questions once, open the original Google Sheet and download the selected question tab as CSV (File → Download → Comma-separated values). Replace data/questions.csv with that file and push to GitHub. You can then edit that CSV in Excel/LibreOffice or replace it through GitHub's upload-file interface. Each push automatically rebuilds the connected Cloudflare Pages site. There is no live Google Sheets synchronization in this version; changes must reach the CSV in the repo to deploy.

Headers: Question, optional Passage, A, B, C, D, Answer. Optional: ID, Title, Explanation, Subject, Topic, Difficulty, Published. Common aliases such as Question text, Option A, Correct answer, and Skill are supported. Answer keys can be A–D, 1–4, or exact choice text. Missing answer keys are not guessed. Incomplete/duplicate questions are skipped and reported. Published=false/no/0/draft rows are excluded. If the downloaded sheet has a different layout, map its headers in lib/question-bank.cjs.

The build converts the CSV into public/question-bank.json. Only question fields needed by the site are published; unrelated/private columns, the source CSV, and repo files are not copied into public/. Visitors can read and copy all published questions, choices, answer keys, and explanations. The original repo/source file remains private only if your GitHub repo is private.

The page checks the deployed JSON every five minutes while open. Updating the CSV triggers a site build, rather than a per-visitor API/database call. Cloudflare Pages Free still has build/file limits (currently 500 builds per month); static asset requests are free and unlimited under its published plan terms.

## Firebase timed challenge

Keep the public firebaseConfig object in assets/firebase-config.js set to your project. Enable Google sign-in, authorize your Pages hostname, and publish the included firestore.rules in Firebase Console. No Cloud Functions or Blaze plan is needed. Existing internal collection names and attempt keys are preserved so the Friprep rename does not reset attempts or erase results.

Rules enforce the fixed 70-second deadline and leaderboard timestamps. Browser tab/screenshot enforcement remains best effort; websites cannot reliably prevent screenshots or prove a participant stayed on the page. A different Google account can obtain another attempt.

## Local verification

```sh
node build.cjs
node --test tests/question-bank.test.cjs
node scripts/preview.cjs
```

Open http://127.0.0.1:4180/question-bank. No npm dependencies are needed.

## Capture directly from CookSAT

The updated Chrome extension in `/Users/rayanhossain/Downloads/cooksat-capture 3/chrome` can publish batches to this repo. Its `START-HERE.md` explains creating a GitHub fine-grained token for this one repo (Contents: Read and write), then connecting owner MayoCodes, repo byfbqotd, branch main.

Capturing only queues a reviewed question locally. Publishing writes one commit for up to 25 questions and their figures, which triggers the connected Cloudflare Pages build. JSON source files live under data/captures/, image sources under data/capture-assets/. The build automatically merges these with data/questions.csv; capture IDs update the matching entry. Untimed practice supports captured multiple-choice questions, student-produced numeric responses, and referenced PNG figures/tables. Extracted LaTeX remains text; a full math-typesetting engine is not included.

Keep tokens in the extension, never in this website, its public files, or the repo. The source repo can stay private, while the chosen question text, answers, explanations, and images are published as static files. GitHub API and Cloudflare build quotas still apply to publishing; there are no per-visitor capture API calls or database costs for reading the bank. A commit receipt does not prove a successful Cloudflare deployment—check its dashboard.

Run `node --test tests/question-bank.test.cjs tests/capture-import.test.cjs` to check the build importer. No real captures have been published by this coding session.

## Question bank filters

The question bank uses bundled HeroUI React select components, styled to match Friprep. Run `npm ci` once before `npm run build` (or `node build.cjs`). Vercel and Cloudflare install dependencies from `package-lock.json`; the existing build command and `public` output directory still work. No new environment variables are needed.

Filters include section, domain, skill, difficulty, practice status, answer format, and difficulty order. Section changes clear domain and skill; domain changes clear skill. Captures retain `domain`, `skill`, and `subskill` as separate public question fields. CSV sources may also provide these columns; older Topic-only sources still work as skills. Missing metadata is never invented.

Question progress and bookmarks are stored only in the browser on this device (`friprep-bank-progress`), without a database or added API calls. Practice status filters use that local history. The responsive filter panel can collapse on mobile. Published questions are not modified by practicing or saving.

## Manual Vercel publishing

Automatic Vercel deployments are disabled for all Git branches with `git.deploymentEnabled: false` in `vercel.json`. Capture and publish questions to GitHub as often as needed; those pushes do not automatically rebuild the Vercel site.

When a batch is finished:

1. Open the **byfbsat** project in Vercel.
2. Open **Deployments → Create Deployment**.
3. Enter `main` as the Git reference and create the deployment. This uses the latest questions committed to GitHub.
4. Wait for Ready, then refresh `/question-bank`.

Create a new deployment from `main`; redeploying an older deployment can rebuild its older commit and omit newer questions. The existing deployment limit must reset before another manual deployment can succeed.

This setting applies to Vercel. Cloudflare's connected build trigger is managed separately in its dashboard.

## Math question formatting

The question bank bundles KaTeX and its fonts locally during the build. Captured inline/display TeX is rendered in questions, choices, and explanations; native MathML is converted by Friprep Capture 2.2.0. Diagrams and graphs still use the captured image assets. No external rendering service, API key, or runtime CDN request is required. Upload math captures normally and create a manual deployment from `main` when ready.

### Professional math typography and diagrams

Math question text uses a textbook serif face. KaTeX supplies the italic variable alphabet, upright operators/numerals, stacked fractions, superscripts/subscripts, radicals, sums, and matrices. Equations remain structured and accessible via MathML. Graphs remain full-size diagram images, with a direct original-image link for zooming. The graph data and original image bytes are not changed.

## Text-based equation capture (Capture 2.5.1)

New captures store equations as TeX text, rendered with local KaTeX. MathQuill selectable TeX, supported MathQuill fraction/power/subscript/root DOM, and MathML are read directly from the displayed question. Only actual diagrams, graphs, and tables are screenshots. If an equation has no readable semantic source, capture pauses without replacing the saved question; there is no equation screenshot fallback.

Reload the existing unpacked extension (do not remove it), then auto-capture the math set again. Extraction revision 6 refreshes earlier math captures instead of skipping them as already published. The same question IDs replace previous records, so this does not create duplicates. Publish all when the capture finishes and create one manual deployment from main. The stored GitHub token and existing queue are retained.

Legacy captures that contain only equation PNGs keep their existing display until replaced by a text capture. Image pixels cannot restore the original TeX reliably. English captures remain deduplicated and do not need recapturing.

## Accounts and classroom dashboard

Google sign-in, one-use activation, teacher classrooms, assignments, cloud practice, and grades are implemented. Follow [the account setup guide](docs/ACCOUNTS-SETUP.md) before distributing student access. The new Firestore rules must be published in your Firebase project; Vercel deployment alone does not publish them.

The fries outline mark is a local SVG. The daily focus calendar replaces the decorative countdown graphic; students and teachers can label individual days. Teachers can build assignments directly from question-bank selection mode, with full question previews and a classroom publish form. Publish the updated Firestore rules to enable private planner syncing.

Classroom assignments open at `/assignment`, with the supplied split-pane test layout, an optional fixed deadline, and private teacher activity reports. Publish the latest complete Firestore rules before deploying the assignment update.

### Desmos calculator

The question bank and assignment screen share a Desmos panel. It docks beside the page on desktop and below it on smaller screens. Use **Float** or drag the title bar to move it, and drag the edge or corner to resize it. Arrow keys also work on the labeled move and resize controls. Closing and reopening the panel retains the graph for the current page.

Set `DESMOS_API_KEY` in the deployment environment before building. For local builds, put `DESMOS_API_KEY=your_key_here` in the ignored `.env.desmos` file. The build writes the key to the public browser configuration because the [Desmos embed](https://www.desmos.com/api/v1.12/docs/index.html#api-keys) loads with a browser API key. Use a key appropriate for the deployment; trial keys show a Desmos trial banner. The calculator is loaded only when opened.

After submitting an assignment, students see their percentage, correct/incorrect/unanswered counts, answer comparisons, and the source explanations. Submitted work opens directly in this review screen on later visits. Scores use the saved submission and current answer key; this feedback does not overwrite teacher-posted grades.

The main URL now opens My study space: Google sign-in for guests and the saved dashboard for signed-in accounts. `/dashboard` remains available, and the daily challenge is at `/daily-challenge` (source: `daily-challenge.html`). Assignment headers use separate grid tracks and adapt to the available space when Desmos is docked.

### Practice tests

Open a **completed CookSAT test review**, reload the existing Friprep Capture extension, and choose its **Tests** tab. Capture all four modules or one named module. Capture uses the visible review dialogs, leaves CookSAT answers and scores untouched, and can resume from its saved queue. **Publish all** writes test questions under `data/test-captures/`; then deploy `main` manually. The public **Tests** page enables a module once all its questions are published, and enables a whole test once all four modules are ready.

Test attempts have separate module timers, local answer checkpoints, locked completed modules, and an end-of-test percentage with explanations. They reuse the assignment screen and do not require new Firebase rules. Practice percentages are not scaled SAT scores. Only publish question content you have permission to share.


### Classroom practice-test reports

Completed practice-test results include a **Choose a classroom** action. Sharing is explicit and stores one immutable report per attempt, student, and classroom in `friprepClassrooms/{classId}/practiceReports/{uid}_{attemptId}`. Sending the same attempt again is idempotent. Joining additional classrooms records a private membership index under `friprepUsers/{uid}/classrooms`; existing students’ current classroom works without migration. Students can switch classrooms or join another from their study space.

Classroom insights combine submitted assignment sessions and explicitly shared practice reports. Scores are recalculated from the published question bank, grouped by domain, skill, and subskill. Time averages exclude missing recordings; unanswered scored questions remain in accuracy. Practice activity is recorded on the device, not a proctored score. Older finished attempts cannot recover activity timelines that were not saved; their existing timing remains usable. Only the student and the teacher can read shared reports. Deploy `firestore.rules` along with this feature; no Functions, billing upgrade, or composite Firestore index is required.

### Daily question rotation

`/daily-challenge` now loads `/api/daily`. A stable shuffled pool of 476 eligible Hard English bank questions is stored in `data/daily-pool.json`. Everyone receives the same question for the current Eastern calendar day; the selection advances automatically at midnight, including daylight-saving changes. It does not require a scheduled deployment. The pool rotates across reading and grammar skills, excludes prompts over 280 words and questions dependent on underlining or figures, and uses the bank's existing formatter. Math and easier English questions are not eligible.

Each Google account gets a separate 70-second, server-timed attempt and leaderboard for each day under `byfbEnglishDailyChallenges/{day}/...`. The original `bears-v1` and earlier mixed-subject daily history remain preserved in their original namespaces. Firebase checks the daily answer key against the read-only `byfbDailyConfig/english-hard-v1` pool. The pool and Firebase rules were initialized with this change. `node scripts/seed-daily-pool.cjs` uses the existing Firebase CLI login to initialize a new environment and refuses to replace an existing sequence. Keep the pool order stable so bank uploads or redeployments do not change the current question or reset attempts. The snapshot can be deliberately migrated later when adding or retiring bank question IDs.

The Vercel function includes the built question-bank JSON; `npm run build` must run before deployment. Automatic Git deployments remain disabled. Deploy `main` manually from Vercel when ready.

### Assignment recipients and previous completions

In question-bank selection mode, choose a classroom and either the whole classroom or up to 100 specific students. Review & assign preserves those recipients. Whole-class assignments also include future members; targeted assignments appear only for their recipients in the student dashboard, and Firebase denies unselected students access to an assignment session. Legacy assignments retain whole-class behavior.

The Previously completed filter uses checked cloud-saved bank responses and answered questions in submitted assignments or voluntarily shared practice-test reports. Bookmarks, blank/skipped answers and unfinished assignment sessions are excluded. Preview a question to see which selected students completed it. Counts deduplicate repeated attempts per student. A built question-identities.json links test capture IDs to their original source question IDs when the same question is also in the bank.

A private friprepUsers/{uid}/history/questions index makes repeat checks inexpensive. Existing accounts are backfilled from saved progress on their first lookup; subsequent progress snapshots maintain the compact index. History refresh also reloads the classroom roster. Only the student and teacher can read the index. Device-only or unshared practice cannot contribute to teacher history. Deploy firestore.rules with this feature; the rules were published during implementation.

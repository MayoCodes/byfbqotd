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

# The Test Ledger

An A/B test tracking app for ad creative — plans tests, tracks results, manages iteration threads, and pushes tasks to ClickUp. Data syncs across your team in real time via Firebase.

## What's in this folder

You don't need to understand any of these files to deploy. Just upload everything to GitHub as instructed below.

- `src/App.jsx` — the main app
- `src/firebase.js` — Firebase configuration (your project credentials are already wired in)
- `src/main.jsx` — wires the app to the browser
- `src/index.css` — base styles
- `index.html` — the page that loads in the browser
- `package.json` — list of dependencies (includes Firebase + React)
- `vite.config.js`, `tailwind.config.js`, `postcss.config.js` — build configuration
- `.gitignore` — tells GitHub what to ignore

---

## How shared data works

This app uses **Firebase Firestore** as a shared cloud database. Every test, every edit, every status change is saved there in real time. Anyone you share the URL with sees the same data, on any device.

You don't need to do anything to make sync happen — it's automatic. When you save a test, your teammates see the update within a second.

**Important — Firebase is in test mode for the first 30 days.** This means anyone who finds the URL can read and write data. That's fine for an internal demo, but before sharing publicly or after 30 days, you'll need to lock down access. See "Securing the database" at the bottom.

---

## Deployment Guide (no coding required)

### Step 1: Create a GitHub account (5 min)

If you don't have one already:

1. Go to **https://github.com**
2. Click **Sign up**
3. Choose a username (this becomes part of your URL — pick something professional)
4. Verify your email

### Step 2: Create a new repository (3 min)

A "repository" is just a folder for your project on GitHub.

1. Once logged into GitHub, click the **+** icon in the top-right corner → **New repository**
2. Repository name: `ab-test-tracker` (or whatever you want)
3. Description: "A/B test tracker for ad creative"
4. Set to **Public** (Vercel's free tier requires public repos)
5. **Do not** check any of the "Add a README" / "Add .gitignore" / "Choose a license" boxes — we already have those files
6. Click **Create repository**

You'll land on a page that says "Quick setup" with a bunch of code blocks. Ignore all of that.

### Step 3: Upload the project files (5 min)

1. On that same page, click the link that says **"uploading an existing file"** (it's in the middle of the page in the gray instructions box)
2. **Drag and drop** every file and folder from this project into the upload area, OR click "choose your files" and select them all

   Important: make sure you're uploading the **contents** of the project folder, not the folder itself. The structure on GitHub should look like:
   ```
   ab-test-tracker/
   ├── src/
   │   ├── App.jsx
   │   ├── firebase.js
   │   ├── main.jsx
   │   └── index.css
   ├── index.html
   ├── package.json
   ├── vite.config.js
   ├── tailwind.config.js
   ├── postcss.config.js
   ├── .gitignore
   └── README.md
   ```
3. Scroll down to "Commit changes" — leave the default commit message
4. Click **Commit changes**

GitHub will upload everything. Wait until you see all the files listed.

### Step 4: Deploy with Vercel (10 min)

Vercel is the service that turns your GitHub code into a live website. Free for personal projects.

1. Go to **https://vercel.com**
2. Click **Sign Up** → choose **Continue with GitHub**
3. Authorize Vercel to access your GitHub account
4. On the welcome screen, click **Add New...** → **Project**
5. You'll see a list of your GitHub repos. Find `ab-test-tracker` and click **Import**
6. On the configuration screen:
   - **Framework Preset:** should auto-detect as "Vite" — if not, select Vite from the dropdown
   - **Root Directory:** leave as `./`
   - **Build Command:** leave default (`npm run build`)
   - **Output Directory:** leave default (`dist`)
   - **Install Command:** leave default
7. Click **Deploy**

Wait 1-2 minutes. Vercel will install dependencies, build the app, and deploy it.

When it's done, you'll see "Congratulations!" with a screenshot of your app. Click **Continue to Dashboard** or just click on the screenshot.

### Step 5: Get your URL

You'll see your project dashboard. Near the top there's a URL like:

```
ab-test-tracker-yourname.vercel.app
```

That's your live demo URL. Click it to open the app. Share that link with anyone — it works on any device.

---

## Making updates later

Two ways:

**Easy way (no install):** Edit files directly on GitHub. Click any file, click the pencil icon, edit, commit. Vercel auto-redeploys within 60 seconds.

**Better way (when you're ready):** Install GitHub Desktop and clone the repo locally so you can edit in any code editor. Ask Claude to walk you through that when you're ready.

---

## Troubleshooting

**Build fails on Vercel.** Check the build log — the error is usually clear. The most common cause is missing files in the upload. Make sure all files (including hidden `.gitignore`) made it to GitHub.

**App loads but shows "Loading..." forever.** Means the app can't talk to Firebase. Check:
- Firebase project is still active (https://console.firebase.google.com)
- Firestore Database was created (not just Realtime Database — these are different)
- Your security rules allow read/write (in test mode they do by default)
- Browser console errors (right-click page → Inspect → Console) often show the exact problem

**Changes don't appear for other team members.** Have them refresh once. If it still doesn't sync, check Firestore in the Firebase console — if you see test documents there, the writes are working but the reads aren't on their end (browser extension blocking? corporate firewall?).

**"Permission denied" errors in console.** Your test-mode security rules expired (30 days). See "Securing the database" below.

**Lost your URL.** Just go to vercel.com and log in — your project is on the dashboard.

---

## Securing the database (do this before day 30)

Firebase test mode lets anyone read and write your data, which is fine for early demos but should be tightened. Two options:

**Option A — Extend test mode** (quick, kicks the can down the road). In Firebase Console → Firestore → Rules tab, change the date in the rules to a year out. Saves you for now but doesn't actually secure anything.

**Option B — Add real authentication** (better, requires another conversation with Claude). Firebase has free Google sign-in built in. Anyone on your team signs in with their Google account, and the rules require authentication to read or write. This is the right long-term setup. Ask Claude to walk you through Firebase Authentication when you're ready.

---

## Custom domain (optional, later)

Vercel gives you a `.vercel.app` URL for free. If you want `tests.yourcompany.com` instead:

1. In Vercel, go to your project → Settings → Domains
2. Add your domain
3. Vercel gives you DNS records to add to your domain registrar (GoDaddy, Namecheap, etc.)
4. Wait 10-60 minutes for DNS to propagate

Free with any Vercel account.

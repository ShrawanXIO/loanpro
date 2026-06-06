# LoanPro — Complete Setup Guide
> From zero to live PWA in ~45 minutes. Follow every step in order.

---

## What You Will Have at the End
- A live PWA at `https://your-app.vercel.app`
- Google Sign-In authentication
- Per-lender branding (name + logo)
- Full loan manager (clients → loans → payments)
- Free tier: 10 clients · Pro tier: 100 clients + dashboard
- UPI upgrade button
- Installable on mobile (no App Store needed)

---

## Accounts You Need to Create First (all free)

| Service | URL | What it's for |
|---------|-----|---------------|
| Google Account | accounts.google.com | Firebase + GitHub login |
| Firebase | console.firebase.google.com | Auth + Database + Storage |
| GitHub | github.com | Code storage + auto-deploy |
| Vercel | vercel.com | Hosting (sign in with GitHub) |

---

## PART 1 — Firebase Setup

### Step 1 — Create a Firebase Project
1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
2. Click **"Add project"**
3. Name it: `loanpro` (or anything you like)
4. **Disable** Google Analytics (not needed)
5. Click **Create project** → wait ~30 seconds → click **Continue**

### Step 2 — Add a Web App to Firebase
1. On the Firebase project homepage, click the **Web icon** `</>`
2. App nickname: `LoanPro Web`
3. ✅ Check **"Also set up Firebase Hosting"** — NO, skip this (we use Vercel)
4. Click **Register app**
5. You will see a code block like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "loanpro-xxxx.firebaseapp.com",
     projectId: "loanpro-xxxx",
     storageBucket: "loanpro-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
6. **Copy and save these 6 values** — you need them in Step 14
7. Click **Continue to console**

### Step 3 — Enable Google Sign-In
1. In the left sidebar, click **Authentication**
2. Click **Get started**
3. Click **Google** under "Sign-in providers"
4. Toggle **Enable** → ON
5. Set **Project support email** to your Gmail
6. Click **Save**

### Step 4 — Create Firestore Database
1. In the left sidebar, click **Firestore Database**
2. Click **Create database**
3. Select **Start in production mode** → click **Next**
4. Choose region: **asia-south1 (Mumbai)** → click **Enable**
5. Wait ~30 seconds for it to provision

### Step 5 — Set Firestore Security Rules
1. In Firestore, click the **Rules** tab at the top
2. **Replace everything** with this:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // Tenants: only the owner can read/write their tenant
       match /tenants/{tenantId} {
         allow read, write: if request.auth != null && resource.data.ownerId == request.auth.uid;
         allow create: if request.auth != null;
       }

       // Clients, Loans, Payments: only the tenant owner
       match /clients/{docId} {
         allow read, write: if request.auth != null &&
           exists(/databases/$(database)/documents/tenants/$(resource.data.tenantId)) &&
           get(/databases/$(database)/documents/tenants/$(resource.data.tenantId)).data.ownerId == request.auth.uid;
         allow create: if request.auth != null;
       }

       match /loans/{docId} {
         allow read, write: if request.auth != null &&
           exists(/databases/$(database)/documents/tenants/$(resource.data.tenantId)) &&
           get(/databases/$(database)/documents/tenants/$(resource.data.tenantId)).data.ownerId == request.auth.uid;
         allow create: if request.auth != null;
       }

       match /payments/{docId} {
         allow read, write: if request.auth != null &&
           exists(/databases/$(database)/documents/tenants/$(resource.data.tenantId)) &&
           get(/databases/$(database)/documents/tenants/$(resource.data.tenantId)).data.ownerId == request.auth.uid;
         allow create: if request.auth != null;
       }
     }
   }
   ```
3. Click **Publish**

### Step 6 — Enable Firebase Storage
1. In the left sidebar, click **Storage**
2. Click **Get started**
3. Click **Next** → select **asia-south1** → click **Done**
4. Click the **Rules** tab → replace with:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /logos/{tenantId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null && request.resource.size < 2 * 1024 * 1024;
       }
     }
   }
   ```
5. Click **Publish**

### Step 7 — Add Authorized Domain for Auth
1. Go to **Authentication → Settings → Authorized domains**
2. You will add your Vercel domain here **after Step 20** (come back)
3. For now, `localhost` is already there ✓

---

## PART 2 — GitHub Setup

### Step 8 — Create a GitHub Repository
1. Go to **[github.com](https://github.com)** → click **New repository**
2. Name: `loanpro`
3. Visibility: **Private**
4. ✅ Do NOT check "Add README" (the project already has files)
5. Click **Create repository**
6. GitHub shows you commands — **copy the repo URL** (looks like `https://github.com/yourusername/loanpro.git`)

### Step 9 — Install Git (if not already installed)
- **Windows**: Download from [git-scm.com](https://git-scm.com)
- **Mac**: Run `git --version` in Terminal (it installs automatically)
- Verify: open Terminal/Command Prompt → type `git --version` → should show a version number

### Step 10 — Install Node.js (if not already installed)
- Download **Node.js 20 LTS** from [nodejs.org](https://nodejs.org)
- Verify: `node --version` → should show `v20.x.x`
- npm comes with it: `npm --version` → should show `10.x.x`

---

## PART 3 — Project Setup

### Step 11 — Download and Unzip the Project Files
1. Download the project folder `loanpro/` (from wherever you received it)
2. Place it somewhere easy — e.g. `C:\Projects\loanpro` or `~/projects/loanpro`

### Step 12 — Open Terminal in the Project Folder
- **Windows**: Right-click the `loanpro` folder → "Open in Terminal" (or open Command Prompt and `cd C:\Projects\loanpro`)
- **Mac**: Right-click the `loanpro` folder → "New Terminal at Folder"

### Step 13 — Install Dependencies
In the terminal, run:
```bash
npm install
```
Wait 1–2 minutes while npm downloads all packages. You will see a `node_modules` folder appear.

### Step 14 — Create Your Environment File
1. In the `loanpro` folder, find the file `.env.local.example`
2. **Copy** it and rename the copy to `.env.local`
3. Open `.env.local` in any text editor (Notepad, VS Code, etc.)
4. Fill in your Firebase values from Step 2:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=loanpro-xxxx.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=loanpro-xxxx
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=loanpro-xxxx.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```
5. Save the file

### Step 15 — Update Your UPI ID in the Code
In two places, replace `YOUR_UPI_ID` with your actual UPI ID (e.g. `shrawan@upi`):

**File 1**: `src/components/loan/AppShell.tsx` — line with:
```
href="upi://pay?pa=YOUR_UPI_ID&pn=LoanPro...
```

**File 2**: `src/components/loan/ClientList.tsx` — same pattern

**File 3**: `src/components/loan/SettingsPanel.tsx` — same pattern

### Step 16 — Test Locally
In the terminal:
```bash
npm run dev
```
Open your browser → go to **[http://localhost:3000](http://localhost:3000)**

You should see:
- The LoanPro landing page at `/`
- Login page at `/login`
- Sign in with Google → lands at `/app`

> **If you see Firebase errors**: Double-check your `.env.local` values

---

## PART 4 — Push to GitHub

### Step 17 — Connect to GitHub and Push
In the terminal (make sure you are in the `loanpro` folder):
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/loanpro.git
git push -u origin main
```
Replace `YOURUSERNAME` with your actual GitHub username.

Enter your GitHub credentials if asked.

---

## PART 5 — Deploy to Vercel

### Step 18 — Connect Vercel to GitHub
1. Go to **[vercel.com](https://vercel.com)** → click **Sign Up** → choose **Continue with GitHub**
2. Authorize Vercel to access your GitHub

### Step 19 — Create a New Vercel Project
1. On the Vercel dashboard, click **Add New → Project**
2. Find `loanpro` in the list → click **Import**
3. Framework: Vercel auto-detects **Next.js** ✓
4. **Do not change** Root Directory, Build Command, or Output Directory
5. Expand **Environment Variables** at the bottom
6. Add each of the 6 Firebase keys from Step 14:
   - Key: `NEXT_PUBLIC_FIREBASE_API_KEY` → Value: paste your value
   - Repeat for all 6 variables
7. Click **Deploy**
8. Wait 2–3 minutes for the build to complete
9. Vercel shows **"Congratulations!"** with your URL like:
   ```
   https://loanpro-abc123.vercel.app
   ```
10. Click **Visit** to open your live app

### Step 20 — Add Vercel Domain to Firebase Auth
1. Copy your Vercel URL (e.g. `loanpro-abc123.vercel.app`)
2. Go back to **Firebase → Authentication → Settings → Authorized domains**
3. Click **Add domain**
4. Paste `loanpro-abc123.vercel.app` (without `https://`)
5. Click **Add**

Now test Google Sign-In on the live URL — it should work.

---

## PART 6 — Custom Domain (Optional)

### Step 21 — Add a Custom Domain on Vercel
1. In Vercel → your project → **Settings → Domains**
2. Type your domain (e.g. `loanpro.in`) → click **Add**
3. Vercel gives you DNS records — add them to your domain registrar
4. Also add the custom domain to Firebase Auth (same as Step 20)

---

## PART 7 — Upgrade a User to Pro (Manual via Firebase)

When a lender pays you ₹5,000 via UPI:

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)** → your project
2. Click **Firestore Database** → click `tenants` collection
3. Find the document for that lender (search by `ownerId` or `businessName`)
4. Click the document → click the `tier` field
5. Change `free` → `paid`
6. Click **Update**

The lender's app instantly unlocks the dashboard and 100-client limit.

---

## PART 8 — Deploying Code Updates

Every time you change code:
```bash
git add .
git commit -m "describe your change"
git push
```
Vercel automatically rebuilds and deploys in ~2 minutes. No other steps needed.

---

## TROUBLESHOOTING

### "Firebase: Error (auth/unauthorized-domain)"
→ Add your Vercel domain to Firebase Auth Authorized Domains (Step 20)

### "Missing or insufficient permissions" in Firestore
→ Re-publish the Firestore security rules from Step 5

### App shows white screen after deploy
→ Check Vercel build logs → usually a missing environment variable
→ Go to Vercel → Project → Settings → Environment Variables → verify all 6 are there

### Google Sign-In popup closes immediately
→ Check browser console for errors
→ Verify `authDomain` in `.env.local` matches exactly what Firebase shows

### UPI link doesn't open on desktop
→ UPI deep links only work on Android/iPhone with a UPI app installed
→ On desktop, show the UPI ID as text for manual payment

### Changes not showing after `git push`
→ Check Vercel dashboard → Deployments → see if build is running/failed

---

## Quick Reference

### File Structure
```
loanpro/
├── src/
│   ├── app/
│   │   ├── page.tsx          ← Landing/marketing page
│   │   ├── login/page.tsx    ← Google Sign-In page
│   │   ├── app/page.tsx      ← The main app (auth-gated)
│   │   ├── layout.tsx        ← HTML head, fonts, PWA tags
│   │   └── globals.css       ← Tailwind + custom styles
│   ├── components/loan/
│   │   ├── AppShell.tsx      ← Navigation, drawer, layout
│   │   ├── ClientList.tsx    ← Page 1: client list + search + add
│   │   ├── ClientDetail.tsx  ← Page 2: client stats + loan list + add loan
│   │   ├── LoanDetail.tsx    ← Page 3: loan financials + progress + payments
│   │   ├── Dashboard.tsx     ← Pro: analytics overview
│   │   └── SettingsPanel.tsx ← Branding, UPI ID, tier info
│   ├── hooks/
│   │   └── useAuth.ts        ← Firebase Auth + tenant management
│   └── lib/
│       ├── firebase.ts       ← Firebase app init
│       ├── firestore.ts      ← All database operations
│       └── finance.ts        ← SI, overdue, snapshots (pure logic)
├── public/
│   └── manifest.json         ← PWA install config
├── .env.local                ← Your Firebase keys (never commit this)
├── .env.local.example        ← Template (safe to commit)
└── SETUP.md                  ← This file
```

### Firestore Collections
```
tenants/    → { ownerId, businessName, logoUrl, upiId, tier, clientCount }
clients/    → { tenantId, name, phone, createdAt }
loans/      → { tenantId, clientId, principal, rate, days, date, closed }
payments/   → { tenantId, loanId, amount, mode, date }
```

### How to Install as PWA on Phone
**Android (Chrome)**:
1. Open the app URL in Chrome
2. Tap the 3-dot menu → "Add to Home screen"
3. Tap "Add" → app icon appears on home screen

**iPhone (Safari)**:
1. Open the app URL in Safari
2. Tap the Share button (square with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"


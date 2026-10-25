# My Life

A personal one-stop dashboard: calendar, to-dos, money, goals, trips, reading, a photo journal and achievements, in a soft frosted-glass look.

It's a React + TypeScript web app built with Vite. Data lives in [Supabase](https://supabase.com): email sign-in, a Postgres table protected so each person sees only their own rows, and private photo storage. The same code can be wrapped as an iPhone or Android app later (see [Native app](#native-app-later)).

## Run it locally

```bash
npm install
npm run dev
```

Without Supabase keys the app runs in **demo mode**: it fills itself with example entries and saves changes in that browser only.

## Connect Supabase

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. In the project's **SQL Editor**, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It creates the `entries` and `prefs` tables, row-level security, and a private `journal` bucket for photos.
3. Under **Authentication → URL Configuration**, set the Site URL to where the app runs (`http://localhost:5173` for now, your real domain later) and add it to the redirect URLs.
4. Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Restart `npm run dev`. You'll be asked for your email and sent a sign-in link. On your first sign-in the dashboard adds a few entries marked "example". The **Clear examples** button removes them.

**Sign-in is currently off on the live site** (`VITE_SIGN_IN=off` in `.env.production`), so entries are kept in each browser. Delete that line to turn Supabase sign-in and syncing back on.

The anon key is meant to be public. Row-level security is what keeps your data private, so never put the `service_role` key in this app.

## Connect Google Calendar

The Calendar section shows your Google Calendar events next to the ones you add by hand, and its event editor can add, change and delete Google events (times, all-day, repeats, location, guests, Google Meet, notifications, color, busy/free and visibility). Events can also be kept in the dashboard only. It runs entirely in the browser, so it needs a Google OAuth client ID:

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project (any name).
2. Go to **APIs & Services → Library**, search for **Google Calendar API**, and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen** (or **Google Auth Platform**). Choose **External**, fill in the app name and your email, and add your own Google account under **Test users**.
4. Go to **Credentials → Create credentials → OAuth client ID**, choose **Web application**, and under **Authorized JavaScript origins** add `http://localhost:5173` and your site's address (for example `https://life-dashboard-nine-tau.vercel.app`).
5. Copy the client ID (it ends in `.apps.googleusercontent.com`) into `VITE_GOOGLE_CLIENT_ID` in `.env.local`, and into `.env.production` for the live site.

The app asks for two permissions: reading your calendars and editing their events (`calendar.readonly` and `calendar.events`). If someone unticks the editing box on Google's screen, events still show but the editor asks for permission before saving.

The client ID is public; it only works from the origins you listed. Google's sign-in lasts about an hour, after which the section shows a **Sync Google Calendar** button to refresh it with one tap. While the app is in Google's "testing" mode, only the test users you added can connect.

## Connect banks to Finance (Plaid)

The Finance page shows your real accounts, balances, net worth and recent transactions through [Plaid](https://plaid.com), which covers most US and Canadian banks, cards and investment accounts (including Betterment). It is private: it has its own email sign-in, even while the rest of the dashboard is open, and only emails you list can see it. Access is read-only; nothing here can move money.

How it's kept safe:
- Plaid's secret and each bank's access token live only on the server (`api/finance.ts`, a Vercel Function) and in the `plaid_items` table, which has row-level security on and no policies, so only the server's service-role key can read it. Neither is ever sent to the browser or committed to the repo.
- Every request to the server must carry a Supabase session for an email in `FINANCE_EMAILS`.
- **Disconnect** removes the connection at Plaid and deletes its token.

Setup:
1. **Plaid:** sign up at [dashboard.plaid.com](https://dashboard.plaid.com) and apply for the free **Trial** plan (up to 10 connected banks; removing one doesn't free its slot). Under **Developers → Keys**, copy the client ID and the Production secret (or the Sandbox secret to try it with fake banks first).
2. **Supabase:**
   - In the SQL editor, run `supabase/migrations/0004_plaid_items.sql`.
   - Under **Authentication → URL Configuration**, set the Site URL to your site (for example `https://life-dashboard-nine-tau.vercel.app`) and add `https://life-dashboard-nine-tau.vercel.app/finance` and `http://localhost:5173/finance` to Redirect URLs.
   - Under **Project Settings → API Keys**, copy the `service_role` (secret) key.
3. **Vercel:** under **Settings → Environment Variables**, add these for Production, then redeploy:
   - `PLAID_CLIENT_ID`, `PLAID_SECRET`
   - `PLAID_ENV`: `production` (or `sandbox`)
   - `SUPABASE_URL`: your project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: the secret key from step 2
   - `FINANCE_EMAILS`: your email (comma-separate several)

Never put the Plaid secret or service-role key in a `VITE_` variable or an `.env` file in the repo: those end up in the browser. To try the server locally, run `vercel dev` with the same variables in a gitignored `.env.local`.

## Publish the website

Any static host works. With [Vercel](https://vercel.com) or [Netlify](https://netlify.com):

1. Import this GitHub repository.
2. Build command `npm run build`, output directory `dist`.
3. The Supabase URL and publishable key are already in `.env.production`, so no environment variables are needed. (Set them in the host instead if you ever point at a different project.)
4. After the first deploy, add the site's URL to Supabase's Site URL and redirect URLs (step 3 above).

## Project layout

```
src/
  App.tsx            sign-in, layout, greeting and summary
  components/        Nav (sidebar) and shared UI pieces (Panel, AddForm, …)
  sections/          the home page's cards, one file per section
  pages/             each section's own page (Calendar and Notes are built; the rest are placeholders)
  lib/
    router.tsx       page addresses (/calendar, /notes, …) and in-app links
    store.ts         the data layer: Supabase store and the demo (browser) store
    useDashboard.ts  loads entries and applies changes
    types.ts         the shape of each section's entries
    dates.ts         local-date helpers (tested in dates.test.ts)
  styles.css         the frosted pastel theme, light and dark
supabase/migrations/ database schema and security rules
```

Every entry is one row in `entries` with a `kind` (`events`, `todos`, `money`, `goals`, `trips`, `books`, `journal`, `wins`) and a JSON `data` column. To add a section, add its kind to `KINDS` in `types.ts` and to the check in the migration, then add a component in `sections/`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the built site |
| `npm test` | Run unit tests |

## Native app (later)

The plan is to wrap this web app with [Capacitor](https://capacitorjs.com), which reuses all of this code:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "My Life" com.example.mylife --web-dir dist
npm run build && npx cap add ios && npx cap add android
```

Before shipping it, switch sign-in to a deep link (Supabase supports custom URL schemes) and use the native camera plugin for journal photos.

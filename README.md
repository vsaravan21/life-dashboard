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

The Calendar section can show your Google Calendar events next to the ones you add by hand. It only reads them; nothing is written back. It runs entirely in the browser, so it needs a Google OAuth client ID:

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project (any name).
2. Go to **APIs & Services → Library**, search for **Google Calendar API**, and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen** (or **Google Auth Platform**). Choose **External**, fill in the app name and your email, and add your own Google account under **Test users**.
4. Go to **Credentials → Create credentials → OAuth client ID**, choose **Web application**, and under **Authorized JavaScript origins** add `http://localhost:5173` and your site's address (for example `https://life-dashboard-nine-tau.vercel.app`).
5. Copy the client ID (it ends in `.apps.googleusercontent.com`) into `VITE_GOOGLE_CLIENT_ID` in `.env.local`, and into `.env.production` for the live site.

The client ID is public; it only works from the origins you listed. Google's sign-in lasts about an hour, after which the section shows a **Sync Google Calendar** button to refresh it with one tap. While the app is in Google's "testing" mode, only the test users you added can connect.

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
  sections/          one file per dashboard section
  lib/
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

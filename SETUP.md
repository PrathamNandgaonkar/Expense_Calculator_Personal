# Turning on Google sign-in & cloud sync

Hisaab uses **Supabase** (free tier) for the database and Google login. One-time setup takes about 15 minutes.
Until you finish it, the app keeps working exactly as before: data in the browser only, no login screen.

Your live site: `https://expensecalculator-neon.vercel.app`

---

## 1. Create a Supabase project

1. Go to https://supabase.com, sign in, and click **New project**.
2. Give it a name (e.g. `hisaab`), set a database password (store it in your password manager), pick the region closest to you (e.g. *Mumbai*), and create it.
3. Wait ~1 minute for it to finish setting up.

## 2. Create the table

1. In the project, open **SQL Editor → New query**.
2. Paste in everything from [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.

This creates one private row per user. Row-level security means each account can only read and write its own data.

## 3. Create Google sign-in credentials

1. Go to https://console.cloud.google.com and create a new project (e.g. `Hisaab`).
2. **APIs & Services → OAuth consent screen** (or **Google Auth Platform → Branding**):
   - User type: **External**
   - App name: `Hisaab`, support email: your Gmail
   - Scopes: leave the defaults (`email`, `profile`, `openid`)
   - **Audience / Test users**: add every Gmail address that should be able to sign in, **or** click **Publish app**. With only these basic scopes, Google doesn't require a review.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins**:
     - `https://expensecalculator-neon.vercel.app`
     - `http://localhost:5173`
   - **Authorized redirect URIs**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (the exact URL is shown in Supabase at step 4, so copy it from there)
4. Click **Create** and keep the **Client ID** and **Client secret** handy for the next step.

## 4. Turn on Google in Supabase

1. Supabase → **Authentication → Sign In / Providers → Google** → enable it.
2. Paste the **Client ID** and **Client secret** from Google, then **Save**.
   (The *Callback URL* shown on this screen is what goes into Google's "Authorized redirect URIs".)
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://expensecalculator-neon.vercel.app`
   - **Redirect URLs**: add
     - `https://expensecalculator-neon.vercel.app/**`
     - `http://localhost:5173/**`

## 5. Connect the app

1. Supabase → **Project Settings → API** (or **API Keys**).
2. Copy the **Project URL** and the **anon / publishable** key into [`js/config.js`](js/config.js):

   ```js
   window.HISAAB_CONFIG = {
     supabaseUrl: 'https://abcdefghijkl.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...',
   };
   ```

   ⚠️ Use the **anon / publishable** key only, **never** the `service_role` / secret key. The anon key is designed to be public: your data is protected by the security rules from step 2, not by hiding the key. That's why it's fine for it to be in GitHub and on Vercel.

3. Commit and push. Vercel redeploys automatically:

   ```bash
   git add js/config.js
   git commit -m "Connect Supabase"
   git push origin main
   git push personal main
   ```

## 6. Try it

Open the site → **Continue with Google** → pick your Gmail. If this browser already had data from before, Hisaab offers to move it into your account. Then open the site on your phone and sign in with the same Gmail: everything is there.

---

## How it behaves

- **Saves automatically** about a second after each change. The sidebar shows *Synced / Saving… / Offline*.
- **Works offline**: changes are kept on the device and uploaded when you're back online.
- **Switching devices**: when you return to a tab, it pulls changes made on your other device.
- **Two devices editing at the same moment**: the last save wins, so finish on one device before editing on the other.
- **Sign out** removes this browser's copy (handy on shared computers). Your data stays in your account.
- **"Use on this device only"** keeps the old no-account behaviour.

## Troubleshooting

| Problem | Fix |
|---|---|
| Google says **"Access blocked: app not verified"** or **"access_denied"** | Add your Gmail as a *Test user* in the Google consent screen, or *Publish* the app. |
| **redirect_uri_mismatch** | The redirect URI in Google must be exactly the Supabase callback URL from step 4. |
| After Google sign-in you land on `localhost:3000` or the wrong site | Fix **Site URL** and **Redirect URLs** in Supabase (step 4.3). |
| "Couldn't reach your account" | Check `js/config.js` values and that `schema.sql` was run. |

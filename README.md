# Hisaab — split & track expenses from your ICICI statement

A personal expense splitter that runs entirely in your browser. Import an ICICI bank statement (CSV), split any expense with friends, and always see who owes you what.

## Run it

```bash
node server.js
```

Then open http://localhost:5173. (You can also double-click `index.html`, but the local server keeps your data under one stable address.)

No install step and no dependencies.

## Getting the CSV from ICICI

1. ICICI Net Banking → **My Accounts → Bank Accounts → Account Statement**
2. Pick the date range → **Download → CSV**
3. Drag the file onto the app (anywhere on the page)

Re-importing an overlapping period is safe: transactions you already have are skipped. If the columns aren't detected, the import screen lets you map them by hand. A fake statement for testing is in `sample/ICICI_sample_statement.csv`.

## Features

- **Dashboard**: total owed to you, who owes the most, spending by category, monthly spend split into *your share* and *lent to friends*, recent activity
- **Split**: equally, exact ₹, percent, or shares; add new people inline; quick-pick groups and "same as last time"; split several expenses at once
- **Ledger per person**: full history, record full or partial repayments (or money you paid them), copy a ready-to-send reminder
- **Repayments from the statement**: tap a credit and link it to the friend who paid you
- **Cash expenses**: add expenses that aren't in the statement
- Auto merchant names and categories from UPI/NEFT remarks (you can change any category, and apply it to every transaction from the same merchant)
- Undo on every change, keyboard shortcuts (press `?`), works on mobile
- Backup/restore (JSON) and CSV export

## Google sign-in & sync across devices

Sign in with Google and your ledger syncs between laptop and phone. It's stored in your own Supabase database, and row-level security keeps each account's data private. One-time setup: see **[SETUP.md](SETUP.md)**.

## Privacy

- **Signed in:** data is stored in your Supabase project under your Google account, and only that account can read it. The browser also keeps a copy so the app opens instantly and works offline.
- **"Use on this device only"** (or before sync is set up): everything stays in the browser's `localStorage` and nothing is uploaded. Clearing browser data erases it, so use **Backup & settings → Download backup** now and then.

## Files

- `index.html`: app shell
- `css/styles.css`: "Sand & Ocean" theme
- `js/parser.js`: ICICI CSV parser (header detection, dates, amounts, merchant/category extraction)
- `js/app.js`: state, split engine, views, dialogs, sign-in screen
- `js/cloud.js`: Supabase sync + Google sign-in
- `js/config.js`: your Supabase URL + anon key
- `supabase/schema.sql`: database table + security rules

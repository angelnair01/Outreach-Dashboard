# OpenGrad Outreach Dashboard

A one-page website that shows how OpenGrad's outreach to funders and partners is going:
who we've emailed or messaged on LinkedIn, who replied, which follow-ups are due, and where
each funder is in the funding pipeline.

> **Right now it uses made-up demo data.** No logins, no Google Sheets, no Gmail, no API keys.
> All names, companies and emails are fake.

## What's on the page

1. **Header**: when the data was last synced, plus a **Refresh** button.
2. **Key numbers**: contacts, emails sent, LinkedIn outreach, responses, awaiting response, overdue follow-ups, and follow-ups due in the next 7 days.
3. **What to do next**: a short to-do list worked out from the data. Each item has a button that jumps to the right section.
4. **Follow-ups**: tabs for Overdue, Today, Next 7 days and Later. Each follow-up says exactly **what to do**:
   - **Email**: send the intro or a follow-up email, or reply to theirs.
   - **LinkedIn**: send a connection request, a message, or a follow-up.
   - **Set up a call**: they replied and are interested, so book a call.
   - **After a call**: we already had a call, so the row shows how it went (for example *Positive – moving ahead* or *Needs more information*) and what to do now, such as "Email the information they asked for".

   You can also filter by type of follow-up (Email / LinkedIn / Set up a call / After a call / Proposal).
   "Mark sent", "Mark done" and "Call done" update the row. For now this only changes what's on your screen and resets when you refresh.
5. **Recent replies**: who wrote back, whether they're interested in funding, the funding status, and the call outcome if we've had a call.
6. **Charts**: the funding pipeline, outreach per week, and a breakdown of what we're reaching out for.
7. **All outreach**: a searchable, filterable and sortable table of every contact. Rows with missing information get a **Needs details** tag.

## Folder structure

```
.
├── index.html                 Page shell
├── package.json               Scripts and libraries
├── vite.config.js             Build settings (base './' so GitHub Pages works)
├── vercel.json                Vercel: send every URL to the app
├── public/_redirects          Netlify: same as above
├── .github/workflows/deploy.yml   Auto-deploy to GitHub Pages on push to main
└── src/
    ├── App.jsx                Lays out the page, top to bottom
    ├── config/
    │   ├── lists.js           Allowed values (Reaching out for, Next step, Funding status…) and badge colors
    │   └── settings.js        Small knobs: "next 7 days" window, weeks in chart, rows per page…
    ├── data/mockData.js       ~25 fake contacts, with dates relative to today
    ├── services/dataSource.js The ONLY place data is loaded from (swap this for real data later)
    ├── hooks/useOutreach.js   Loading, refresh, error and "Mark done"
    ├── utils/                 Pure functions that work out every number, list and chart from the records
    └── components/            Header, StatCard, NextStepsPanel, FollowUpTabs, ResponsesList,
                               PipelineChart, WeeklyChart, OutreachTable, StatusBadge, Skeleton, EmptyState
```

## Run it on your computer

You need [Node.js](https://nodejs.org) (version 18 or newer). Then, in this folder:

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

## Build it

```bash
npm run build
```

This creates a `dist/` folder with the finished website. To preview that build locally:

```bash
npm run preview
```

## Put this on GitHub (step by step)

You only do steps 1–3 once.

1. **Install Git**: download it from https://git-scm.com/download/win and install with the default options. Then close and reopen your terminal.
2. **Tell Git who you are** (use the name and email from your GitHub account):
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
3. **Create an empty repository on GitHub**: go to https://github.com/new, name it (for example `opengrad-outreach`), choose Public or Private, and **don't** tick "Add a README". Then click **Create repository**.
4. **Upload the code**: open a terminal in this folder and run these one at a time. Replace `YOUR-USERNAME` with your GitHub username.
   ```bash
   git init
   git add .
   git commit -m "OpenGrad Outreach dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/opengrad-outreach.git
   git push -u origin main
   ```
   The first push opens a browser window asking you to sign in to GitHub. Approve it.
5. **Refresh the GitHub page**: your code is there. `node_modules` and `dist` are left out on purpose (see `.gitignore`).

**Later changes:** after editing, run:
```bash
git add .
git commit -m "Describe what you changed"
git push
```

**On another computer:** download the code and run it:
```bash
git clone https://github.com/YOUR-USERNAME/opengrad-outreach.git
cd opengrad-outreach
npm install
npm run dev
```

## Deploy on Vercel

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com), click **Add New → Project** and import the repo.
3. Use these settings (Vercel usually detects them automatically):
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click **Deploy**.

Netlify works the same way: build command `npm run build`, publish directory `dist`.

## Deploy on GitHub Pages

1. Push this repo to GitHub on the `main` branch.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` now builds and publishes the site automatically. You can also run it by hand from the **Actions** tab ("Deploy to GitHub Pages" → "Run workflow").
4. The site address appears in **Settings → Pages** after the first run.

## How to connect real data later

Only edit **`src/services/dataSource.js`**. Replace the body of `getOutreachData()` so it loads
your real data (for example, from a small backend that reads the Google Sheet) and returns:

```js
{
  records: [ /* one object per contact, same fields as in src/data/mockData.js */ ],
  lastSynced: '2026-11-10T09:30:00Z'
}
```

Call fields: `callDone` (true/false), `callDate`, `callOutcome` (one of the values in
`CALL_OUTCOMES` in `src/config/lists.js`, or blank if not written down yet) and `callNotes`.

Dates should be `YYYY-MM-DD` strings. Blank cells can be `""` or `null`. Every number, chart and
to-do item on the page is worked out from `records` automatically, so nothing else needs to change.
If you add new dropdown values (for example, a new funding status), add them in `src/config/lists.js`.

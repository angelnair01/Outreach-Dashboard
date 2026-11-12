# OpenGrad Outreach Dashboard

A private website that shows your email outreach at a glance: who you emailed, who replied,
which follow-ups are coming, and lets you add new contacts or log outreach without opening the sheet.

Plain HTML, CSS and JavaScript. No frameworks, no build step. Works on GitHub Pages, Netlify or Vercel unchanged.

## How it fits together

```
Gmail (label "Outreach")
   │  your hourly sheet script (unchanged) tracks threads, sends follow-ups 1 and 2,
   ▼  detects replies and bounces
Google Sheet ── "Follow-up Log" tab (read only for the website)
             └─ "Leads" tab (contacts you add / outreach you log from the website)
   ▲
   │  apps-script/Code.gs: a small JSON API (separate Apps Script project)
   ▼
This website (any static host) asks the API for data with your private token
```

The website never talks to Gmail or Sheets directly, and never sends email.
"Write an email" / "Reply by email" open a draft in Gmail; you press Send yourself.

## Pages

| Page | What it shows |
|---|---|
| **Overview** | Number cards, "Needs your attention" (recent replies, follow-ups due, bounces), weekly chart, recent activity |
| **Pipeline** | Board: Waiting for reply · Following up · Replied · Stopped / no reply |
| **Replies** | Every reply with its text, plus Open in Gmail / Reply by email |
| **Follow-ups** | Due now and upcoming automatic follow-ups (last mail + 7 days, 1 or 2 of 2) |
| **Contacts** | Search, sort, filter by stage and date, Download CSV |
| **Add & log** | Add a new contact to reach out to, or log outreach already done (LinkedIn, call, meeting…) |
| **Settings** | Connection status, last sync, Sign out, theme, refresh interval |

Click any contact anywhere to open its side panel (details, next follow-up, reply, Gmail buttons).

## Files

```
index.html         the page shell
config.js          API_URL (your Apps Script Web app URL) and options. No secrets.
css/style.css      all styling (light and dark)
js/                small scripts: util, api, store, chart, panel, app, pages/*
apps-script/       the backend: paste into script.google.com (see below)
  Code.gs          the API code (safe to replace on updates)
  Settings.gs      template for your sheet ID + token (fill in ONLY in Apps Script)
```

## Signing in

The first time you open the site in a browser, type your token. That browser remembers it.
To share the dashboard, send people the link and (privately) the token. Everyone with the token sees all data.
To cut off access, change `API_TOKEN` in the Apps Script **Settings** file, then publish a new version
(Deploy → Manage deployments → ✏ → New version → Deploy). Everyone then has to type the new token.

"Try it with sample data" on the sign-in screen shows made-up data, handy for demos.

## Updating the backend

1. Open the **Outreach API** project at script.google.com.
2. Replace everything in **Code.gs** with `apps-script/Code.gs` from this repo. Leave **Settings** alone.
3. Deploy → **Manage deployments** → ✏ → Version: **New version** → Deploy. (Not "New deployment": that changes the URL.)

## Options in config.js

- `ENABLE_CALL_WHATSAPP: false`: set to `true` to turn on phone numbers (saved in the browser only),
  Call / WhatsApp buttons, "Plan a call / Plan WhatsApp" and the Call / WhatsApp pipeline column.
- `FOLLOWUP_DAYS` / `MAX_FOLLOWUPS`: must match the sheet script (7 and 2).

## Adding your partner's Gmail

Add a row for their Gmail in the **Accounts** tab of the master sheet and set it to Active.
Their mails appear on the dashboard automatically. Nothing changes here.

## Hosting

- **GitHub Pages**: pushing to `main` publishes the site via `.github/workflows/deploy.yml`.
  In the repo: Settings → Pages → Source: **GitHub Actions**.
- **Netlify / Vercel**: import the repo, no build command, publish directory = the repo root.

The old React version of this dashboard is kept on the `old-react-dashboard` branch.

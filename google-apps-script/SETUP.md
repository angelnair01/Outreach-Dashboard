# Connect the dashboard to Gmail (step by step)

This sets up a **Google Sheet** that stores all contacts and a small **Google Apps Script** inside
it that reads Gmail and keeps the sheet up to date. The dashboard then reads (and adds to) that sheet.

- No server and no cost: it all runs in your Google account.
- About 15 minutes, once.
- You need: a Google account with the Gmail you send outreach from (e.g. your opengrad.in account).

```
Gmail ──(every 15 min)──► Google Sheet "Contacts" ◄──(read / add / edit)── Dashboard
```

---

## Step 1 – Create the Google Sheet

1. Go to https://sheets.new (signed in with your OpenGrad Google account).
2. Name it **OpenGrad Outreach** (top-left).

## Step 2 – Add the script

1. In the sheet: **Extensions → Apps Script**. A new tab opens.
2. Delete everything in the `Code.gs` editor.
3. Open [`google-apps-script/Code.gs`](./Code.gs) from this project, copy **all** of it, and paste it in.
4. Click 💾 **Save** (or Ctrl+S). Name the project **OpenGrad Outreach** if asked.
5. Optional: change the settings at the top of the file (`CONFIG`), e.g. follow-up days or the Gmail label name.

## Step 3 – Set up the sheet

1. Go back to the sheet tab and **reload the page**. A new menu **Outreach dashboard** appears (it can take ~10 seconds).
2. Click **Outreach dashboard → 1. Set up this sheet**.
3. Google asks for permission the first time:
   - **Review permissions** → choose your account.
   - If you see "Google hasn't verified this app": click **Advanced → Go to OpenGrad Outreach (unsafe)**.
     (It's your own script, so this warning is expected.)
   - **Allow**. It needs to read Gmail and edit this spreadsheet.
4. A message shows your **access key**. Copy it somewhere safe. You can see it again later via
   **Outreach dashboard → Show access key**.

The sheet now has a **Contacts** tab with headers, checkboxes, dropdowns and date columns.

## Step 4 – Turn on automatic Gmail sync

1. **Outreach dashboard → 2. Turn on automatic Gmail sync (for me)**.
2. It runs a first sync immediately and then every 15 minutes, reading **your** Gmail.

> **Teammates:** each person who sends outreach from their own Gmail should open the same sheet and
> click **2. Turn on automatic Gmail sync (for me)** once. Each sync reads only that person's mailbox
> and updates the shared sheet.

## Step 5 – Publish the script as a web app (so the dashboard can reach it)

1. In the Apps Script tab: **Deploy → New deployment**.
2. Click the ⚙️ gear next to "Select type" → **Web app**.
3. Fill in:
   - Description: `Dashboard API`
   - **Execute as: Me**
   - **Who has access: Anyone**
4. **Deploy** → allow access again if asked.
5. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.

"Anyone" only means the dashboard can reach the script. Every request still needs the **access key**,
and without it nothing is returned.

## Step 6 – Connect the dashboard

1. Open the dashboard (e.g. http://localhost:5173).
2. Click **Connect** (top right).
3. Paste the **Web app URL** and the **access key** → **Test & connect**.
4. The badge at the top changes to **Live: Google Sheet + Gmail**. 🎉

The URL and key are saved only in that browser. Each teammate does step 6 once on their own computer.

---

## Adding contacts

You can add contacts in any of three ways:

1. **Dashboard → Add contact.** A form; only a company or name is required.
2. **Type straight into the sheet.** Add a row in the Contacts tab; the ID fills in automatically.
3. **Automatically from Gmail.** In Gmail, create a label called **Outreach**. When you send an
   outreach email, add that label to it (in the compose window: ⋮ → Label → Outreach). The
   next sync adds the recipient as a new contact if they aren't in the sheet yet.

To **log a call**: click **Edit** on a contact (or **Add call outcome** in Follow-ups), tick
**We had a call**, choose how it went and add notes.

## What the Gmail sync fills in

For every contact with an email address:

| Column | How it's filled |
|---|---|
| Email sent / Email date | Your first email to them |
| Follow-ups done | Number of emails you sent after the first one |
| Last outreach date | Your latest email to them |
| Replied / Reply date | Their latest email to you |
| Next follow-up date + Next step | They replied → due the day they replied ("Follow-up email"). You wrote last → 4 days after your first email, then 7 days after each follow-up ("Waiting for reply"). Contacts marked Close / Declined / Funded are left alone. |
| Owner | If empty: the person whose Gmail found the first email |

LinkedIn, calls, interest and funding status can't be read from Gmail, so update those from the dashboard or the sheet.

## Updating the script later

If `Code.gs` changes: paste the new version, Save, then **Deploy → Manage deployments → ✏️ Edit →
Version: New version → Deploy**. The web app URL stays the same.

## Troubleshooting

| Problem | Fix |
|---|---|
| No **Outreach dashboard** menu | Reload the sheet and wait ~10 s. Or in Apps Script, choose `onOpen` and click ▶ Run once. |
| Dashboard says "Wrong access key" | Copy it again from **Outreach dashboard → Show access key**. |
| Dashboard says "Unexpected reply from Google" | Web app access must be **Anyone**, and the URL must end in `/exec`. If your Google Workspace admin blocks "Anyone", ask them to allow it for this script. |
| Nothing updates from Gmail | Check **Outreach dashboard → Sync Gmail now**. Make sure the contact's **Email** column matches the address they write from. |
| A teammate's emails aren't picked up | That teammate must click **2. Turn on automatic Gmail sync (for me)** themselves. |
| Turn sync off | **Outreach dashboard → Turn off automatic Gmail sync (for me)**. |

/* Website settings. No secrets here: the token is typed in on the sign-in screen. */
window.APP_CONFIG = {
  // Your Google Apps Script "Web app URL" (ends in /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbyjXY1hrUGAJaapY44DUE9KWSkH1jsz1LM7snHIENSz-dSgNa6Z6YqiAjjbl2a-e-ASEw/exec',
  // "Sign in with Google" client ID (public, not a secret). Ends in .apps.googleusercontent.com
  GOOGLE_CLIENT_ID: '470187357536-ca5aevo4gcnklpmcicb9a9e9f2qos5dg.apps.googleusercontent.com',
  // Name shown at the top of the sidebar
  APP_NAME: 'OpenGrad Outreach',
  // Days between follow-ups (must match the sheet script)
  FOLLOWUP_DAYS: 7,
  MAX_FOLLOWUPS: 2,
  // "Outreach Sync" web app address (ends in /exec). Used by "Connect my Gmail" and the Sync button.
  SYNC_URL: 'https://script.google.com/macros/s/AKfycbz8dpELo0OrtZJl0H33kpaoGMDGmDJDVsFW7UPcSeGIqX_h1B-jwTJ5vCtbS66ES22r/exec',
  // Live sync: how often (seconds) the open dashboard re-checks the sheet. Minimum 10.
  LIVE_SECONDS: 10,
  // Call / WhatsApp features (phone numbers, "Plan a call", the Call / WhatsApp column).
  // Off for now: Gmail only. Change false to true to turn them on later.
  ENABLE_CALL_WHATSAPP: false
};

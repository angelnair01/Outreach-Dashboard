/* Website settings. No secrets here: the token is typed in on the sign-in screen. */
window.APP_CONFIG = {
  // Your Google Apps Script "Web app URL" (ends in /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbyjXY1hrUGAJaapY44DUE9KWSkH1jsz1LM7snHIENSz-dSgNa6Z6YqiAjjbl2a-e-ASEw/exec',
  // Name shown at the top of the sidebar
  APP_NAME: 'OpenGrad Outreach',
  // Days between follow-ups (must match the sheet script)
  FOLLOWUP_DAYS: 7,
  MAX_FOLLOWUPS: 2,
  // Call / WhatsApp features (phone numbers, "Plan a call", the Call / WhatsApp column).
  // Off for now: Gmail only. Change false to true to turn them on later.
  ENABLE_CALL_WHATSAPP: false
};

/**
 * Your settings. In the Apps Script editor this is its own file called "Settings".
 * Fill these in THERE. (Neither value is a password, but keep the real ones out of GitHub anyway.)
 */

// One master sheet holds the outreach for every Gmail account (you and Sebin).
// Extra Gmail accounts are added in that sheet's "Accounts" tab, not here.
const SHEET_IDS = ['PASTE_YOUR_SHEET_ID_HERE'];

// From Google Cloud > Google Auth Platform > Clients (ends in .apps.googleusercontent.com).
const GOOGLE_CLIENT_ID = 'PASTE_YOUR_CLIENT_ID_HERE';

// true  = anyone can sign in with their Gmail and sees ONLY their own outreach.
// false = only Gmail addresses listed in the "Dashboard Access" tab can sign in.
const OPEN_ACCESS = true;

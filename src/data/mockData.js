/**
 * FAKE outreach records for the demo. All people, companies and emails are made up.
 * Dates are generated relative to today, so the page always shows a realistic mix of
 * overdue, due today, next 7 days, later, replied and partial rows.
 */
import { addDays, today, toDateString } from '../utils/dates.js';

const OWNERS = ['Asha K.', 'Dev M.', 'Nina R.'];

/** Offset in days from today -> "YYYY-MM-DD" (null stays null). */
const d = (offset) => (offset === null || offset === undefined ? null : toDateString(addDays(today(), offset)));

const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '');

function makeRecord(i, row) {
  const emailDate = row.email ?? null;
  const linkedinDate = row.linkedin ?? null;
  const touches = [emailDate, linkedinDate, row.last, row.call].filter((v) => v !== null && v !== undefined);
  const lastOutreach = touches.length ? Math.max(...touches) : null;
  const person = row.contactPerson ?? '';
  return {
    id: `c-${String(i + 1).padStart(3, '0')}`,
    company: row.company,
    contactPerson: person,
    designation: row.designation ?? '',
    email: row.emailAddress ?? (person ? `${slug(person.split(' ')[0])}.${slug(person.split(' ').slice(-1)[0])}@example.org` : ''),
    linkedinProfile: person ? `linkedin.com/in/${slug(person)}-example` : '',
    reachingOutFor: row.reachingOutFor ?? '',
    emailSent: emailDate !== null,
    emailDate: d(emailDate),
    linkedinSent: linkedinDate !== null,
    linkedinDate: d(linkedinDate),
    followUpsDone: row.followUps ?? 0,
    lastOutreachDate: d(lastOutreach),
    nextStep: row.nextStep ?? '',
    nextFollowUpDate: d(row.next),
    replied: row.reply !== undefined && row.reply !== null,
    replyDate: d(row.reply),
    callDone: row.call !== undefined && row.call !== null,
    callDate: d(row.call),
    callOutcome: row.outcome ?? '',
    callNotes: row.callNotes ?? '',
    interestedInFunding: row.interested ?? 'Not known yet',
    fundingStatus: row.funding ?? 'Not discussed',
    owner: OWNERS[row.owner ?? i % OWNERS.length],
    notes: row.notes ?? '',
  };
}

// Offsets are days relative to today (negative = in the past).
const ROWS = [
  // --- Overdue follow-ups ---
  { company: 'Kaveri Power Ltd', contactPerson: 'Anjali Deshpande', designation: 'Head of CSR', reachingOutFor: 'CSR funding', email: -12, linkedin: -10, followUps: 1, last: -5, nextStep: 'Follow-up email', next: -2, notes: 'Their CSR committee meets quarterly.' },
  { company: 'Indus Valley Finance', contactPerson: 'Rajesh Menon', designation: 'CSR Manager', reachingOutFor: 'CSR funding', email: -9, followUps: 1, last: -4, nextStep: 'Follow-up email', next: -1 },
  { company: 'Bharat Agro Foundation', contactPerson: 'Sunita Rao', designation: 'Program Director', reachingOutFor: 'Partnership', email: -15, linkedin: -15, followUps: 2, last: -7, nextStep: 'Follow-up LinkedIn', next: -4 },
  { company: 'Mehra Family Office', contactPerson: 'Vivek Mehra', designation: 'Trustee', reachingOutFor: 'Individual donation', linkedin: -6, nextStep: 'Send LinkedIn message', next: -3, notes: 'Accepted the LinkedIn request.' },

  // --- Due today ---
  { company: 'Coastal Ports Ltd', contactPerson: 'Farida Ansari', designation: 'CSR Lead', reachingOutFor: 'CSR funding', email: -4, nextStep: 'Follow-up email', next: 0 },
  { company: 'Nilgiri Tech Solutions', contactPerson: 'Arvind Iyer', designation: 'VP, People', reachingOutFor: 'Mentorship / volunteers', email: -3, linkedin: -3, nextStep: 'Follow-up email', next: 0 },
  { company: 'Individual donor', contactPerson: 'Ritu Malhotra', designation: 'Entrepreneur', reachingOutFor: 'Individual donation', linkedin: -10, reply: -8, interested: 'Maybe', nextStep: 'Schedule call / meeting', next: 0, notes: 'Wants to hear student stories first.' },

  // --- Next 7 days ---
  { company: 'Greenleaf Consumer Goods', contactPerson: 'Pooja Bansal', designation: 'Sustainability & CSR Manager', reachingOutFor: 'CSR funding', email: -2, nextStep: 'Waiting for reply', next: 2 },
  { company: 'Shakti Cement', contactPerson: 'Harish Kulkarni', designation: 'Head – CSR', reachingOutFor: 'CSR funding', email: -1, linkedin: -1, nextStep: 'Follow-up email', next: 4 },
  { company: 'Individual donor', contactPerson: 'Anand Rao', designation: 'Angel investor', reachingOutFor: 'Individual donation', linkedin: -5, nextStep: 'Send LinkedIn message', next: 1 },
  { company: 'Prerna Foundation', contactPerson: 'Lata Pillai', designation: 'CEO', reachingOutFor: 'Partnership', email: -8, followUps: 1, last: -5, reply: -3, call: -1, interested: 'Maybe', funding: 'Discussing', nextStep: 'Follow-up email', next: 1, notes: 'Call happened yesterday; outcome not written down yet.' },
  { company: 'Sunrise Pharma', contactPerson: 'Meenakshi Sundaram', designation: 'CSR Head', reachingOutFor: 'CSR funding', email: -18, followUps: 1, last: -11, reply: -6, call: -3, outcome: 'Positive – moving ahead', callNotes: 'Wants a proposal for 20 scholarships.', interested: 'Yes', funding: 'Discussing', nextStep: 'Send proposal', next: 1, notes: 'Interested in funding 20 scholarships.' },
  { company: 'Ganga Housing Finance', contactPerson: 'Rohit Saxena', designation: 'AVP, CSR', reachingOutFor: 'CSR funding', email: -25, linkedin: -24, reply: -15, call: -12, outcome: 'Positive – moving ahead', callNotes: 'Committed in principle; needs a formal proposal.', interested: 'Yes', funding: 'Committed', nextStep: 'Send proposal', next: 3 },
  { company: 'Lotus Learning Foundation', contactPerson: 'Imran Qureshi', designation: 'Partnerships Lead', reachingOutFor: 'Partnership', email: -11, reply: -9, call: -4, outcome: 'Needs more information', callNotes: 'Asked for our latest impact report.', interested: 'Maybe', funding: 'Discussing', nextStep: 'Follow-up email', next: -1 },
  { company: 'Saffron Foods', contactPerson: 'Gautam Shetty', designation: 'CSR & Sustainability Head', reachingOutFor: 'CSR funding', email: -9, followUps: 1, last: -5, reply: -2, interested: 'Yes', nextStep: 'Schedule call / meeting', next: 2, notes: 'Replied asking for a quick call next week.' },

  // --- Later ---
  { company: 'Horizon Logistics', contactPerson: 'Sameer Khan', designation: 'CSR Coordinator', reachingOutFor: 'CSR funding', email: -3, nextStep: 'Waiting for reply', next: 10 },
  { company: 'Vidya Trust', contactPerson: 'Kiran Joshi', designation: 'Grants Manager', reachingOutFor: 'Partnership', email: -38, followUps: 2, last: -14, nextStep: 'Waiting for reply', next: 14 },
  { company: 'Brightstone IT Services', contactPerson: 'Shalini Gupta', designation: 'HR Business Partner', reachingOutFor: 'Mentorship / volunteers', email: -14, reply: -12, call: -2, outcome: 'Positive – moving ahead', callNotes: 'Confirmed 5 mentors from January.', interested: 'No', nextStep: 'Follow-up email', next: 9, notes: 'Happy to send 5 mentors; no funding.' },
  { company: 'Rangoli Retail', contactPerson: 'Tanya Kapoor', designation: 'CSR Manager', reachingOutFor: 'CSR funding', nextStep: 'Send intro email', next: 8 },

  // --- Closed: funded / declined ---
  { company: 'Deccan Textiles', contactPerson: 'Kavita Reddy', designation: 'CSR Manager', reachingOutFor: 'CSR funding', email: -40, followUps: 1, last: -33, reply: -22, call: -28, outcome: 'Positive – moving ahead', interested: 'Yes', funding: 'Funded', nextStep: 'Close', notes: 'Funding received for this academic year.' },
  { company: 'Orbit Motors', contactPerson: 'Prakash Nair', designation: 'Head of CSR', reachingOutFor: 'CSR funding', email: -45, followUps: 1, last: -30, reply: -16, call: -14, outcome: 'Not interested', callNotes: 'Focused on healthcare this year.', interested: 'No', funding: 'Declined', nextStep: 'Close', notes: 'Focused on healthcare this year.' },
  { company: 'Western Ghats Bank', contactPerson: 'Deepa Hegde', designation: 'CSR Officer', reachingOutFor: 'CSR funding', email: -19, reply: -10, interested: 'No', funding: 'Declined', nextStep: 'Close', notes: 'Budget already allocated; try again in April.' },
  { company: 'Arora Ventures', contactPerson: 'Neeraj Arora', designation: 'Founder', reachingOutFor: 'Individual donation', email: -27, linkedin: -26, reply: -20, call: -15, outcome: 'Asked us to wait', callNotes: 'Revisit after their financial quarter closes.', interested: 'Yes', funding: 'Committed', nextStep: 'Follow-up email', next: 12 },

  // --- Partial rows (need details) ---
  { company: 'Silverline Hospitality', emailAddress: 'csr@silverline-hospitality.example.com', reachingOutFor: 'CSR funding', email: -7 },
  { company: 'Pinewood Holdings', contactPerson: 'Abhishek Jain', designation: 'Director', reachingOutFor: 'Other', nextStep: 'Send intro email' },
  { company: 'Ocean Blue Foundation', contactPerson: 'Nandini Bose', designation: 'Program Officer', reachingOutFor: 'Partnership', email: -5 },
];

export function buildMockRecords() {
  return ROWS.map((row, i) => makeRecord(i, row));
}

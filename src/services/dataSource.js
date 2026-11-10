/**
 * The ONE place the dashboard gets its data from.
 *
 * getOutreachData() must resolve to:
 *   {
 *     records: Array<{
 *       id, company, contactPerson, designation, email, linkedinProfile, reachingOutFor,
 *       emailSent (bool), emailDate, linkedinSent (bool), linkedinDate, followUpsDone (number),
 *       lastOutreachDate, nextStep, nextFollowUpDate, replied (bool), replyDate,
 *       callDone (bool), callDate, callOutcome (see CALL_OUTCOMES in src/config/lists.js), callNotes,
 *       interestedInFunding, fundingStatus, owner, notes
 *     }>,                         // dates as "YYYY-MM-DD" strings; blanks as "" or null
 *     lastSynced: string,         // ISO date-time of when the data was last refreshed
 *   }
 *
 * Every number, chart and to-do on the page is worked out from `records` (see src/utils/),
 * so the real data source only needs to provide the raw rows.
 */
import { buildMockRecords } from '../data/mockData.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getOutreachData() {
  // Later, replace the body of this function to load the real data.
  // For example:
  //   const res = await fetch('https://your-backend.example.com/outreach');
  //   if (!res.ok) throw new Error('Could not load outreach data');
  //   return await res.json(); // { records, lastSynced }
  await delay(700);
  return {
    records: buildMockRecords(),
    lastSynced: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  };
}

/** Simple yes/no questions about a single record. */

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

export const isClosed = (r) => r.nextStep === 'Close' || r.fundingStatus === 'Declined' || r.fundingStatus === 'Funded';

/** Has any outreach (email or LinkedIn) happened yet? */
export const isReached = (r) => Boolean(r.emailSent || r.linkedinSent);

/** Reached out, but no reply yet. */
export const isAwaitingResponse = (r) => isReached(r) && !r.replied;

/** A replied contact who is open to funding and not yet committed/declined. */
export const isWarmLead = (r) =>
  r.replied &&
  (r.interestedInFunding === 'Yes' || r.interestedInFunding === 'Maybe') &&
  (r.fundingStatus === 'Not discussed' || r.fundingStatus === 'Discussing');

/**
 * Partial rows: missing a contact person, a next step, or a follow-up date (unless closed).
 * Shown with a "Needs details" tag.
 */
export function needsDetails(r) {
  if (isBlank(r.contactPerson)) return true;
  if (missingCallOutcome(r)) return true;
  if (isClosed(r)) return false;
  return isBlank(r.nextStep) || isBlank(r.nextFollowUpDate);
}

/** Missing next step or follow-up date (and not closed). Used by "What to do next". */
export const missingNextStep = (r) => !isClosed(r) && (isBlank(r.nextStep) || isBlank(r.nextFollowUpDate));

/** A call happened but nobody wrote down how it went. */
export const missingCallOutcome = (r) => Boolean(r.callDone) && isBlank(r.callOutcome);

export const displayValue = (v) => (isBlank(v) ? '-' : v);

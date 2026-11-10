/** Small knobs for how the dashboard groups and schedules things. */
export const SETTINGS = {
  // "Next 7 days" tab and stat card: follow-ups due from tomorrow up to this many days ahead.
  upcomingWindowDays: 7,

  // When you click "Mark done", the next follow-up is scheduled this many days later.
  daysUntilNextFollowUp: 7,

  // When you click "Call done", the follow-up after the call (thank-you / next steps) is due this many days later.
  daysToFollowUpAfterCall: 1,

  // Weeks start on Monday (0 = Sunday, 1 = Monday).
  weekStartsOn: 1,

  // How many weeks to show in the "Outreach per week" chart.
  weeksInChart: 8,

  // Rows shown in the table before "Show more".
  tablePageSize: 10,

  // Replies shown in the Responses section.
  recentRepliesLimit: 8,
};

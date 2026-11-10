import { MessageSquare } from 'lucide-react';
import Section from './Section.jsx';
import { SkeletonRows } from './Skeleton.jsx';
import EmptyState, { ErrorState } from './EmptyState.jsx';
import { CallOutcomeBadge, FundingStatusBadge, InterestBadge } from './StatusBadge.jsx';
import { formatDate, relativeDays } from '../utils/dates.js';
import { displayValue } from '../utils/records.js';

export default function ResponsesList({ replies, loading, error, onRetry }) {
  let body;
  if (loading) body = <SkeletonRows rows={5} className="h-16" />;
  else if (error) body = <ErrorState onRetry={onRetry} />;
  else if (replies.length === 0)
    body = <EmptyState icon={MessageSquare} title="No replies yet" message="Replies will show up here as soon as someone writes back." />;
  else
    body = (
      <ul className="divide-y divide-slate-100">
        {replies.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-base font-semibold text-slate-900">{displayValue(r.contactPerson)}</p>
              <p className="text-sm text-slate-600">
                Replied <time dateTime={r.replyDate}>{formatDate(r.replyDate)}</time>
                {r.replyDate && <span className="text-slate-500"> ({relativeDays(r.replyDate)})</span>}
              </p>
            </div>
            <p className="text-sm text-slate-600">{r.company}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <InterestBadge value={r.interestedInFunding} />
              <FundingStatusBadge value={r.fundingStatus} />
              {r.callDone && <CallOutcomeBadge outcome={r.callOutcome} />}
            </div>
            {r.callDone && (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium">Call {formatDate(r.callDate)}:</span>{' '}
                {r.callNotes || (r.callOutcome ? r.callOutcome : 'outcome not written down yet')}
              </p>
            )}
            {r.notes && r.notes !== r.callNotes && <p className="mt-1 text-sm text-slate-600">{r.notes}</p>}
          </li>
        ))}
      </ul>
    );

  return (
    <Section id="responses" title="Recent replies" description="The latest people who wrote back.">
      {body}
    </Section>
  );
}

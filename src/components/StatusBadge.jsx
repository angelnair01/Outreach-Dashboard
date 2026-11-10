import { FileText, Linkedin, Mail, Phone, PhoneCall } from 'lucide-react';
import { CALL_OUTCOME_TONES, FUNDING_STATUS_TONES, INTERESTED_TONES, TONE_CLASSES } from '../config/lists.js';

export const ACTION_ICONS = {
  email: Mail,
  linkedin: Linkedin,
  call: Phone,
  afterCall: PhoneCall,
  proposal: FileText,
};

/** The recommended action, with an icon so the kind of follow-up is obvious at a glance. */
export function ActionTag({ action }) {
  const Icon = ACTION_ICONS[action.type] ?? Mail;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-600/15">
      <Icon aria-hidden="true" className="h-4 w-4" />
      {action.label}
    </span>
  );
}

export function CallOutcomeBadge({ outcome }) {
  if (!outcome) return <Badge tone="amber">Call outcome missing</Badge>;
  return (
    <Badge tone={CALL_OUTCOME_TONES[outcome]}>
      Call: {outcome}
    </Badge>
  );
}

/** A small colored pill. Always has a text label, so color is never the only signal. */
export function Badge({ tone = 'gray', children, srPrefix }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset ${TONE_CLASSES[tone] ?? TONE_CLASSES.gray}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {srPrefix && <span className="sr-only">{srPrefix}: </span>}
      {children}
    </span>
  );
}

export function FundingStatusBadge({ value }) {
  if (!value) return <span className="text-slate-400">-</span>;
  return (
    <Badge tone={FUNDING_STATUS_TONES[value]} srPrefix="Funding status">
      {value}
    </Badge>
  );
}

export function InterestBadge({ value }) {
  if (!value) return <span className="text-slate-400">-</span>;
  return (
    <Badge tone={INTERESTED_TONES[value]} srPrefix="Interested in funding">
      {value === 'Not known yet' ? 'Interest not known' : `Interested: ${value}`}
    </Badge>
  );
}

export function RepliedBadge({ replied }) {
  return replied ? <Badge tone="green">Replied</Badge> : <Badge tone="gray">No reply</Badge>;
}

export function NeedsDetailsTag() {
  return <Badge tone="amber">Needs details</Badge>;
}

export default Badge;

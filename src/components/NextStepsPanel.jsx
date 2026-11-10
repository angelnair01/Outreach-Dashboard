import { AlertCircle, ArrowRight, CheckCircle2, Clock, Info } from 'lucide-react';
import Section from './Section.jsx';
import { SkeletonRows } from './Skeleton.jsx';
import EmptyState, { ErrorState } from './EmptyState.jsx';

const PRIORITY = {
  red: { icon: AlertCircle, label: 'Urgent', bar: 'bg-rose-500', iconClass: 'text-rose-600', bg: 'bg-rose-50/70' },
  amber: { icon: Clock, label: 'Soon', bar: 'bg-amber-500', iconClass: 'text-amber-600', bg: 'bg-amber-50/70' },
  green: { icon: CheckCircle2, label: 'Good news', bar: 'bg-emerald-500', iconClass: 'text-emerald-600', bg: 'bg-emerald-50/70' },
  gray: { icon: Info, label: 'Tidy up', bar: 'bg-slate-400', iconClass: 'text-slate-500', bg: 'bg-slate-50' },
};

export default function NextStepsPanel({ steps, loading, error, onRetry, onAction }) {
  let body;
  if (loading) body = <SkeletonRows rows={4} className="h-16" />;
  else if (error) body = <ErrorState onRetry={onRetry} />;
  else if (steps.length === 0) body = <EmptyState icon={CheckCircle2} title="Nothing to do right now" />;
  else
    body = (
      <ol className="space-y-3">
        {steps.map((step) => {
          const p = PRIORITY[step.priority] ?? PRIORITY.gray;
          const Icon = p.icon;
          return (
            <li
              key={step.id}
              className={`relative flex flex-col gap-3 overflow-hidden rounded-xl py-4 pl-5 pr-4 sm:flex-row sm:items-center sm:justify-between ${p.bg}`}
            >
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${p.bar}`} />
              <div className="flex items-start gap-3">
                <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${p.iconClass}`} />
                <p className="text-base text-slate-800 sm:text-lg">
                  <span className="sr-only">{p.label}: </span>
                  {step.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAction(step)}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-indigo-50 sm:self-auto"
              >
                {step.actionLabel}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ol>
    );

  return (
    <Section id="next-steps" title="What to do next" description="Worked out from the latest data, most urgent first.">
      {body}
    </Section>
  );
}

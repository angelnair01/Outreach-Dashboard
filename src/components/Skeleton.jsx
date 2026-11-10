/** Grey pulsing placeholder shown while data loads. */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />;
}

/** A stack of placeholder rows, announced once to screen readers. */
export function SkeletonRows({ rows = 4, className = 'h-14' }) {
  return (
    <div role="status" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default Skeleton;

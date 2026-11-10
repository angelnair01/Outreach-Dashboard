/** A white card with a heading. `id` is the scroll target used by "What to do next". */
export default function Section({ id, title, description, children, className = '' }) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={`scroll-mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 focus:outline-none sm:p-6 ${className}`}
    >
      <div className="mb-5">
        <h2 id={headingId} className="text-xl font-semibold text-slate-900">
          {title}
        </h2>
        {description && <p className="mt-1 text-base text-slate-600">{description}</p>}
      </div>
      {children}
    </section>
  );
}

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS, ChartCard, ChartTooltip, SrTable } from './chartParts.jsx';

/** Outreach per week (emails + LinkedIn), last N weeks. */
export default function WeeklyChart({ data, loading, error, onRetry }) {
  const isEmpty = data.every((d) => d.total === 0);
  return (
    <ChartCard
      title="Outreach per week"
      description={`Emails and LinkedIn messages sent, last ${data.length} weeks.`}
      loading={loading}
      error={error}
      onRetry={onRetry}
      isEmpty={isEmpty}
    >
      <div className="h-64" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={6}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: CHART_COLORS.cursor }}
              content={
                <ChartTooltip
                  format={(d) => [`${d.total} total`, `${d.email} email${d.email === 1 ? '' : 's'}`, `${d.linkedin} on LinkedIn`]}
                />
              }
            />
            <Bar dataKey="total" fill={CHART_COLORS.bar} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SrTable
        caption="Outreach per week"
        headers={['Week starting', 'Total', 'Emails', 'LinkedIn']}
        rows={data.map((d) => [d.label, d.total, d.email, d.linkedin])}
      />
    </ChartCard>
  );
}

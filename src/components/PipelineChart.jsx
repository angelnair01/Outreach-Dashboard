import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS, ChartCard, ChartTooltip, SrTable } from './chartParts.jsx';

/** Funding pipeline: how many contacts are at each funding status. */
export default function PipelineChart({ data, loading, error, onRetry }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ChartCard
      title="Funding pipeline"
      description="How many contacts are at each funding stage."
      loading={loading}
      error={error}
      onRetry={onRetry}
      isEmpty={total === 0}
    >
      <div className="h-64" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="status"
              width={104}
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART_COLORS.axis, fontSize: 14 }}
            />
            <Tooltip
              cursor={{ fill: CHART_COLORS.cursor }}
              content={<ChartTooltip format={(d) => [`${d.count} contact${d.count === 1 ? '' : 's'}`]} />}
            />
            <Bar dataKey="count" fill={CHART_COLORS.bar} radius={[0, 4, 4, 0]} isAnimationActive={false} minPointSize={2}>
              <LabelList dataKey="count" position="right" fill="#0f172a" fontSize={14} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption="Funding pipeline" headers={['Funding status', 'Contacts']} rows={data.map((d) => [d.status, d.count])} />
    </ChartCard>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, CalendarClock, CheckCircle2, Hourglass, Info, Linkedin, Mail, MessageCircleReply, TriangleAlert, Users } from 'lucide-react';
import ContactForm from './components/ContactForm.jsx';
import ConnectDialog from './components/ConnectDialog.jsx';
import { useOutreach } from './hooks/useOutreach.js';
import Header from './components/Header.jsx';
import StatCard from './components/StatCard.jsx';
import NextStepsPanel from './components/NextStepsPanel.jsx';
import FollowUpTabs from './components/FollowUpTabs.jsx';
import ResponsesList from './components/ResponsesList.jsx';
import PipelineChart from './components/PipelineChart.jsx';
import WeeklyChart from './components/WeeklyChart.jsx';
import ReasonBreakdown from './components/ReasonBreakdown.jsx';
import OutreachTable, { DEFAULT_TABLE_FILTERS } from './components/OutreachTable.jsx';
import Section from './components/Section.jsx';
import { SETTINGS } from './config/settings.js';
import { getMetrics, getOwners, getRecentReplies } from './utils/metrics.js';
import { FOLLOW_UP_GROUPS, groupFollowUps } from './utils/followUps.js';
import { getRecommendedAction } from './utils/actions.js';
import { getNextSteps } from './utils/nextSteps.js';
import { getPipelineData, getReasonBreakdown, getWeeklyOutreach } from './utils/charts.js';
import { startOfDay } from './utils/dates.js';

/** Ticks every 30s so "X min ago" stays fresh and "today" rolls over at midnight. */
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function App() {
  const {
    records, lastSynced, mode, loading, refreshing, error, notice, clearNotice,
    refresh, reload, markDone, addContact, editContact,
  } = useOutreach();
  // Add / edit form: null = closed, { record: null } = add, { record } = edit.
  const [form, setForm] = useState(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const openAdd = () => setForm({ record: null });
  const openEdit = (record) => setForm({ record });
  const saveForm = (data) => (form?.record ? editContact(form.record.id, data) : addContact(data));

  // Hide the "saved" / "couldn't save" message after a few seconds.
  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(clearNotice, notice.tone === 'error' ? 8000 : 4000);
    return () => clearTimeout(id);
  }, [notice, clearNotice]);
  const now = useNow();
  const dayKey = now.toDateString();
  const today = useMemo(() => startOfDay(new Date(dayKey)), [dayKey]);

  const [followUpTab, setFollowUpTab] = useState('overdue');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilters, setTableFilters] = useState(DEFAULT_TABLE_FILTERS);

  // Everything below is derived from the raw records.
  const metrics = useMemo(() => getMetrics(records, today), [records, today]);
  const followUps = useMemo(() => groupFollowUps(records, today), [records, today]);
  const nextSteps = useMemo(() => getNextSteps(records, today), [records, today]);
  const replies = useMemo(() => getRecentReplies(records), [records]);
  const pipeline = useMemo(() => getPipelineData(records), [records]);
  const weekly = useMemo(() => getWeeklyOutreach(records, today), [records, today]);
  const reasons = useMemo(() => getReasonBreakdown(records), [records]);
  const owners = useMemo(() => getOwners(records), [records]);

  // A section shows the error state only when the first load failed (no data to show).
  const sectionError = Boolean(error) && records.length === 0;

  const handleNextStep = (step) => {
    setActionFilter(step.actionFilter ?? 'all');
    if (step.tab) setFollowUpTab(step.tab);
    else if (step.actionFilter) {
      // Open the earliest tab that has this kind of follow-up.
      const tab = FOLLOW_UP_GROUPS.find((g) =>
        followUps[g].some((i) => getRecommendedAction(i.record).type === step.actionFilter)
      );
      if (tab) setFollowUpTab(tab);
    }
    if (step.tableFilter) setTableFilters({ ...DEFAULT_TABLE_FILTERS, ...step.tableFilter });
    const el = document.getElementById(step.target);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      el.focus({ preventScroll: true });
    }
  };

  const shared = { loading, error: sectionError, onRetry: refresh };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Header
          lastSynced={lastSynced}
          now={now}
          mode={mode}
          onRefresh={refresh}
          onAdd={openAdd}
          onConnect={() => setConnectOpen(true)}
          refreshing={refreshing}
          loading={loading}
        />

        <main id="main" className="mt-8 space-y-6 sm:space-y-8">
          {mode === 'demo' && !loading && (
            <div className="flex flex-col gap-3 rounded-xl bg-indigo-50 p-4 text-indigo-900 ring-1 ring-indigo-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <p className="text-base">
                  You’re looking at <strong>demo data</strong>. Connect your Google Sheet to see real outreach,
                  updated automatically from Gmail. Changes you make now are not saved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="shrink-0 self-start rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-50 sm:self-auto"
              >
                Connect Google Sheet
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-xl bg-rose-50 p-4 text-rose-800 ring-1 ring-rose-200">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Couldn’t load the latest data.</p>
                <p className="text-sm">
                  {records.length > 0 ? 'You’re seeing the last data we had. ' : ''}Press Refresh to try again.
                </p>
              </div>
            </div>
          )}

          <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Contacts" value={metrics.totalContacts}
              subtext={`${metrics.totalInteractions} outreach interactions in total`} {...shared} />
            <StatCard icon={Mail} label="Emails sent" value={metrics.emailsSent}
              subtext={`${metrics.emailsThisWeek} sent this week`} {...shared} />
            <StatCard icon={Linkedin} label="LinkedIn outreach" value={metrics.linkedinOutreach}
              subtext={`${metrics.linkedinThisWeek} sent this week`} {...shared} />
            <StatCard icon={MessageCircleReply} label="Responses" value={metrics.responses} tone="green"
              subtext={`${metrics.responseRate}% of contacts reached replied`} {...shared} />
            <StatCard icon={Hourglass} label="Awaiting response" value={metrics.awaitingResponse} tone="gray"
              subtext="Contacted, no reply yet" {...shared} />
            <StatCard icon={AlarmClock} label="Overdue follow-ups" value={metrics.overdue} tone="red"
              subtext={metrics.dueToday > 0 ? `Plus ${metrics.dueToday} due today` : 'Nothing else due today'} {...shared} />
            <StatCard icon={CalendarClock} label={`Due in next ${SETTINGS.upcomingWindowDays} days`} value={metrics.dueNext7} tone="amber"
              subtext={`${metrics.dueLater} more scheduled later`} {...shared} />
          </section>

          <NextStepsPanel steps={nextSteps} onAction={handleNextStep} {...shared} />

          <FollowUpTabs
            groups={followUps}
            activeTab={followUpTab}
            onTabChange={setFollowUpTab}
            actionFilter={actionFilter}
            onActionFilterChange={setActionFilter}
            onMarkDone={markDone}
            onEdit={openEdit}
            {...shared}
          />

          <ResponsesList replies={replies} {...shared} />

          <Section id="charts" title="Pipeline and activity" description="The big picture at a glance.">
            <div className="grid gap-5 lg:grid-cols-2">
              <PipelineChart data={pipeline} {...shared} />
              <WeeklyChart data={weekly} {...shared} />
            </div>
            <ReasonBreakdown data={reasons} {...shared} />
          </Section>

          <OutreachTable
            records={records}
            owners={owners}
            filters={tableFilters}
            onFiltersChange={setTableFilters}
            onEdit={openEdit}
            {...shared}
          />
        </main>

        <footer className="mt-10 text-center text-sm text-slate-500">
          {mode === 'demo'
            ? 'Demo data only — names, companies and emails are made up.'
            : `Data from your Google Sheet. Gmail is checked automatically; this page refreshes every ${SETTINGS.autoRefreshMinutes} minutes.`}
        </footer>
      </div>

      <ContactForm
        open={Boolean(form)}
        record={form?.record ?? null}
        owners={owners}
        onClose={() => setForm(null)}
        onSave={saveForm}
      />
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} onChanged={reload} />

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-start gap-3 rounded-xl p-4 shadow-lg ring-1 sm:inset-x-auto sm:right-6 ${
            notice.tone === 'error' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-white text-slate-800 ring-slate-200'
          }`}
        >
          {notice.tone === 'error' ? (
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          )}
          <p className="flex-1 text-sm">{notice.text}</p>
          <button type="button" onClick={clearNotice} className="text-sm font-semibold underline-offset-2 hover:underline">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

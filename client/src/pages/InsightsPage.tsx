import { Cascade } from '../components/Cascade';
import { AnimatedMetric } from '../components/AnimatedMetric';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { Card, EmptyState, PageHeader } from '../components/ui';

type Insight = { recommendation: { title: string; detail: string; reason: string; action: string; destination: string; priority: string }; pattern: string; rhythm: string | null; signals: { todayFocus: number; dailyTarget: number; focusLast7Days: number; focusSessionsLast7Days: number; focusPrevious7Days: number } };

export function InsightsPage({ embedded = false }: { embedded?: boolean }) {
  const insight = useQuery({ queryKey: ['intelligence'], queryFn: () => api<Insight>('/intelligence') });
  return <Cascade className="stack">
    {!embedded && <PageHeader eyebrow="REFLECT / PERSONAL INTELLIGENCE" title="Insights" description="A clear reading of your activity, based only on records you have actually made." />}
    {insight.data ? <>
      <Card><div className="card-heading"><div><h2>One useful next step</h2><p>Why Atlas brought this to your attention.</p></div><Lightbulb size={18} /></div><div className="recommendation"><span className="status-pill">{insight.data.recommendation.priority} priority</span><h3>{insight.data.recommendation.title}</h3><p className="recommendation__detail">{insight.data.recommendation.detail}</p><p className="recommendation__reason">{insight.data.recommendation.reason}</p></div></Card>
      <Card><div className="card-heading"><div><h2>Recent pattern</h2><p>Focus activity over comparable periods.</p></div><TrendingUp size={18} /></div><p className="insight-copy">{insight.data.pattern}</p>{insight.data.rhythm && <p className="insight-copy insight-copy--muted">{insight.data.rhythm}</p>}<div className="stat-grid stat-grid--three"><div className="stat-card"><div className="stat-card__top">FOCUS TODAY</div><strong><AnimatedMetric value={insight.data.signals.todayFocus} suffix="m" /></strong><small>Daily intention {insight.data.signals.dailyTarget}m</small></div><div className="stat-card"><div className="stat-card__top">LAST 7 DAYS</div><strong>{insight.data.signals.focusLast7Days}m</strong><small>{insight.data.signals.focusSessionsLast7Days} sessions</small></div><div className="stat-card"><div className="stat-card__top">PREVIOUS 7 DAYS</div><strong>{insight.data.signals.focusPrevious7Days}m</strong><small>Comparison period</small></div></div></Card>
    </> : <Card><EmptyState title="Insights need a little history." detail="As you record tasks, focus sessions, learning and rituals, Atlas can identify patterns worth noticing." /></Card>}
  </Cascade>;
}
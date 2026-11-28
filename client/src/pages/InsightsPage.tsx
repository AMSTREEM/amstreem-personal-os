import { Cascade } from '../components/Cascade';
import { AnimatedMetric } from '../components/AnimatedMetric';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Lightbulb, TrendingUp, X } from 'lucide-react';
import { api, json } from '../lib/api';
import { Card, EmptyState, PageHeader } from '../components/ui';

type Insight = { recommendation: { title: string; detail: string; reason: string; action: string; destination: string; priority: string }; pattern: string; rhythm: string | null; signals: { todayFocus: number; dailyTarget: number; focusLast7Days: number; focusSessionsLast7Days: number; focusPrevious7Days: number } };
type AtlasInsight = { id: string; insight_type: string; title: string; summary: string; explanation: string; evidence: Record<string, unknown>; priority: 'low'|'normal'|'high'; created_at: string };
type AtlasNotification = { id: string; category: string; title: string; body: string; status: string; created_at: string; data: Record<string, unknown> };
type WeeklyReview = { week_start: string; review: { summary?: string; totals?: Record<string, number>; highlights?: Array<{metric:string;current:number;previous:number}> }; generated_at: string };

export function InsightsPage({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient();
  const insight = useQuery({ queryKey: ['intelligence'], queryFn: () => api<Insight>('/intelligence') });
  const atlasInsights = useQuery({ queryKey: ['atlas-insights'], queryFn: () => api<AtlasInsight[]>('/insights') });
  const notifications = useQuery({ queryKey: ['atlas-notifications'], queryFn: () => api<AtlasNotification[]>('/notifications') });
  const review = useQuery({ queryKey: ['atlas-weekly-review'], queryFn: () => api<WeeklyReview|null>('/weekly-review/latest') });
  const dismissInsight = useMutation({ mutationFn: (id:string) => api('/insights/'+id+'/dismiss', json('POST', {})), onSuccess: () => { void client.invalidateQueries({queryKey:['atlas-insights']}); } });
  const updateNotification = useMutation({ mutationFn: ({id,action}:{id:string;action:'read'|'dismiss'}) => api('/notifications/'+id+'/'+action, json('POST', {})), onSuccess: () => { void client.invalidateQueries({queryKey:['atlas-notifications']}); } });
  return <Cascade className="stack">
    {!embedded && <PageHeader eyebrow="REFLECT / PERSONAL INTELLIGENCE" title="Insights" description="A clear reading of your activity, based only on records you have actually made." />}
    {atlasInsights.data && atlasInsights.data.length > 0 && <Card>
      <div className="card-heading"><div><h2>Signals from your workspace</h2><p>Each suggestion includes the records and reasoning behind it.</p></div><Lightbulb size={18}/></div>
      <div className="stack">{atlasInsights.data.map(item=><article className="recommendation" key={item.id}>
        <div className="row-between"><span className="status-pill">{item.priority} priority</span><button type="button" className="icon-button" aria-label="Dismiss insight" onClick={()=>dismissInsight.mutate(item.id)}><X size={16}/></button></div>
        <h3>{item.title}</h3><p className="recommendation__detail">{item.summary}</p><details><summary>Why Atlas noticed this</summary><p className="recommendation__reason">{item.explanation}</p><pre className="insight-copy">{JSON.stringify(item.evidence,null,2)}</pre></details>
      </article>)}</div>
    </Card>}
    {(!atlasInsights.data || atlasInsights.data.length===0) && <Card><EmptyState title="No new signals yet." detail="Atlas will surface explainable suggestions as relevant activity accumulates. You can enable categories in Settings." /></Card>}
    <Card><div className="card-heading"><div><h2>Notifications</h2><p>In-app reminders and weekly review updates.</p></div><Bell size={18}/></div>
      {notifications.data?.length ? <div className="stack">{notifications.data.map(item=><article className="recommendation" key={item.id}>
        <div className="row-between"><span className="status-pill">{item.category.replace('_',' ')}</span><span className="muted">{new Date(item.created_at).toLocaleString()}</span></div>
        <h3>{item.title}</h3><p className="recommendation__detail">{item.body}</p>
        <div className="row-actions">{item.status==='delivered' && <button type="button" onClick={()=>updateNotification.mutate({id:item.id,action:'read'})}><Check size={14}/> Mark read</button>}<button type="button" onClick={()=>updateNotification.mutate({id:item.id,action:'dismiss'})}><X size={14}/> Dismiss</button></div>
      </article>)}</div> : <p className="insight-copy">No notifications waiting. Enable the categories you want in Settings.</p>}
    </Card>
    {review.data?.review && <Card><div className="card-heading"><div><h2>Latest weekly review</h2><p>Week beginning {review.data.week_start}</p></div><TrendingUp size={18}/></div><p className="insight-copy">{review.data.review.summary || 'Your weekly activity summary is ready.'}</p>{review.data.review.highlights && <div className="stat-grid stat-grid--three">{review.data.review.highlights.map(item=><div className="stat-card" key={item.metric}><div className="stat-card__top">{item.metric.replaceAll('_',' ')}</div><strong>{item.current}</strong><small>Previous week: {item.previous}</small></div>)}</div>}</Card>}
    {insight.data ? <>
      <Card><div className="card-heading"><div><h2>One useful next step</h2><p>Why Atlas brought this to your attention.</p></div><Lightbulb size={18} /></div><div className="recommendation"><span className="status-pill">{insight.data.recommendation.priority} priority</span><h3>{insight.data.recommendation.title}</h3><p className="recommendation__detail">{insight.data.recommendation.detail}</p><p className="recommendation__reason">{insight.data.recommendation.reason}</p></div></Card>
      <Card><div className="card-heading"><div><h2>Recent pattern</h2><p>Focus activity over comparable periods.</p></div><TrendingUp size={18} /></div><p className="insight-copy">{insight.data.pattern}</p>{insight.data.rhythm && <p className="insight-copy insight-copy--muted">{insight.data.rhythm}</p>}<div className="stat-grid stat-grid--three"><div className="stat-card"><div className="stat-card__top">FOCUS TODAY</div><strong><AnimatedMetric value={insight.data.signals.todayFocus} suffix="m" /></strong><small>Daily intention {insight.data.signals.dailyTarget}m</small></div><div className="stat-card"><div className="stat-card__top">LAST 7 DAYS</div><strong>{insight.data.signals.focusLast7Days}m</strong><small>{insight.data.signals.focusSessionsLast7Days} sessions</small></div><div className="stat-card"><div className="stat-card__top">PREVIOUS 7 DAYS</div><strong>{insight.data.signals.focusPrevious7Days}m</strong><small>Comparison period</small></div></div></Card>
    </> : <Card><EmptyState title="Insights need a little history." detail="As you record tasks, focus sessions, learning and rituals, Atlas can identify patterns worth noticing." /></Card>}
  </Cascade>;
}

import { Cascade } from '../components/Cascade';
import { AnimatedMetric } from '../components/AnimatedMetric';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Lightbulb, ThumbsDown, ThumbsUp, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, PageHeader } from '../components/ui';
import './insights.css';

type FeedbackSignal = 'helpful' | 'not_useful' | 'opened';
type Recommendation = {
  id: string;
  title: string;
  detail: string;
  reason: string;
  action: string;
  destination: string;
  priority: string;
  taskId?: number;
  habitId?: number;
  lessonId?: number;
  goalId?: number;
};
type Insight = {
  recommendation: Recommendation;
  pattern: string;
  rhythm: string | null;
  feedback: { helpful: number; notUseful: number; opened: number };
  signals: { todayFocus: number; dailyTarget: number; focusLast7Days: number; focusSessionsLast7Days: number; focusPrevious7Days: number };
};

function recommendationHref(recommendation: Recommendation) {
  switch (recommendation.destination) {
    case 'tasks': return recommendation.taskId ? '/actions?task=' + recommendation.taskId : '/actions';
    case 'habit': return '/habits';
    case 'focus': return '/focus';
    case 'learning': return recommendation.lessonId ? '/focus?lesson=' + recommendation.lessonId : '/focus';
    case 'goals': return '/goals';
    default: return '/growth';
  }
}

export function InsightsPage({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient();
  const insight = useQuery({ queryKey: ['intelligence'], queryFn: () => api<Insight>('/intelligence') });
  const feedback = useMutation({
    mutationFn: (signal: FeedbackSignal) => {
      const recommendationId = insight.data?.recommendation.id;
      if (!recommendationId) throw new Error('This recommendation is no longer available.');
      return api('/intelligence/feedback', json('POST', { recommendationId, signal }));
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ['intelligence'] })
  });
  const recommendation = insight.data?.recommendation;

  return <Cascade className="stack">
    {!embedded && <PageHeader eyebrow="REFLECT / PERSONAL INTELLIGENCE" title="Insights" description="A clear reading of your activity, based only on records you have actually made." />}
    {insight.isLoading ? <Card><p className="insight-loading">Finding a useful next step from your recent records…</p></Card> : insight.isError ? <Card><EmptyState title="Insights are temporarily unavailable." detail="Your workspace records are safe. Try again in a moment." /></Card> : insight.data ? <>
      <Card>
        <div className="card-heading"><div><h2>One useful next step</h2><p>Why Atlas brought this to your attention.</p></div><Lightbulb size={18} /></div>
        <div className="recommendation">
          <span className="status-pill">{recommendation!.priority} priority</span>
          <h3>{recommendation!.title}</h3>
          <p className="recommendation__detail">{recommendation!.detail}</p>
          <p className="recommendation__reason">{recommendation!.reason}</p>
          <Link className="button button--primary insight-recommendation__action" to={recommendationHref(recommendation!)} onClick={() => feedback.mutate('opened')}>
            {recommendation!.action} <ArrowRight size={15} />
          </Link>
          <div className="insight-feedback" role="group" aria-label="Rate this recommendation">
            <span className="insight-feedback__label">Was this useful?</span>
            <Button variant="ghost" size="sm" disabled={feedback.isPending} onClick={() => feedback.mutate('helpful')}><ThumbsUp size={14} /> Helpful</Button>
            <Button variant="ghost" size="sm" disabled={feedback.isPending} onClick={() => feedback.mutate('not_useful')}><ThumbsDown size={14} /> Not useful</Button>
          </div>
          {feedback.isSuccess && <p className="insight-feedback__thanks" role="status">Thanks. Atlas will use your feedback to make future suggestions more relevant.</p>}
          {feedback.isError && <p className="insight-feedback__error" role="alert">{feedback.error instanceof Error ? feedback.error.message : 'Feedback could not be saved.'}</p>}
        </div>
      </Card>
      <Card>
        <div className="card-heading"><div><h2>Recent pattern</h2><p>Focus activity over comparable periods.</p></div><TrendingUp size={18} /></div>
        <p className="insight-copy">{insight.data.pattern}</p>
        {insight.data.rhythm && <p className="insight-copy insight-copy--muted">{insight.data.rhythm}</p>}
        <div className="stat-grid stat-grid--three">
          <div className="stat-card"><div className="stat-card__top">FOCUS TODAY</div><strong><AnimatedMetric value={insight.data.signals.todayFocus} suffix="m" /></strong><small>Daily intention {insight.data.signals.dailyTarget}m</small></div>
          <div className="stat-card"><div className="stat-card__top">LAST 7 DAYS</div><strong>{insight.data.signals.focusLast7Days}m</strong><small>{insight.data.signals.focusSessionsLast7Days} sessions</small></div>
          <div className="stat-card"><div className="stat-card__top">PREVIOUS 7 DAYS</div><strong>{insight.data.signals.focusPrevious7Days}m</strong><small>Comparison period</small></div>
        </div>
      </Card>
    </> : <Card><EmptyState title="Insights need a little history." detail="As you record tasks, focus sessions, learning and rituals, Atlas can identify patterns worth noticing." /></Card>}
  </Cascade>;
}

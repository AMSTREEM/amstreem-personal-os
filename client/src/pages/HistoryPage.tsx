import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Clock3, Database, History as HistoryIcon, RefreshCw, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { api, json } from '../lib/api';
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui';

type HistoryPoint = {
  id: number;
  version: number;
  schema_version: number;
  reason: 'scheduled' | 'pre_import' | 'pre_restore' | 'pre_migration' | 'manual';
  created_at: string;
};
type HistoryResponse = { items: HistoryPoint[]; currentVersion: number };
type HistoryActionResponse = { version: number; message: string };

const reasonLabels: Record<HistoryPoint['reason'], string> = {
  scheduled: 'Automatic checkpoint',
  pre_import: 'Before backup import',
  pre_restore: 'Before restore',
  pre_migration: 'Before migration',
  manual: 'Manual snapshot'
};

function formatHistoryDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function HistoryPage() {
  const client = useQueryClient();
  const history = useQuery({
    queryKey: ['workspace-history'],
    queryFn: () => api<HistoryResponse>('/history'),
    staleTime: 15_000
  });
  const snapshot = useMutation({
    mutationFn: () => api<HistoryActionResponse>('/history/snapshot', json('POST', {})),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['workspace-history'] }); }
  });
  const restore = useMutation({
    mutationFn: (id: number) => api<HistoryActionResponse>(`/history/${id}/restore`, json('POST', {})),
    onSuccess: async () => {
      await client.invalidateQueries();
      await client.refetchQueries({ type: 'active' });
    }
  });

  function restorePoint(point: HistoryPoint) {
    const confirmed = window.confirm(
      `Restore workspace version ${point.version} from ${formatHistoryDate(point.created_at)}? Your current workspace will first be saved as a recovery point. This replaces the current workspace data.`
    );
    if (confirmed) restore.mutate(point.id);
  }

  return <div className="stack history-page">
    <PageHeader
      eyebrow="OWNERSHIP / RECOVERY"
      title="Workspace history"
      description="Create safe points, review previous versions and restore your workspace without losing the version you have now."
      action={<Button variant="secondary" onClick={() => void history.refetch()} disabled={history.isFetching}><RefreshCw size={15}/> Refresh</Button>}
    />

    <div className="history-overview-grid">
      <Card className="history-overview-card">
        <span className="history-overview-icon"><Database size={17}/></span>
        <span className="history-overview-label">Current version</span>
        <strong>{history.data?.currentVersion ?? '—'}</strong>
        <small>Latest committed workspace</small>
      </Card>
      <Card className="history-overview-card">
        <span className="history-overview-icon"><HistoryIcon size={17}/></span>
        <span className="history-overview-label">Recovery points</span>
        <strong>{history.data?.items.length ?? '—'}</strong>
        <small>Up to 30 scheduled points, plus protected operations</small>
      </Card>
      <Card className="history-overview-card">
        <span className="history-overview-icon"><ShieldCheck size={17}/></span>
        <span className="history-overview-label">Restore protection</span>
        <strong>On</strong>
        <small>Your current workspace is saved before every restore</small>
      </Card>
    </div>

    <Card className="history-create-card">
      <div className="history-create-copy">
        <span className="eyebrow">BEFORE A BIG CHANGE</span>
        <h2>Create a recovery point</h2>
        <p>Save the current state of your workspace now. It will appear in this history list and can be restored later.</p>
      </div>
      <Button onClick={() => snapshot.mutate()} loading={snapshot.isPending}><Archive size={16}/> Create snapshot</Button>
    </Card>

    {(snapshot.error || restore.error || history.error) && <div className="form-message" role="alert">
      {snapshot.error instanceof Error ? snapshot.error.message : restore.error instanceof Error ? restore.error.message : history.error instanceof Error ? history.error.message : 'Something went wrong.'}
    </div>}
    {snapshot.isSuccess && <div className="form-message" role="status">Recovery point created successfully.</div>}
    {restore.isSuccess && <div className="form-message" role="status">{restore.data.message}</div>}

    <Card className="history-list-card">
      <div className="card-heading">
        <div><h2>Recovery timeline</h2><p>Only your account's history is visible here.</p></div>
        <Badge tone="success">Private</Badge>
      </div>
      {history.isLoading ? <div className="history-loading"><span className="button__spinner"/> Loading recovery points…</div>
      : history.data?.items.length ? <div className="history-list">
        {history.data.items.map(point => <article className="history-row" key={point.id}>
          <div className="history-row__marker"><Clock3 size={16}/></div>
          <div className="history-row__main">
            <div className="history-row__title"><strong>{reasonLabels[point.reason] || 'Recovery point'}</strong><Badge>Version {point.version}</Badge></div>
            <p>{formatHistoryDate(point.created_at)} <span>·</span> Schema v{point.schema_version}</p>
          </div>
          <Button variant="secondary" size="sm" disabled={restore.isPending} loading={restore.isPending && restore.variables === point.id} onClick={() => restorePoint(point)}><RotateCcw size={14}/> Restore</Button>
        </article>)}
      </div> : <EmptyState title="No recovery points yet" detail="Create your first snapshot above. Atlas will also create automatic checkpoints as you work and before imports or restores."/>}
    </Card>

    <div className="history-footnote"><Sparkles size={15}/><span>Restoring creates a new workspace version. It never deletes the recovery point you selected, and your current state is saved first.</span></div>
  </div>;
}

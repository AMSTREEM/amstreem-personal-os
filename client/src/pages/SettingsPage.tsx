import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, Field, PageHeader, TextInput } from '../components/ui';

type Settings = Record<string, string>;
export function SettingsPage() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const [name, setName] = useState('');
  const [northStar, setNorthStar] = useState('');
  const [target, setTarget] = useState('80');
  const [theme, setTheme] = useState('shadowed-alchemist');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (settings.data) {
      setName(settings.data.display_name || '');
      setNorthStar(settings.data.north_star || '');
      setTarget(settings.data.daily_target || '80');
      setTheme(settings.data.theme || 'shadowed-alchemist');
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () => api('/settings', json('PATCH', { display_name: name, north_star: northStar, daily_target: Number(target), theme })),
    onSuccess: () => { setMessage('Your preferences have been saved.'); void client.invalidateQueries({ queryKey: ['settings'] }); }
  });
  async function exportData() {
    try {
      const backup = await api<Record<string, unknown>>('/export');
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'amstreem-atlas-backup.json'; link.click();
      URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed.'); }
  }
  async function importData(file?: File) {
    if (!file) return;
    if (!window.confirm('Importing a backup replaces the workspace records represented in that file. Continue only if this is the backup you intend to restore.')) return;
    try {
      const backup = JSON.parse(await file.text());
      await api('/import', json('POST', backup));
      setMessage('Backup imported successfully.');
      await client.invalidateQueries();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.'); }
  }
  return <div className="stack">
    <PageHeader eyebrow="PREFERENCES / OWNERSHIP" title="Settings" description="Shape your workspace and keep control of your data." />
    <Card><div className="card-heading"><div><h2>Personal preferences</h2><p>These settings apply to your private workspace.</p></div></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
        <Field label="Display name"><TextInput value={name} onChange={event => setName(event.target.value)} placeholder="How Atlas should address you" /></Field>
        <Field label="North star"><TextInput value={northStar} onChange={event => setNorthStar(event.target.value)} placeholder="What are you orienting your effort around?" /></Field>
        <Field label="Daily focus intention (minutes)"><TextInput type="number" min="10" max="600" value={target} onChange={event => setTarget(event.target.value)} /></Field>
        <Field label="Appearance"><select className="field-input" value={theme} onChange={event => { setTheme(event.target.value); document.documentElement.dataset.theme = event.target.value; }}><optgroup label="Dark"><option value="shadowed-alchemist">Shadowed Alchemist</option><option value="nocturnal-amethyst">Nocturnal Amethyst</option><option value="abyssal-trench">Abyssal Trench</option><option value="whispering-woods">Whispering Woods</option><option value="crimson-velvet">Crimson Velvet</option></optgroup><optgroup label="Light"><option value="light-porcelain">Light Porcelain</option><option value="light-sandstone">Light Sandstone</option><option value="light-sage">Light Sage</option><option value="light-lavender">Light Lavender</option><option value="light-sky">Light Sky</option></optgroup></select></Field>
        <div><Button type="submit" disabled={save.isPending}>Save preferences</Button></div>
      </form>
      {message && <p className="form-message" role="status">{message}</p>}
    </Card>
    <Card><div className="card-heading"><div><h2>Your data belongs to you.</h2><p>Download a backup or restore one you already have.</p></div></div><div className="data-actions"><Button variant="secondary" onClick={() => void exportData()}><Download size={16} /> Export backup</Button><label className="button button--secondary file-button"><Upload size={16} /> Import backup<input type="file" accept="application/json,.json" hidden onChange={event => void importData(event.target.files?.[0])} /></label></div><p className="field__hint">Import replaces the workspace records represented in the backup. Only restore a file you trust.</p></Card>
  </div>;
}
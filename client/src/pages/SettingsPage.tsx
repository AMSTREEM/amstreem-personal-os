import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, Field, PageHeader, TextInput } from '../components/ui';

type Settings = Record<string, string>;
const themes = [
  { group: 'Dark', items: [
    { id: 'shadowed-alchemist', name: 'Shadowed Alchemist', note: 'Mysterious balanced', colors: ['#07080A','#0E1014','#CA8A04','#E4E4E7'] },
    { id: 'nocturnal-amethyst', name: 'Nocturnal Amethyst', note: 'Mysterious all-purple', colors: ['#050408','#0C0914','#C084FC','#EAE6F5'] },
    { id: 'abyssal-trench', name: 'Abyssal Trench', note: 'Mysterious all-blue', colors: ['#03060C','#080E1A','#38BDF8','#E2E8F0'] },
    { id: 'whispering-woods', name: 'Whispering Woods', note: 'Mysterious all-green', colors: ['#030806','#08120E','#6EE7B7','#E2F1EC'] },
    { id: 'crimson-velvet', name: 'Crimson Velvet', note: 'Dark red and rose', colors: ['#080304','#120709','#FB7185','#F5E6E8'] }
  ]},
  { group: 'Light', items: [
    { id: 'light-porcelain', name: 'Porcelain', note: 'Clean neutral', colors: ['#F5F6F3','#FFFFFF','#527A62','#202720'] },
    { id: 'light-sandstone', name: 'Sandstone', note: 'Warm and grounded', colors: ['#F6F0E7','#FFFCF7','#9A7046','#30271F'] },
    { id: 'light-sage', name: 'Sage', note: 'Soft green', colors: ['#EFF4EF','#FBFEFB','#43836B','#203128'] },
    { id: 'light-lavender', name: 'Lavender Mist', note: 'Muted violet', colors: ['#F4F1F8','#FFFDFF','#8062A6','#2B2535'] },
    { id: 'light-sky', name: 'Sky Glass', note: 'Cool blue', colors: ['#EFF5F9','#FFFFFF','#477DA5','#202D39'] }
  ]}
];
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
        <Field label="Appearance">
          <div className="theme-picker-groups">
            {themes.map(group => <section className="theme-picker-group" key={group.group}>
              <div className="theme-picker-group__heading">{group.group} palettes <small>{group.items.length} styles</small></div>
              <div className="theme-picker-grid">
                {group.items.map(item => <button key={item.id} type="button" className="theme-preset" aria-pressed={theme === item.id} onClick={() => { setTheme(item.id); document.documentElement.dataset.theme = item.id; }}>
                  <span className="theme-preset__swatches" aria-hidden="true">{item.colors.map((color, index) => <i key={index} style={{ background: color }} />)}</span>
                  <span className="theme-preset__copy"><b>{item.name}</b><small>{item.note}</small></span>
                  <span className="theme-preset__check">{theme === item.id ? '✓' : ''}</span>
                </button>)}
              </div>
            </section>)}
          </div>
        </Field>
        <div><Button type="submit" disabled={save.isPending}>Save preferences</Button></div>
      </form>
      {message && <p className="form-message" role="status">{message}</p>}
    </Card>
    <Card><div className="card-heading"><div><h2>Your data belongs to you.</h2><p>Download a backup or restore one you already have.</p></div></div><div className="data-actions"><Button variant="secondary" onClick={() => void exportData()}><Download size={16} /> Export backup</Button><label className="button button--secondary file-button"><Upload size={16} /> Import backup<input type="file" accept="application/json,.json" hidden onChange={event => void importData(event.target.files?.[0])} /></label></div><p className="field__hint">Import replaces the workspace records represented in the backup. Only restore a file you trust.</p></Card>
  </div>;
}
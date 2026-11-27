import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, Upload } from 'lucide-react';
import { primeAtlasAudio } from '../lib/microFeedback';
import { applyAtlasTheme, type AtlasTheme } from '../design/theme';
import { api, json } from '../lib/api';
import { Button, Card, Field, PageHeader, TextInput } from '../components/ui';

type Settings = Record<string, string>;
const lifeAreaOptions = [
  { id: 'health', name: 'Health & Fitness', desc: 'Training, nutrition and wellbeing', icon: '◈' },
  { id: 'education', name: 'Education & Learning', desc: 'Studying, reading and new skills', icon: '⌁' },
  { id: 'career', name: 'Career & Business', desc: 'Work, business and professional growth', icon: '↗' },
  { id: 'finance', name: 'Financial Growth', desc: 'Budgeting, saving and financial goals', icon: '◇' },
  { id: 'faith', name: 'Faith & Spirituality', desc: 'Faith, worship and spiritual development', icon: '✧' },
  { id: 'personal', name: 'Personal Development', desc: 'Discipline, mindset and self-improvement', icon: '◎' },
  { id: 'relationships', name: 'Relationships', desc: 'Family, friends and social connections', icon: '♡' },
  { id: 'lifestyle', name: 'Lifestyle & Organisation', desc: 'Routines, time and daily life', icon: '⌂' }
];
const defaultLifeAreas = lifeAreaOptions.map(area => area.id);
const themes = [
  { group: 'Dark', items: [
    { id: 'obsidian', name: 'Obsidian', note: 'Quiet, precise, minimal', colors: ['#111318','#1B1E25','#D6BD83','#F1F0EC'] },
    { id: 'dusk', name: 'Dusk', note: 'Deep violet atmosphere', colors: ['#171426','#242039','#B9A6E8','#F1EDF9'] }
  ]},
  { group: 'Light', items: [
    { id: 'ivory', name: 'Ivory', note: 'Bright, calm, editorial', colors: ['#F7F6F1','#FFFFFF','#8B7752','#242620'] },
    { id: 'sahara', name: 'Sahara', note: 'Warm, natural, grounded', colors: ['#F3EBDD','#FCF8EF','#A77B4B','#30271F'] }
  ]}
];
export function SettingsPage() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const [name, setName] = useState('');
  const [northStar, setNorthStar] = useState('');
  const [target, setTarget] = useState('80');
  const [theme, setTheme] = useState<AtlasTheme>('obsidian');
  const [features, setFeatures] = useState<string[]>(['calendar','focus','rituals','selfcontrol','learning','library','deen']);
  const [selectedLifeAreas, setSelectedLifeAreas] = useState<string[]>(defaultLifeAreas);
  const [soundFeedback, setSoundFeedback] = useState(() => { try { return localStorage.getItem('atlas-sound-feedback') === 'on'; } catch { return false; } });
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (settings.data) {
      setName(settings.data.display_name || '');
      setNorthStar(settings.data.north_star || '');
      setTarget(settings.data.daily_target || '80');
      const savedTheme = settings.data.theme || 'obsidian';
      const legacyThemeMap: Record<string, AtlasTheme> = {
        'shadowed-alchemist': 'obsidian', 'abyssal-trench': 'obsidian', 'whispering-woods': 'obsidian',
        'nocturnal-amethyst': 'dusk', 'crimson-velvet': 'dusk',
        'light-porcelain': 'ivory', 'light-sage': 'ivory', 'light-lavender': 'ivory',
        'light-sky': 'ivory', 'light-sandstone': 'sahara'
      };
      const resolvedTheme: AtlasTheme = ['obsidian','dusk','ivory','sahara'].includes(savedTheme)
        ? savedTheme as AtlasTheme
        : legacyThemeMap[savedTheme] || 'obsidian';
      setTheme(resolvedTheme);
      applyAtlasTheme(resolvedTheme);
      try { setFeatures(settings.data.features ? JSON.parse(settings.data.features).map((feature: string) => feature === 'values' ? 'deen' : feature) : ['calendar','focus','rituals','selfcontrol','learning','library','deen']); } catch { setFeatures(['calendar','focus','rituals','selfcontrol','learning','library','deen']); }
      try { const saved = settings.data.life_areas ? JSON.parse(settings.data.life_areas) : defaultLifeAreas; setSelectedLifeAreas(Array.isArray(saved) ? saved.filter((id: string) => lifeAreaOptions.some(area => area.id === id)) : defaultLifeAreas); } catch { setSelectedLifeAreas(defaultLifeAreas); }
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () => { applyAtlasTheme(theme); return api('/settings', json('PATCH', { display_name: name, north_star: northStar, daily_target: Number(target), theme, features, life_areas: selectedLifeAreas })); },
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
      const preview = await api<{ imported: number; summary: Record<string, number> }>('/import/preview', json('POST', backup));
      const summary = Object.entries(preview.summary).filter(([, count]) => count > 0).map(([table, count]) => `${table}: ${count}`).join('\\n');
      const confirmed = window.confirm(`Backup validated. ${preview.imported} records will be restored:\\n\\n${summary || 'No records'}\\n\\nThis replaces the corresponding workspace records. Continue?`);
      if (!confirmed) return;
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
        <Field label="Your life areas"><p className="field__hint">Choose the parts of life you want Atlas to help you improve. Your selection can change whenever your priorities do.</p><div className="settings-module-grid">{lifeAreaOptions.map(area => <label className="settings-module-choice" key={area.id}><input type="checkbox" checked={selectedLifeAreas.includes(area.id)} onChange={event => setSelectedLifeAreas(current => event.target.checked ? [...current, area.id] : current.filter(id => id !== area.id))} /><span><b>{area.name}</b><small>{area.desc}</small></span></label>)}</div><p className="field__hint">{selectedLifeAreas.length} of {lifeAreaOptions.length} areas selected. Select at least one area.</p></Field>
        <Field label="Daily focus intention (minutes)"><TextInput type="number" min="10" max="600" value={target} onChange={event => setTarget(event.target.value)} /></Field>
        <Field label="Optional workspace views"><p className="field__hint">Your six core pillars always stay available. Turn secondary views on or off as your workspace needs change.</p><div className="settings-module-grid">{[{id:'calendar',name:'Calendar',desc:'A calendar view inside Projects & Tasks.'},{id:'library',name:'Personal Library',desc:'A library tab inside Learning Studio.'}].map(module => <label className="settings-module-choice" key={module.id}><input type="checkbox" checked={features.includes(module.id)} onChange={event => setFeatures(current => event.target.checked ? [...current,module.id] : current.filter(id => id !== module.id))} /><span><b>{module.name}</b><small>{module.desc}</small></span></label>)}</div></Field>
        <Field label="Micro-feedback"><label className="settings-module-choice"><input type="checkbox" checked={soundFeedback} onChange={event => { const enabled = event.target.checked; setSoundFeedback(enabled); try { localStorage.setItem('atlas-sound-feedback', enabled ? 'on' : 'off'); } catch { /* Optional audio. */ } if (enabled) primeAtlasAudio(); }} /><span><b>Subtle sound cues</b><small>Quiet 15ms ticks for task and prayer check-offs, plus a soft Focus completion chime. Off by default.</small></span></label></Field>
        <Field label="Appearance">
          <div className="theme-picker-groups">
            {themes.map(group => <section className="theme-picker-group" key={group.group}>
              <div className="theme-picker-group__heading">{group.group} palettes <small>{group.items.length} styles</small></div>
              <div className="theme-picker-grid">
                {group.items.map(item => <button key={item.id} type="button" className="theme-preset" aria-pressed={theme === item.id} onClick={() => { setTheme(item.id as AtlasTheme); applyAtlasTheme(item.id as AtlasTheme); }}>
                  <span className="theme-preset__swatches" aria-hidden="true">{item.colors.map((color, index) => <i key={index} style={{ background: color }} />)}</span>
                  <span className="theme-preset__copy"><b>{item.name}</b><small>{item.note}</small></span>
                  <span className="theme-preset__check">{theme === item.id ? <Check size={14} strokeWidth={2.4}/> : null}</span>
                </button>)}
              </div>
            </section>)}
          </div>
        </Field>
        <div><Button type="submit" disabled={save.isPending || selectedLifeAreas.length === 0}>Save preferences</Button></div>
      </form>
      {message && <p className="form-message" role="status">{message}</p>}
    </Card>
    <Card><div className="card-heading"><div><h2>Your data belongs to you.</h2><p>Download a backup or restore one you already have.</p></div></div><div className="data-actions"><Button variant="secondary" onClick={() => void exportData()}><Download size={16} /> Export backup</Button><label className="button button--secondary file-button"><Upload size={16} /> Import backup<input type="file" accept="application/json,.json" hidden onChange={event => void importData(event.target.files?.[0])} /></label></div><p className="field__hint">Import replaces the workspace records represented in the backup. Only restore a file you trust.</p></Card>
  </div>;
}
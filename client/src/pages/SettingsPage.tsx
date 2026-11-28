import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, Upload } from 'lucide-react';
import { primeAtlasAudio } from '../lib/microFeedback';
import { api, json } from '../lib/api';
import { applyAtlasContrast, applyAtlasMotionPreference, applyAtlasTheme, type AtlasMotionPreference } from '../design/theme';
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
const xpModuleOptions = [
  { id: 'actions', name: 'Actions', desc: 'Tasks and focus sessions.' },
  { id: 'habits', name: 'Habits', desc: 'Habit check-ins.' },
  { id: 'learning', name: 'Learning', desc: 'Completed learning items.' },
  { id: 'growth', name: 'Growth', desc: 'Submitted reviews.' },
  { id: 'residence', name: 'Residence', desc: 'Weekly challenge completion.' }
];
const defaultXpModules = xpModuleOptions.map(module => module.id);
const themes = [
  { group: 'System', items: [
    { id: 'system', name: 'System', note: 'Follow your device appearance', colors: ['#0A0E13','#F6F4EF','#22D3EE','#EAF0F6'] }
  ]},
  { group: 'Dark', items: [
    { id: 'shadowed-alchemist', name: 'Shadowed Alchemist', note: 'Mysterious balanced', colors: ['#0A0E13','#10161D','#22D3EE','#EAF0F6'] },
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
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos');
  const [theme, setTheme] = useState('shadowed-alchemist');
  const [communicationStyle, setCommunicationStyle] = useState('adaptive');
  const [features, setFeatures] = useState<string[]>(['calendar','focus','rituals','selfcontrol','learning','library','deen']);
  const [selectedLifeAreas, setSelectedLifeAreas] = useState<string[]>(defaultLifeAreas);
  const [xpEnabledModules, setXpEnabledModules] = useState<string[]>(defaultXpModules);
  const [soundFeedback, setSoundFeedback] = useState(() => { try { return localStorage.getItem('atlas-sound-feedback') === 'on'; } catch { return false; } });
  const [highContrast, setHighContrast] = useState(() => { try { return localStorage.getItem('atlas-high-contrast') === 'on'; } catch { return false; } });
  const [motionPreference, setMotionPreference] = useState<AtlasMotionPreference>(() => { try { const value = localStorage.getItem('atlas-motion-preference'); return value === 'reduced' || value === 'full' ? value : 'system'; } catch { return 'system'; } });
  useEffect(() => { applyAtlasContrast(highContrast); }, [highContrast]);
  useEffect(() => { applyAtlasMotionPreference(motionPreference); }, [motionPreference]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (settings.data) {
      setName(settings.data.display_name || '');
      setNorthStar(settings.data.north_star || '');
      setTarget(settings.data.daily_target || '80');
      setTimezone(settings.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos');
      setTheme(settings.data.theme || 'shadowed-alchemist');
      setCommunicationStyle(settings.data.communication_style || 'adaptive');
      applyAtlasTheme(settings.data.theme || 'shadowed-alchemist');
      try { setFeatures(settings.data.features ? JSON.parse(settings.data.features).map((feature: string) => feature === 'values' ? 'deen' : feature) : ['calendar','focus','rituals','selfcontrol','learning','library','deen']); } catch { setFeatures(['calendar','focus','rituals','selfcontrol','learning','library','deen']); }
      try { const saved = settings.data.life_areas ? JSON.parse(settings.data.life_areas) : defaultLifeAreas; setSelectedLifeAreas(Array.isArray(saved) ? saved.filter((id: string) => lifeAreaOptions.some(area => area.id === id)) : defaultLifeAreas); } catch { setSelectedLifeAreas(defaultLifeAreas); }
      try { const saved = settings.data.xp_enabled_modules ? JSON.parse(settings.data.xp_enabled_modules) : defaultXpModules; setXpEnabledModules(Array.isArray(saved) ? saved.filter((id: string) => xpModuleOptions.some(module => module.id === id)) : defaultXpModules); } catch { setXpEnabledModules(defaultXpModules); }
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () => { applyAtlasTheme(theme); return api('/settings', json('PATCH', { display_name: name, north_star: northStar, daily_target: Number(target), timezone, theme, features, life_areas: selectedLifeAreas, communication_style: communicationStyle, xp_enabled_modules: xpEnabledModules })); },
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
        <Field label="Your life areas"><p className="field__hint">Choose the parts of life you want Atlas to help you improve. Your selection can change whenever your priorities do.</p><div className="settings-module-grid">{lifeAreaOptions.map(area => <label className="settings-module-choice" key={area.id}><input type="checkbox" checked={selectedLifeAreas.includes(area.id)} onChange={event => setSelectedLifeAreas(current => event.target.checked ? [...current, area.id] : current.filter(id => id !== area.id))} /><span><b>{area.name}</b><small>{area.desc}</small></span></label>)}</div><p className="field__hint">{selectedLifeAreas.length} of {lifeAreaOptions.length} areas selected. Select at least one area.</p></Field>
        <Field label="How Atlas communicates">
          <p className="field__hint">Atlas can combine three roles and shift emphasis with the situation. Your preference guides its tone; it does not grant permission to take actions.</p>
          <div className="settings-module-grid">
            {[
              { id: 'adaptive', name: 'Adaptive combination', desc: 'A composed, capable assistant; approachable when you need support; analytical and candid when decisions need scrutiny.' },
              { id: 'jarvis', name: 'Personal Jarvis', desc: 'Composed, precise, proactive and focused on getting things done.' },
              { id: 'companion', name: 'Personal companion', desc: 'Warm, conversational, patient and supportive.' },
              { id: 'advisor', name: 'Strategic advisor', desc: 'Insightful, evidence-led, direct and willing to challenge assumptions.' }
            ].map(option => <label className="settings-module-choice" key={option.id}>
              <input type="radio" name="communication-style" value={option.id} checked={communicationStyle === option.id} onChange={() => setCommunicationStyle(option.id)} />
              <span><b>{option.name}</b><small>{option.desc}</small></span>
            </label>)}
          </div>
          {communicationStyle === 'adaptive' && <p className="field__hint">Adaptive combination is selected: Atlas should read the context instead of repeating a fixed script.</p>}
        </Field>
        <Field label="Daily focus intention (minutes)"><TextInput type="number" min="10" max="600" value={target} onChange={event => setTarget(event.target.value)} /></Field>
        <Field label="Time zone"><p className="field__hint">Atlas uses this IANA time zone to decide when your day begins and ends.</p><TextInput value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="Africa/Lagos" /></Field>
        <Field label="Progress & XP">
          <p className="field__hint">XP is optional. Turn it off for any module without disabling progress, achievements or your underlying records.</p>
          <div className="settings-module-grid">
            {xpModuleOptions.map(module => <label className="settings-module-choice" key={module.id}>
              <input type="checkbox" checked={xpEnabledModules.includes(module.id)} onChange={event => setXpEnabledModules(current => event.target.checked ? [...current, module.id] : current.filter(id => id !== module.id))} />
              <span><b>{module.name}</b><small>{module.desc}</small></span>
            </label>)}
          </div>
        </Field>
        <Field label="Optional workspace views"><p className="field__hint">Your six core pillars always stay available. Turn secondary views on or off as your workspace needs change.</p><div className="settings-module-grid">{[{id:'calendar',name:'Calendar',desc:'A calendar view inside Projects & Tasks.'},{id:'library',name:'Personal Library',desc:'A library tab inside Learning Studio.'}].map(module => <label className="settings-module-choice" key={module.id}><input type="checkbox" checked={features.includes(module.id)} onChange={event => setFeatures(current => event.target.checked ? [...current,module.id] : current.filter(id => id !== module.id))} /><span><b>{module.name}</b><small>{module.desc}</small></span></label>)}</div></Field>
        <Field label="Micro-feedback"><label className="settings-module-choice"><input type="checkbox" checked={soundFeedback} onChange={event => { const enabled = event.target.checked; setSoundFeedback(enabled); try { localStorage.setItem('atlas-sound-feedback', enabled ? 'on' : 'off'); } catch { /* Optional audio. */ } if (enabled) primeAtlasAudio(); }} /><span><b>Subtle sound cues</b><small>Quiet 15ms ticks for task and prayer check-offs, plus a soft Focus completion chime. Off by default.</small></span></label></Field>
        <Field label="Accessibility"><label className="settings-module-choice"><input type="checkbox" checked={highContrast} onChange={event => setHighContrast(event.target.checked)} /><span><b>High-contrast interface</b><small>Strengthen borders and secondary text for easier reading on every Atlas screen.</small></span></label></Field>
        <Field label="Motion">
          <label className="settings-module-choice">
            <span><b>Interface motion</b><small>Choose whether Atlas follows your device or reduces animation. This preference stays on this device.</small></span>
            <select className="field-input" aria-label="Interface motion preference" value={motionPreference} onChange={event => setMotionPreference(event.target.value as AtlasMotionPreference)}>
              <option value="system">System</option>
              <option value="reduced">Reduced</option>
              <option value="full">Full</option>
            </select>
          </label>
        </Field>
        <Field label="Appearance">
          <div className="theme-picker-groups">
            {themes.map(group => <section className="theme-picker-group" key={group.group}>
              <div className="theme-picker-group__heading">{group.group} palettes <small>{group.items.length} styles</small></div>
              <div className="theme-picker-grid">
                {group.items.map(item => <button key={item.id} type="button" className="theme-preset" aria-pressed={theme === item.id} onClick={() => { setTheme(item.id); applyAtlasTheme(item.id); }}>
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
import { useState } from 'react';
import { Download, FileJson, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

const exportTables = [
  'memories',
  'memory_revisions',
  'memory_links',
  'life_items',
  'habits',
  'habit_entries',
  'time_blocks',
  'routine_templates',
] as const;

type ExportTable = typeof exportTables[number];

export default function PrivacySettings({ userId, email }: { userId: string; email?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const exportAllData = async () => {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('Preparing your account export…');
    try {
      const tables: Record<string, unknown[]> = {};
      for (const table of exportTables) {
        let offset = 0;
        const rows: unknown[] = [];
        while (true) {
          const { data, error } = await supabase.from(table as ExportTable).select('*').range(offset, offset + 999);
          if (error) throw new Error('Could not export ' + table.replace(/_/g, ' ') + '. No partial file was downloaded.');
          const page = data || [];
          rows.push(...page);
          if (page.length < 1000) break;
          offset += 1000;
        }
        tables[table] = rows;
      }

      let localCaptures: unknown[] = [];
      try {
        const saved = window.localStorage.getItem('amstreem.captures.v1');
        const parsed: unknown = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) localCaptures = parsed;
      } catch {
        setMessage('Your cloud data was exported, but local captures could not be read. Please check the browser storage separately.');
      }

      const payload = {
        format: 'amstreem-account-export',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        account: { userId, email: email || null },
        note: 'Exported through your signed-in account. Cloud rows are limited by your account access policies.',
        cloudData: tables,
        browserLocalCaptures: localCaptures,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'amstreem-account-export-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMessage('Your account export is ready. Keep the file somewhere private.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The export could not be completed. Your data has not been changed.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="privacy-settings">
    <div className="privacy-intro">
      <span className="kicker"><ShieldCheck size={12}/> CONTROL YOUR SPACE</span>
      <h2>Your data. <em>Your decision.</em></h2>
      <p>Understand what Amstreem stores, how account access works, and take a copy of your information whenever you need it.</p>
    </div>

    <article className="privacy-card">
      <div className="privacy-card-icon"><FileJson size={18}/></div>
      <div className="privacy-card-copy">
        <span>PORTABILITY</span>
        <h3>Download your account data</h3>
        <p>Export memories and their revisions, context links, goals, projects, tasks, habits and check-ins, schedules, recurring routines, plus browser-local captures. Large tables are downloaded in pages so the export is not limited to the first 1,000 rows.</p>
        <button className="privacy-action" onClick={() => void exportAllData()} disabled={busy}><Download size={14}/>{busy ? 'Preparing export…' : 'Download all my data'}</button>
        {message && <p className="privacy-message" role="status">{message}</p>}
      </div>
    </article>

    <article className="privacy-card">
      <div className="privacy-card-icon"><LockKeyhole size={18}/></div>
      <div className="privacy-card-copy">
        <span>ACCOUNT ACCESS</span>
        <h3>Private by account ownership</h3>
        <p>Your eight Amstreem data tables have row-level security enabled. Anonymous reads are blocked, and authenticated access is restricted by the signed-in account's ownership policies. This does not mean infrastructure operators are technically unable to access hosted data.</p>
        <small>Signed-in account: {email || 'Email unavailable'}</small>
      </div>
    </article>

    <article className="privacy-card">
      <div className="privacy-card-icon"><Sparkles size={18}/></div>
      <div className="privacy-card-copy">
        <span>INTELLIGENCE</span>
        <h3>AI connection is not active yet</h3>
        <p>The conversation interface and secure server endpoint are prepared, but live AI responses remain disabled until an API provider is connected. Your saved context is not currently being sent to an AI provider by that endpoint.</p>
      </div>
    </article>

    <p className="privacy-footnote">An export creates a copy; it does not delete or change anything in your account. The downloaded file may contain personal information, so store it carefully and do not share it publicly.</p>
  </section>;
}

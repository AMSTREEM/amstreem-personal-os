import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { userId: string; onSaved: () => void };

const prompts = [
  { type: 'goal', label: 'DIRECTION', question: 'What would you most like to make progress on?', hint: 'A goal, ambition, or something you want to change.' },
  { type: 'fact', label: 'RIGHT NOW', question: 'What matters most in your life at the moment?', hint: 'The people, responsibilities, or priorities taking up your attention.' },
  { type: 'preference', label: 'HOW YOU WORK', question: 'What kind of support actually helps you?', hint: 'For example: direct advice, thoughtful questions, clear plans, or room to explore.' },
  { type: 'preference', label: 'YOUR BOUNDARIES', question: 'What should Amstreem avoid doing?', hint: 'Anything that feels pushy, distracting, repetitive, or simply not useful.' },
  { type: 'project', label: 'IN PROGRESS', question: 'Is there something you are building or learning that Amstreem should understand?', hint: 'Share only what you are comfortable keeping in your private account.' },
] as const;

export default function IntelligenceScreen({ userId, onSaved }: Props) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [complete, setComplete] = useState(false);

  const current = prompts[step];

  const saveAndContinue = async () => {
    const value = answer.trim();
    if (!value || !supabase) return;
    setBusy(true);
    setError('');
    const { error: saveError } = await supabase.from('memories').insert({
      user_id: userId,
      content: value,
      memory_type: current.type,
      sensitivity: 'ordinary',
      source: 'user_confirmed',
    });
    setBusy(false);
    if (saveError) { setError('That answer could not be saved. Please try again.'); return; }
    setSavedCount(count => count + 1);
    setAnswer('');
    if (step === prompts.length - 1) {
      setComplete(true);
      onSaved();
    } else {
      setStep(index => index + 1);
    }
  };

  const skip = () => {
    setAnswer('');
    if (step === prompts.length - 1) {
      setComplete(true);
      onSaved();
    } else {
      setStep(index => index + 1);
    }
  };

  if (complete) return (
    <section className="intelligence-discovery intelligence-complete">
      <div className="discovery-mark"><Check size={22} /></div>
      <span className="kicker">A FOUNDATION, NOT A FINISHED PROFILE</span>
      <h2>That's a more useful<br /><em>place to begin.</em></h2>
      <p>{savedCount ? `You added ${savedCount} pieces of context to your private Amstreem space.` : 'You chose to leave your context empty for now. You can begin whenever you are ready.'} You can change or delete any of them in My world.</p>
      <button className="begin-button" onClick={() => { setStarted(false); setStep(0); setSavedCount(0); setComplete(false); }}>Explore another time <ArrowUpRightFallback /></button>
    </section>
  );

  if (!started) return (
    <section className="intelligence-discovery">
      <div className="discovery-mark"><Sparkles size={22} /></div>
      <span className="kicker">ADD MORE PERSONAL CONTEXT</span>
      <h2>Help Amstreem understand<br /><em>more of your world.</em></h2>
      <p>Add another layer of context about what matters, how you like to work, or what support feels useful. Your answers stay private and can be removed from My world.</p>
      <div className="discovery-meta"><span>5 SHORT PROMPTS</span><i /><span>SKIP ANYTHING</span><i /><span>YOU STAY IN CONTROL</span></div>
      <button className="begin-button" onClick={() => setStarted(true)}>Add more context <ArrowRight size={16} /></button>
    </section>
  );

  return (
    <section className="intelligence-discovery discovery-question">
      <div className="discovery-progress"><span>GETTING TO KNOW YOUR WORLD</span><span>{step + 1} / {prompts.length}</span></div>
      <div className="discovery-track"><i style={{ width: `${((step + 1) / prompts.length) * 100}%` }} /></div>
      <span className="kicker">{current.label}</span>
      <h2>{current.question}</h2>
      <p>{current.hint}</p>
      <textarea value={answer} onChange={event => setAnswer(event.target.value)} rows={4} maxLength={2000} placeholder="Write naturally. There is no right answer." />
      {error && <p className="discovery-error" role="alert">{error}</p>}
      <div className="discovery-actions">
        <button className="discovery-back" onClick={() => { if (step === 0) setStarted(false); else { setStep(index => index - 1); setAnswer(''); } }}><ArrowLeft size={15} /> Back</button>
        <button className="discovery-skip" onClick={skip} disabled={busy}>Skip</button>
        <button className="begin-button" onClick={saveAndContinue} disabled={!answer.trim() || busy}>{busy ? 'Saving…' : step === prompts.length - 1 ? 'Save my context' : 'Continue'} <ArrowRight size={15} /></button>
      </div>
      <div className="discovery-privacy">Your answers are saved to your account only when you choose to continue.</div>
    </section>
  );
}

function ArrowUpRightFallback() {
  return <ArrowRight size={16} />;
}

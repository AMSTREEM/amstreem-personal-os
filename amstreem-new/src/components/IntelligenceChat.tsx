import { FormEvent, useState } from 'react';
import { ArrowUpRight, Bot, LoaderCircle, Send, Sparkles, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Message = { role: 'user' | 'assistant'; content: string };

export default function IntelligenceChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy || !supabase) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setDraft('');
    setError('');
    setBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke('amstreem-intelligence', {
      body: { messages: next },
    });
    setBusy(false);
    if (invokeError || data?.error) {
      setError(data?.error || 'I could not reach Intelligence just now. Please try again.');
      return;
    }
    if (typeof data?.answer !== 'string') {
      setError('I received an unexpected response. Please try again.');
      return;
    }
    setMessages(current => [...current, { role: 'assistant', content: data.answer }]);
  };

  return (
    <section className="intelligence-chat">
      <div className="intelligence-chat-heading">
        <div>
          <span className="kicker"><Sparkles size={12} /> A THINKING SPACE THAT KNOWS YOUR CONTEXT</span>
          <h2>Let's think it through.</h2>
          <p>Ask a question, untangle a decision, or work out what to do next. Relevant context you've saved can inform the conversation.</p>
        </div>
        <span className="chat-private"><i /> PRIVATE SESSION</span>
      </div>
      <div className="chat-transcript" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon"><Bot size={20} /></div>
            <strong>What would be useful to think through?</strong>
            <p>Start with whatever is on your mind. You don't need to phrase it perfectly.</p>
            <div className="chat-suggestions">
              {['Help me clarify my priorities.', 'I have a decision to make.', 'Help me turn an idea into a plan.'].map(prompt => (
                <button key={prompt} onClick={() => setDraft(prompt)}>{prompt}<ArrowUpRight size={13} /></button>
              ))}
            </div>
          </div>
        ) : messages.map((message, index) => (
          <article className={message.role === 'user' ? 'chat-message from-user' : 'chat-message from-amstreem'} key={index}>
            <div className="chat-message-icon">{message.role === 'user' ? <UserRound size={15} /> : <Sparkles size={15} />}</div>
            <div><span>{message.role === 'user' ? 'YOU' : 'AMSTREEM'}</span><p>{message.content}</p></div>
          </article>
        ))}
        {busy && <div className="chat-thinking"><LoaderCircle size={15} /> Thinking with your context…</div>}
      </div>
      {error && <div className="chat-error" role="alert">{error}</div>}
      <form className="chat-composer" onSubmit={send}>
        <textarea value={draft} onChange={event => setDraft(event.target.value)} rows={2} maxLength={5000} placeholder="What's on your mind?" aria-label="Message Amstreem" disabled={busy} />
        <button type="submit" disabled={!draft.trim() || busy}><Send size={16} /><span>Send</span></button>
      </form>
      <div className="chat-footnote">Your saved context is used only to make relevant replies more helpful. You can edit or delete it in My world.</div>
    </section>
  );
}

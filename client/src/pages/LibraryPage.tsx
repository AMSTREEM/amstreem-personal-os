import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Plus, Trash2 } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';

type Note = { id: number; title: string; body: string; updated_at: string };
export function LibraryPage() {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const notes = useQuery({ queryKey: ['notes'], queryFn: () => api<Note[]>('/notes') });
  const create = useMutation({ mutationFn: () => api('/notes', json('POST', { title, body })), onSuccess: () => { setTitle(''); setBody(''); void client.invalidateQueries({ queryKey: ['notes'] }); } });
  const remove = useMutation({ mutationFn: (id: number) => api('/notes/' + id, { method: 'DELETE' }), onSuccess: () => void client.invalidateQueries({ queryKey: ['notes'] }) });
  return <div className="stack">
    <PageHeader eyebrow="KNOWLEDGE / PERSONAL LIBRARY" title="Library" description="Keep the ideas, references and notes you want to return to." />
    <Card>
      <div className="card-heading"><div><h2>Capture a note</h2><p>Save a thought before it disappears.</p></div><BookMarked size={18} /></div>
      <form className="form-stack" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Title"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="Give this note a useful name" required /></Field>
        <Field label="Note"><TextArea value={body} onChange={event => setBody(event.target.value)} placeholder="Write down the idea, reference or thought…" /></Field>
        <div><Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Save note</Button></div>
      </form>
    </Card>
    <div className="library-grid">
      {notes.data?.length ? notes.data.map(note => <Card key={note.id} className="note-card"><div className="note-card__top"><BookMarked size={16} /><button className="icon-button" onClick={() => { if (window.confirm('Delete this note?')) remove.mutate(note.id); }} aria-label="Delete note"><Trash2 size={15} /></button></div><h2>{note.title}</h2><p>{note.body || 'No additional text.'}</p><small>Updated {new Date(note.updated_at).toLocaleDateString()}</small></Card>) : <Card><EmptyState title="Your library is open." detail="Save a useful idea, reference or reflection. Your notes stay private to your account." /></Card>}
    </div>
  </div>;
}
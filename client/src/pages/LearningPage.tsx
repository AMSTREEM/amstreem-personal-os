import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextInput } from '../components/ui';

type Lesson = { id: number; title: string; status: string; study_minutes: number };
type Path = { id: number; title: string; subject: string; description: string; status: string; lessons: Lesson[] };

export function LearningPage() {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const paths = useQuery({ queryKey: ['learning-paths'], queryFn: () => api<Path[]>('/learning/paths') });
  const create = useMutation({
    mutationFn: () => api('/learning/paths', json('POST', { title, subject })),
    onSuccess: () => { setTitle(''); setSubject(''); void client.invalidateQueries({ queryKey: ['learning-paths'] }); }
  });
  const updateLesson = useMutation({
    mutationFn: ({ lesson, status }: { lesson: Lesson; status: string }) => api('/learning/lessons/' + lesson.id, json('PATCH', { status })),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['learning-paths'] })
  });
  return <div className="stack">
    <PageHeader eyebrow="PRACTICE / CURIOSITY" title="Learning studio" description="Organise what you are learning into paths, lessons and resources. Keep the next lesson visible." />
    <Card>
      <div className="card-heading"><div><h2>Create a learning path</h2><p>Give a subject or skill a clear place in your workspace.</p></div><BookOpen size={18} /></div>
      <form className="form-row" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Path title"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="What are you learning?" required /></Field>
        <Field label="Subject"><TextInput value={subject} onChange={event => setSubject(event.target.value)} placeholder="Optional category" /></Field>
        <Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Create path</Button>
      </form>
    </Card>
    <div className="stack">
      {paths.data?.length ? paths.data.map(path => <Card key={path.id}>
        <div className="card-heading"><div><span className="eyebrow">{path.subject || 'LEARNING PATH'}</span><h2>{path.title}</h2><p>{path.description || 'Build this path one lesson at a time.'}</p></div><span className="status-pill">{path.status}</span></div>
        {path.lessons.length ? <div className="list-stack">{path.lessons.map(lesson => <div className="list-row" key={lesson.id}><span className="session-mark"><BookOpen size={16} /></span><div className="list-row__body"><b>{lesson.title}</b><small>{lesson.study_minutes} minutes studied</small></div><select className="status-select" value={lesson.status} onChange={event => updateLesson.mutate({ lesson, status: event.target.value })}><option>Not started</option><option>In progress</option><option>Completed</option></select></div>)}</div> : <EmptyState title="Add the first lesson." detail="This path is ready for its first lesson. Lessons can be added from the full learning workflow." />}
      </Card>) : <Card><EmptyState title="Make learning deliberate." detail="Create a path for a subject you want to understand, then build it into lessons and study sessions." /></Card>}
    </div>
  </div>;
}
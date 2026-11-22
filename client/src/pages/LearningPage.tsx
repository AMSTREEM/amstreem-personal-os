import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';
import { Cascade } from '../components/Cascade';

type Goal = { id: number; title: string };
type Lesson = { id: number; title: string; status: string; study_minutes: number; notes?: string };
type Path = { id: number; title: string; subject: string; description: string; status: string; goal_id: number | null; lessons: Lesson[] };

export function LearningPage({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [goalId, setGoalId] = useState('');
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => api<Goal[]>('/goals') });
  const [lessonDrafts, setLessonDrafts] = useState<Record<number, string>>({});
  const [lessonNotes, setLessonNotes] = useState<Record<number, string>>({});
  const paths = useQuery({ queryKey: ['learning-paths'], queryFn: () => api<Path[]>('/learning/paths') });
  const create = useMutation({
    mutationFn: () => api('/learning/paths', json('POST', { title, subject, goal_id: goalId || null })),
    onSuccess: () => { setTitle(''); setSubject(''); setGoalId(''); void client.invalidateQueries({ queryKey: ['learning-paths'] }); void client.invalidateQueries({ queryKey: ['goals'] }); }
  });
  const createLesson = useMutation({
    mutationFn: ({ pathId, value }: { pathId: number; value: string }) => api('/learning/paths/' + pathId + '/lessons', json('POST', { title: value })),
    onSuccess: (_data, variables) => { setLessonDrafts(current => ({ ...current, [variables.pathId]: '' })); void client.invalidateQueries({ queryKey: ['learning-paths'] }); }
  });
  const updateLesson = useMutation({
    mutationFn: ({ lesson, values }: { lesson: Lesson; values: {status?:string;notes?:string} }) => api('/learning/lessons/' + lesson.id, json('PATCH', values)),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['learning-paths'] })
  });
  return <Cascade className="stack">
    {!embedded && <PageHeader eyebrow="PRACTICE / CURIOSITY" title="Learning studio" description="Organise what you are learning into paths, lessons and resources. Keep the next lesson visible." />}
    <Card>
      <details className="atlas-add-disclosure atlas-create-disclosure">
        <summary>+ Add learning path</summary>
        <div className="card-heading"><div><h2>Create a learning path</h2><p>Give a subject or skill a clear place.</p></div><BookOpen size={18} /></div>
        <form className="form-row" onSubmit={event => { event.preventDefault(); if (title.trim()) create.mutate(); }}>
        <Field label="Path title"><TextInput value={title} onChange={event => setTitle(event.target.value)} placeholder="What are you learning?" required /></Field>
        <Field label="Subject"><TextInput value={subject} onChange={event => setSubject(event.target.value)} placeholder="Optional category" /></Field>
        <Field label="Related goal"><select className="field-input" value={goalId} onChange={event => setGoalId(event.target.value)}><option value="">No linked goal</option>{goals.data?.map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></Field>
        <Button type="submit" disabled={create.isPending || !title.trim()}><Plus size={16} /> Create path</Button>
        </form>
      </details>
    </Card>
    <div className="stack">
      {paths.data?.length ? paths.data.map(path => { const done=path.lessons.filter(lesson=>lesson.status==='Completed').length; const progress=path.lessons.length?Math.round(done/path.lessons.length*100):0; return <div id={'atlas-learning-'+path.id} className="atlas-constellation-target" key={path.id}><Card className={"room4-card room4-path-card atlas-spotlight room4-path-card--"+path.status.toLowerCase().replace(/\s+/g,'-')}>
        <div className="card-heading"><div><span className="eyebrow">{path.subject || 'LEARNING PATH'}</span><h2>{path.title}</h2><p>{path.description || 'Build this path one lesson at a time.'}{path.goal_id ? ' · Linked to a goal' : ''}</p></div><span className="status-pill">{path.status}</span></div>
        <div className="room4-progress"><div><small>PATH PROGRESS</small><b>{done}/{path.lessons.length} lessons · {progress}%</b></div><span><i style={{width:progress+'%'}}/></span></div>
        {path.lessons.length ? <div className="list-stack">{path.lessons.map(lesson => <div className="list-row room4-lesson-row" key={lesson.id}><span className="session-mark"><BookOpen size={16} /></span><div className="list-row__body"><b>{lesson.title}</b><small>{lesson.study_minutes} minutes from linked focus sessions</small><Link className="text-link" to={'/focus?lesson=' + lesson.id}><Timer size={13}/> Start Study Focus</Link><details className="atlas-add-disclosure atlas-inline-add atlas-study-notes"><summary>{(lessonNotes[lesson.id] ?? lesson.notes ?? '').trim() ? 'Edit study notes' : '+ Add study notes'}</summary><TextArea value={lessonNotes[lesson.id] ?? lesson.notes ?? ''} onChange={event=>setLessonNotes(current=>({...current,[lesson.id]:event.target.value}))} placeholder="Study notes…"/><Button variant="secondary" onClick={()=>updateLesson.mutate({lesson,values:{notes:lessonNotes[lesson.id]??lesson.notes??''}})}>Save notes</Button></details></div><select className="status-select" value={lesson.status} onChange={event => updateLesson.mutate({ lesson, values:{status:event.target.value} })}><option>Not started</option><option>In progress</option><option>Completed</option></select></div>)}</div> : <EmptyState title="Add the first lesson." detail="Give this learning path its first clear checkpoint." />}
        <details className="atlas-add-disclosure atlas-inline-add"><summary>+ Add lesson</summary>
          <form className="form-row milestone-form" onSubmit={event => { event.preventDefault(); const value = lessonDrafts[path.id]?.trim(); if (value) createLesson.mutate({ pathId: path.id, value }); }}><Field label="Lesson title"><TextInput value={lessonDrafts[path.id] || ''} onChange={event => setLessonDrafts(current => ({ ...current, [path.id]: event.target.value }))} placeholder="Name the next lesson" /></Field><Button type="submit" variant="secondary" disabled={createLesson.isPending || !lessonDrafts[path.id]?.trim()}><Plus size={15} /> Add lesson</Button></form>
        </details>
      </Card></div>;}) : <Card><EmptyState title="Make learning deliberate." detail="Create a path for a subject you want to understand, then build it into lessons and study sessions." /></Card>}
    </div>
  </Cascade>;
}
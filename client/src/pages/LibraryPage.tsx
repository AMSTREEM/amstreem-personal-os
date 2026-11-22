import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, BookOpen, FileText, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, TextArea, TextInput } from '../components/ui';
import { Cascade } from '../components/Cascade';

type Note = { id: number; title: string; body: string; updated_at: string };
type ReadingItem = { id: number; title: string; item_type: 'book'|'article'|'reference'; url: string; author: string; notes: string; status: 'Queued'|'Active'|'Completed' };
const typeIcon = { book: BookOpen, article: FileText, reference: Link2 };

export function LibraryPage({ embedded = false }: { embedded?: boolean }) {
  const client = useQueryClient();
  const [title,setTitle]=useState(''),[body,setBody]=useState('');
  const [editing,setEditing]=useState<number|null>(null),[editTitle,setEditTitle]=useState(''),[editBody,setEditBody]=useState('');
  const [resourceTitle,setResourceTitle]=useState(''),[resourceType,setResourceType]=useState<ReadingItem['item_type']>('book'),[author,setAuthor]=useState(''),[url,setUrl]=useState('');
  const notes=useQuery({queryKey:['notes'],queryFn:()=>api<Note[]>('/notes')});
  const items=useQuery({queryKey:['reading-items'],queryFn:()=>api<ReadingItem[]>('/reading-items')});
  const createNote=useMutation({mutationFn:()=>api('/notes',json('POST',{title,body})),onSuccess:()=>{setTitle('');setBody('');void client.invalidateQueries({queryKey:['notes']});}});
  const updateNote=useMutation({mutationFn:()=>api('/notes/'+editing,json('PUT',{title:editTitle,body:editBody})),onSuccess:()=>{setEditing(null);void client.invalidateQueries({queryKey:['notes']});}});
  const deleteNote=useMutation({mutationFn:(id:number)=>api('/notes/'+id,{method:'DELETE'}),onSuccess:()=>void client.invalidateQueries({queryKey:['notes']})});
  const createItem=useMutation({mutationFn:()=>api('/reading-items',json('POST',{title:resourceTitle,item_type:resourceType,author,url})),onSuccess:()=>{setResourceTitle('');setAuthor('');setUrl('');void client.invalidateQueries({queryKey:['reading-items']});}});
  const status=useMutation({mutationFn:({item,value}:{item:ReadingItem;value:ReadingItem['status']})=>api('/reading-items/'+item.id,json('PATCH',{status:value})),onSuccess:()=>void client.invalidateQueries({queryKey:['reading-items']})});
  return <Cascade className="stack room4-library">
    {!embedded && <PageHeader eyebrow="KNOWLEDGE / PERSONAL LIBRARY" title="Private library" description="A considered collection of books, articles, references and notes worth returning to." />}
    <Card className="room4-card">
      <div className="card-heading"><div><h2>Add to your reading list</h2><p>Capture a resource and decide its place in your reading queue.</p></div><BookMarked size={18}/></div>
      <details className="atlas-add-disclosure"><summary>+ Add resource</summary><form className="form-stack" onSubmit={e=>{e.preventDefault();if(resourceTitle.trim())createItem.mutate();}}>
        <Field label="Resource title"><TextInput value={resourceTitle} onChange={e=>setResourceTitle(e.target.value)} placeholder="Book, article or reference" required/></Field>
        <div className="form-row">
          <Field label="Type"><select className="field-input" value={resourceType} onChange={e=>setResourceType(e.target.value as ReadingItem['item_type'])}><option value="book">Book</option><option value="article">Article</option><option value="reference">Reference</option></select></Field>
          <Field label="Author / source"><TextInput value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Optional"/></Field>
          <Field label="Link"><TextInput type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></Field>
        </div>
        <div><Button type="submit" disabled={createItem.isPending||!resourceTitle.trim()}><Plus size={16}/> Add resource</Button></div>
      </form></details>
      {createItem.isError&&<p className="inline-error">{createItem.error.message}</p>}
    </Card>
    <section className="stack">
      <div className="card-heading"><div><span className="eyebrow">READING QUEUE</span><h2>Your resources</h2><p>Move each item forward as your attention changes.</p></div></div>
      {items.data?.length?<div className="room4-resource-list">{items.data.map(item=>{const Icon=typeIcon[item.item_type];return <Card key={item.id} className="room4-card room4-resource"><span className="session-mark"><Icon size={17}/></span><div className="room4-resource__body"><b>{item.title}</b><small>{item.item_type} {item.author?'· '+item.author:''}</small>{item.url&&<a href={item.url} target="_blank" rel="noreferrer">Open resource ↗</a>}</div><select aria-label={'Reading status for '+item.title} className="status-select" value={item.status} disabled={status.isPending} onChange={e=>status.mutate({item,value:e.target.value as ReadingItem['status']})}><option>Queued</option><option>Active</option><option>Completed</option></select></Card>;})}</div>:<Card><EmptyState title="Your reading queue is clear." detail="Add a book, article or reference when you find something worth studying."/></Card>}
    </section>
    <Card className="room4-card">
      <div className="card-heading"><div><h2>Capture a note</h2><p>Keep a useful idea or reflection close to its source.</p></div><BookMarked size={18}/></div>
      <details className="atlas-add-disclosure"><summary>+ Capture a note</summary><form className="form-stack" onSubmit={e=>{e.preventDefault();if(title.trim())createNote.mutate();}}>
        <Field label="Title"><TextInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Give this note a useful name" required/></Field>
        <Field label="Note"><TextArea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write down the idea, reference or thought…"/></Field>
        <div><Button type="submit" disabled={createNote.isPending||!title.trim()}><Plus size={16}/> Save note</Button></div>
      </form></details>
    </Card>
    <div className="library-grid">{notes.data?.length?notes.data.map(note=><Card key={note.id} className="note-card room4-card"><div className="note-card__top"><BookMarked size={16}/><div className="room4-note-actions"><button className="icon-button" aria-label="Edit note" onClick={()=>{setEditing(note.id);setEditTitle(note.title);setEditBody(note.body);}}><Pencil size={14}/></button><button className="icon-button" aria-label="Delete note" onClick={()=>{if(window.confirm('Delete this note?'))deleteNote.mutate(note.id);}}><Trash2 size={14}/></button></div></div>{editing===note.id?<form className="form-stack" onSubmit={e=>{e.preventDefault();if(editTitle.trim())updateNote.mutate();}}><Field label="Title"><TextInput value={editTitle} onChange={e=>setEditTitle(e.target.value)} required/></Field><Field label="Note"><TextArea value={editBody} onChange={e=>setEditBody(e.target.value)}/></Field><div><Button type="submit" disabled={updateNote.isPending||!editTitle.trim()}>Save changes</Button><Button type="button" variant="ghost" onClick={()=>setEditing(null)}>Cancel</Button></div></form>:<><h2>{note.title}</h2><p>{note.body||'No additional text.'}</p><small>Updated {new Date(note.updated_at).toLocaleDateString()}</small></>}</Card>):<Card><EmptyState title="Your notes will live here." detail="Saved notes remain private to your workspace."/></Card>}</div>
  </Cascade>;
}

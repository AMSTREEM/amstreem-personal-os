import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Link2, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Memory = { id:string; content:string; memory_type:string };
type Item = { id:string; title:string; kind:'goal'|'project'|'task'; status:string };
type ExistingLink = { memory_id:string; life_item_id:string };
type Suggestion = { memory:Memory; item:Item; terms:string[] };

const stopWords = new Set(['about','after','again','also','because','before','being','could','from','have','into','just','more','most','need','only','other','over','same','should','some','that','their','them','then','there','these','they','this','through','want','what','when','where','which','while','with','would','your','make','work','life','goal','project','task']);
const terms = (value:string) => Array.from(new Set(value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\\s]/g,' ').split(/\\s+/).filter(word=>word.length>=4&&!stopWords.has(word))));
export default function CrossFeatureUnderstanding({userId}:{userId:string}) {
  const [memories,setMemories]=useState<Memory[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const [links,setLinks]=useState<ExistingLink[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState<string|null>(null);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const [message,setMessage]=useState('');

  const load=async()=>{
    if(!supabase)return;
    setLoading(true);setMessage('');
    const [m,i,l]=await Promise.all([
      supabase.from('memories').select('id,content,memory_type').order('updated_at',{ascending:false}),
      supabase.from('life_items').select('id,title,kind,status').neq('status','archived'),
      supabase.from('memory_links').select('memory_id,life_item_id')
    ]);
    if(m.error||i.error||l.error){setMessage('Could not compare all your saved context. Refresh to try again.');}
    else{setMemories((m.data||[]) as Memory[]);setItems((i.data||[]) as Item[]);setLinks((l.data||[]) as ExistingLink[]);}
    setLoading(false);
  };
  useEffect(()=>{void load();},[userId]);

  const suggestions=useMemo(()=>{
    const output:Suggestion[]=[];
    for(const memory of memories){
      const memoryTerms=terms(memory.content);
      if(memoryTerms.length===0)continue;
      for(const item of items){
        if(item.status!=='active')continue;
        if(links.some(link=>link.memory_id===memory.id&&link.life_item_id===item.id))continue;
        const overlap=memoryTerms.filter(word=>terms(item.title).includes(word));
        if(overlap.length>=1)output.push({memory,item,terms:overlap});
      }
    }
    return output.sort((a,b)=>b.terms.length-a.terms.length).slice(0,8);
  },[memories,items,links]);

  const connect=async(s:Suggestion)=>{
    if(!supabase)return;
    const key=s.memory.id+':'+s.item.id;setSaving(key);setMessage('');
    const {error}=await supabase.from('memory_links').insert({user_id:userId,memory_id:s.memory.id,life_item_id:s.item.id});
    setSaving(null);
    if(error){setMessage('That connection could not be saved. Please try again.');return;}
    setLinks(current=>[...current,{memory_id:s.memory.id,life_item_id:s.item.id}]);
    setMessage('Connection saved.'); 
  };
  const visible=suggestions.filter(s=>!dismissed.includes(s.memory.id+':'+s.item.id));
  return <section className="understanding-area">
    <div className="understanding-heading"><div><span className="kicker"><Sparkles size={12}/> POSSIBLE CONNECTIONS</span><h2>Things that may belong together.</h2><p>Amstreem compares words in your saved context with active goals, projects and tasks. These are suggestions—not conclusions.</p></div><span className="understanding-count">{visible.length} to review</span></div>
    <div className="understanding-note">A match is based only on shared words. You decide whether the relationship is meaningful.</div>
    {message&&<p className="understanding-message" role="status">{message}</p>}{loading?<div className="understanding-empty">Comparing your saved context…</div>:visible.length?<div className="understanding-list">{visible.map(s=>{const key=s.memory.id+':'+s.item.id;return <article className="understanding-card" key={key}><div className="understanding-memory"><span>YOUR CONTEXT</span><p>{s.memory.content}</p></div><ArrowUpRight size={15} className="understanding-arrow"/><div className="understanding-target"><span>{s.item.kind.toUpperCase()}</span><strong>{s.item.title}</strong><small>Shared words: {s.terms.join(', ')}</small></div><div className="understanding-actions"><button disabled={saving===key} onClick={()=>void connect(s)}><Check size={13}/>{saving===key?'Saving':'Connect'}</button><button aria-label="Not relevant" onClick={()=>setDismissed(current=>[...current,key])}><X size={14}/></button></div></article>})}</div>:<div className="understanding-empty">{suggestions.length?'You have reviewed these suggestions.':'No clear word matches yet. As your context and plans grow, possible connections may appear.'}</div>}
    <p className="understanding-foot"><Link2 size={12}/> Accepted suggestions are saved alongside your manual connections. Dismissed suggestions are not saved as facts.</p>
  </section>;
}
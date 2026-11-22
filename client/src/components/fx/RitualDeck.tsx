import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, MoonStar, Sun } from 'lucide-react';
type Props={mode:'morning'|'evening';initial?:{intention?:string;wins?:string;lessons?:string;challenges?:string;nextFocus?:string};priorityCount?:number;onClose:()=>void;onComplete:(values:{first:string;second:string;third:string;fourth:string})=>void};
const copy={morning:{title:'Morning kickoff',eyebrow:'BEGIN WITH INTENTION',steps:[['Set daily intention','Name the quality or outcome that deserves your attention today.'],['Lock in your Top 3','Choose three meaningful priorities. Keep the list honest and achievable.'],['Ignite your first action','Your workspace is ready. Start a protected focus block or take the first step.']],finish:'Begin the day'},evening:{title:'Evening shutdown',eyebrow:'CLOSE WITH CLARITY',steps:[['Review today’s wins','Notice what moved forward, including the small things.'],['Log a reflection','Capture one useful lesson to carry into tomorrow.'],['Seal the day','Save your reflection to today’s existing Evening Shutdown record.']],finish:'Seal the day'}};
export function RitualDeck({mode,initial,priorityCount=0,onClose,onComplete}:Props){
 const [step,setStep]=useState(0),[first,setFirst]=useState(mode==='morning'?initial?.intention||'':initial?.wins||''),[second,setSecond]=useState(initial?.lessons||''),[third,setThird]=useState(initial?.challenges||''),[fourth,setFourth]=useState(initial?.nextFocus||'');
 const reduce=useReducedMotion(),data=copy[mode];
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();else if(e.key==='Enter'&&!['TEXTAREA','INPUT','BUTTON'].includes((e.target as HTMLElement).tagName)){e.preventDefault();setStep(s=>Math.min(2,s+1));}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 return <motion.div className="atlas-ritual-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <motion.section className="atlas-ritual-deck" role="dialog" aria-modal="true" aria-label={data.title} initial={reduce?false:{opacity:0,y:24,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:16,scale:.98}} transition={{type:'spring',stiffness:280,damping:28}}>
   <header><span className="atlas-ritual-mark">{mode==='morning'?<Sun size={17}/>:<MoonStar size={17}/>}</span><div><span className="eyebrow">{data.eyebrow}</span><h2>{data.title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close ritual">×</button></header>
   <div className="atlas-ritual-progress" aria-label={'Step '+(step+1)+' of 3'}>{[0,1,2].map(i=><i key={i} className={i<=step?'is-active':''}/>)}</div>
   <AnimatePresence mode="wait"><motion.div key={step} className="atlas-ritual-step" initial={reduce?false:{opacity:0,x:18,filter:'blur(5px)'}} animate={{opacity:1,x:0,filter:'blur(0px)'}} exit={reduce?undefined:{opacity:0,x:-14}} transition={{duration:.2}}>
    <span className="eyebrow">STEP 0{step+1} / 03</span><h3>{data.steps[step][0]}</h3><p>{data.steps[step][1]}</p>
    {mode==='morning'&&step===0&&<textarea autoFocus rows={3} value={first} onChange={e=>setFirst(e.target.value)} placeholder="Today, I will…"/>}
    {mode==='morning'&&step===1&&<div className="atlas-ritual-stat"><b>{priorityCount}/3</b><span>priorities selected in your Residence plan</span></div>}
    {mode==='evening'&&step===0&&<textarea autoFocus rows={3} value={first} onChange={e=>setFirst(e.target.value)} placeholder="I made progress on…"/>}
    {mode==='evening'&&step===1&&<textarea autoFocus rows={3} value={second} onChange={e=>setSecond(e.target.value)} placeholder="One thing I learned…"/>}
    {mode==='evening'&&step===2&&<div className="atlas-ritual-final-fields"><label>What created friction? (optional)<textarea rows={2} value={third} onChange={e=>setThird(e.target.value)} placeholder="What got in the way?"/></label><label>Tomorrow’s first meaningful step<textarea rows={2} value={fourth} onChange={e=>setFourth(e.target.value)} placeholder="Tomorrow, I will begin by…"/></label></div>}
    {step===2&&<div className="atlas-ritual-seal"><span>✦</span><b>{mode==='morning'?'Your first action is waiting.':'A clear ending makes room for a better beginning.'}</b><small>{mode==='morning'?'Move directly into Focus Room.':'Your notes will be saved to today’s existing review.'}</small></div>}
   </motion.div></AnimatePresence>
   <footer><button type="button" className="button button--ghost" onClick={()=>step?setStep(s=>s-1):onClose()}>{step?<><ArrowLeft size={14}/> Back</>:'Not now'}</button>{step<2?<button type="button" className="button button--primary" disabled={(step===0&&!first.trim())||(mode==='evening'&&step===1&&!second.trim())} onClick={()=>setStep(s=>s+1)}>Continue <ArrowRight size={14}/></button>:<button type="button" className="button button--primary" onClick={()=>onComplete({first,second,third,fourth})}><Check size={14}/>{data.finish}</button>}</footer>
   <small className="atlas-ritual-keyhint">Enter to advance · Esc to close</small>
  </motion.section>
 </motion.div>;
}

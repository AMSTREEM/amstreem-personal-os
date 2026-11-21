import { useSyncExternalStore } from 'react';
export type FocusTimerState = { remaining:number; deadline:number|null; durationSeconds:number; kind:'focus'|'break'; taskId:string; lessonId:string; projectId:string; focus:string; notes:string; distractions:string[]; sessionKey:string|null; startedAt:number|null; taskTitle?:string; lessonTitle?:string; focusLabel?:string };
const TIMER_KEY='atlas-focus-timer-v1', DEFAULT_SECONDS=25*60;
const freshTimer=():FocusTimerState=>({remaining:DEFAULT_SECONDS,deadline:null,durationSeconds:DEFAULT_SECONDS,kind:'focus',taskId:'',lessonId:'',projectId:'',focus:'',notes:'',distractions:[],sessionKey:null,startedAt:null});
function readStoredTimer():FocusTimerState {
 try { const raw=JSON.parse(localStorage.getItem(TIMER_KEY)||'null'); if(raw&&Number.isFinite(raw.remaining)) return {...freshTimer(),...raw,remaining:Math.max(0,Math.min(36000,Math.floor(raw.remaining))),durationSeconds:Math.max(60,Math.min(36000,Math.floor(raw.durationSeconds||raw.remaining||DEFAULT_SECONDS))),deadline:Number.isFinite(raw.deadline)?raw.deadline:null,kind:raw.kind==='break'?'break':'focus',taskId:typeof raw.taskId==='string'?raw.taskId:'',lessonId:typeof raw.lessonId==='string'?raw.lessonId:'',projectId:typeof raw.projectId==='string'?raw.projectId:'',focus:typeof raw.focus==='string'?raw.focus:'',notes:typeof raw.notes==='string'?raw.notes:'',distractions:Array.isArray(raw.distractions)?raw.distractions.filter((x:unknown)=>typeof x==='string').slice(0,50):[],sessionKey:typeof raw.sessionKey==='string'?raw.sessionKey:(raw.deadline!==null?'atlas-migrated-'+Date.now()+'-'+Math.random().toString(36).slice(2):null),startedAt:typeof raw.startedAt==='number'?raw.startedAt:null}; } catch { /* Recover from malformed timer state. */ }
 return freshTimer();
}
let snapshot=typeof window==='undefined'?freshTimer():readStoredTimer();
const listeners=new Set<()=>void>(), getSnapshot=()=>snapshot;
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);};
function publish(next:FocusTimerState){snapshot=next;listeners.forEach(listener=>listener());}
if(typeof window!=='undefined') window.addEventListener('storage',event=>{if(!event.key||event.key===TIMER_KEY)publish(readStoredTimer());});
export function updateFocusTimer(update:FocusTimerState|((current:FocusTimerState)=>FocusTimerState)):void {
 const next=typeof update==='function'?update(snapshot):update, safe={...freshTimer(),...next};
 snapshot=safe; try{localStorage.setItem(TIMER_KEY,JSON.stringify(safe));}catch{/* Keep the in-memory timer usable. */}
 listeners.forEach(listener=>listener());
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('atlas-focus-timer-change',{detail:safe}));
}
export function useFocusTimer():FocusTimerState{return useSyncExternalStore(subscribe,getSnapshot,getSnapshot);}

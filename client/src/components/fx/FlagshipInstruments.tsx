import { useEffect, useState } from 'react';
export function CelestialHorizon(){
 const [now,setNow]=useState(()=>new Date()),[scrubHour,setScrubHour]=useState<number|null>(null);
 useEffect(()=>{const id=window.setInterval(()=>setNow(new Date()),60000);return()=>window.clearInterval(id);},[]);
 const hour=scrubHour??(now.getHours()+now.getMinutes()/60),phase=hour<5?'night':hour<7?'dawn':hour<17?'day':hour<19?'dusk':'night';
 const label=phase==='dawn'?'DAWN AMBER':phase==='day'?'DAYLIGHT CLARITY':phase==='dusk'?'DUSK VIOLET':'NIGHT OBSIDIAN';
 const progress=Math.max(0,Math.min(1,(hour-5)/14)),x=12+progress*276,y=72-48*Math.sin(Math.PI*progress),displayTime=new Date(now);
 displayTime.setHours(Math.floor(hour),Math.round((hour%1)*60),0,0);
 const inspect=(event:React.PointerEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)));setScrubHour(5+fraction*14);};
 return <section className={'atlas-celestial-horizon is-'+phase} aria-label="Celestial time horizon">
  <div className="atlas-celestial-horizon__copy"><span className="eyebrow">YOUR DAY, IN MOTION</span><b>{label}</b><small>{new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(displayTime)} {scrubHour===null?'local time':'selected time'}</small></div>
  <svg viewBox="0 0 300 92" role="img" aria-label="Interactive sun or moon moving across today's horizon" onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);inspect(event);}} onPointerMove={event=>{if(event.pointerType==='mouse'||event.buttons>0)inspect(event);}} onPointerUp={()=>setScrubHour(null)} onPointerLeave={()=>setScrubHour(null)}>
   <defs><linearGradient id="atlas-horizon-line" x1="0" x2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".08"/><stop offset=".5" stopColor="currentColor" stopOpacity=".8"/><stop offset="1" stopColor="currentColor" stopOpacity=".08"/></linearGradient><radialGradient id="atlas-horizon-orb"><stop offset="0" stopColor="#fff8d8"/><stop offset=".55" stopColor="currentColor"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></radialGradient></defs>
   <path d="M12 72 Q150 -24 288 72" fill="none" stroke="url(#atlas-horizon-line)" strokeWidth="1.5"/><path d="M12 72 H288" stroke="currentColor" strokeOpacity=".14"/><circle cx={x} cy={y} r="16" fill="url(#atlas-horizon-orb)" opacity=".26"/><circle cx={x} cy={y} r="7" fill="currentColor"/><circle cx={x-2} cy={y-2} r="2" fill="#fff" opacity=".8"/>
  </svg>
  <p>Tap or drag the horizon to follow the day’s arc.</p>
 </section>;
}
export function AstrolabeRings({active}:{active:boolean}){
 return <svg className={'atlas-astrolabe-rings'+(active?' is-active':'')} viewBox="0 0 260 260" aria-hidden="true">
  {[0,1].map(ring=><g key={ring} className={ring?'atlas-astrolabe-rings__outer':'atlas-astrolabe-rings__inner'}>{Array.from({length:ring?48:24},(_,i)=>{const a=i/(ring?48:24)*Math.PI*2-Math.PI/2,r1=ring?116:103,r2=ring?(i%4===0?125:120):(i%2===0?109:106);return <line key={i} x1={130+Math.cos(a)*r1} y1={130+Math.sin(a)*r1} x2={130+Math.cos(a)*r2} y2={130+Math.sin(a)*r2}/>;})}<circle cx="130" cy="130" r={ring?115:101} fill="none"/></g>)}
 </svg>;
}

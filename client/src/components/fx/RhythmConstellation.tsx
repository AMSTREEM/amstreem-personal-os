import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useReducedMotion } from 'motion/react';
type HabitRow={id:number;done:number};
type DeenDay={prayers?:{completed:number}[]};
type DayPoint={date:string;count:number;prayers:number;habits:number;streak:number};
function keyFor(date:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function dayLabel(value:string){return new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));}
export function RhythmConstellation(){
 const reduced=useReducedMotion(),canvasRef=useRef<HTMLCanvasElement>(null);
 const dates=useMemo(()=>Array.from({length:30},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(29-i));return keyFor(d);}),[]);
 const history=useQuery({queryKey:['flagship-rhythm-30',dates[0],dates[29]],staleTime:300000,queryFn:async()=>Promise.all(dates.map(async date=>{
  const [habits,deen]=await Promise.all([api<HabitRow[]>('/habits?date='+date).catch(()=>[] as HabitRow[]),api<DeenDay>('/deen/summary?date='+date).catch(()=>null)]);
  const habitCount=habits.filter(item=>!!item.done).length,prayerCount=deen?.prayers?.filter(item=>!!item.completed).length||0;
  return {date,count:habitCount+prayerCount,habits:habitCount,prayers:prayerCount};
 }))});
 const points=useMemo<DayPoint[]>(()=>{let chain=0;return (history.data||[]).map(day=>{chain=day.count>0?chain+1:0;return {...day,streak:chain};});},[history.data]);
 const [selected,setSelected]=useState(29);
 useEffect(()=>{const canvas=canvasRef.current;if(!canvas||!points.length)return;const ctx=canvas.getContext('2d');if(!ctx)return;
 let width=1,height=140,dpr=1,raf=0,hover=-1,beamX=-1,visible=!document.hidden;
 let nodes:{x:number;y:number}[]=[];
 const resize=()=>{dpr=Math.min(window.devicePixelRatio||1,1.5);width=Math.max(280,canvas.clientWidth);height=Math.max(120,canvas.clientHeight||140);canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);ctx!.setTransform(dpr,0,0,dpr,0,0);nodes=points.map((p,i)=>({x:18+(width-36)*(i/Math.max(1,points.length-1)),y:height*.55-Math.min(25,p.count*4)+(i%2?5:-4)}));draw();};
 const draw=()=>{raf=0;if(!visible)return;ctx!.clearRect(0,0,width,height);
 for(let i=1;i<points.length;i++)if(points[i-1].count>0&&points[i].count>0){ctx!.beginPath();ctx!.moveTo(nodes[i-1].x,nodes[i-1].y);ctx!.lineTo(nodes[i].x,nodes[i].y);ctx!.strokeStyle='rgba(222,184,104,.72)';ctx!.lineWidth=2;ctx!.shadowBlur=8;ctx!.shadowColor='rgba(222,184,104,.48)';ctx!.stroke();ctx!.shadowBlur=0;}
 nodes.forEach((n,i)=>{const p=points[i],isSelected=i===hover||i===selected;ctx!.beginPath();ctx!.fillStyle=p.count?'#e8c47b':'rgba(145,157,185,.42)';ctx!.shadowBlur=p.count?(isSelected?18:8):0;ctx!.shadowColor='#e8c47b';ctx!.arc(n.x,n.y,p.count?(isSelected?5.5:3.6):2.4,0,Math.PI*2);ctx!.fill();ctx!.shadowBlur=0;if(isSelected){ctx!.beginPath();ctx!.strokeStyle='rgba(232,196,123,.42)';ctx!.lineWidth=1;ctx!.arc(n.x,n.y,10,0,Math.PI*2);ctx!.stroke();}});
 if(beamX>=0){ctx!.beginPath();ctx!.moveTo(beamX,12);ctx!.lineTo(beamX,height-14);ctx!.strokeStyle='rgba(220,225,255,.25)';ctx!.lineWidth=1;ctx!.stroke();}
 ctx!.fillStyle='rgba(150,160,185,.5)';ctx!.font='9px Inter, sans-serif';ctx!.fillText('30 DAYS AGO',18,height-5);ctx!.textAlign='right';ctx!.fillText('TODAY',width-18,height-5);ctx!.textAlign='left';
 };
 const pick=(event:PointerEvent)=>{const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,index=Math.max(0,Math.min(points.length-1,Math.round((x-18)/Math.max(1,width-36)*(points.length-1))));hover=index;beamX=nodes[index]?.x??x;setSelected(index);draw();};
 const move=(event:PointerEvent)=>{if(event.pointerType==='touch'&&event.buttons===0)return;pick(event);};
 const leave=()=>{hover=-1;beamX=-1;draw();};
 const visibility=()=>{visible=!document.hidden;if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}else if(visible)draw();};
 const observer=new ResizeObserver(resize);observer.observe(canvas);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);pick(event);});canvas.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);resize();
 return()=>{if(raf)cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);};
 },[points,reduced]);
 const chosen=points[selected]||points[points.length-1];
 return <section className="atlas-rhythm-constellation" aria-label="Thirty day rhythm constellation">
  <div className="atlas-rhythm-constellation__heading"><div><span className="eyebrow">YOUR LAST 30 DAYS</span><h2>Rhythm constellation</h2><p>Recorded prayers and completed habits, connected day by day.</p></div><span className="atlas-rhythm-constellation__total">{points.filter(p=>p.count>0).length}<small>active days</small></span></div>
  <canvas ref={canvasRef} aria-label="Interactive 30-day activity ribbon. Tap or drag across a day to inspect its recorded activity."/>
  <div className="atlas-rhythm-constellation__detail" aria-live="polite">{chosen?<><b>{dayLabel(chosen.date)}</b><span>{chosen.prayers} prayers · {chosen.habits} habits</span><strong>{chosen.streak} day streak chain</strong></>:<span>{history.isLoading?'Reading your activity history…':'No activity recorded in this period yet.'}</span>}</div>
  <p className="atlas-rhythm-constellation__hint">Tap or drag across the ribbon to inspect a day.</p>
  {history.isError&&<p className="muted">Your activity history is temporarily unavailable.</p>}
 </section>;
}

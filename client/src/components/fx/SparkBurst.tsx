import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
const EVENT='atlas:spark-burst';
let lastBurstAt=0,combo=0;
export function triggerSparkBurst(x:number,y:number){
 const now=Date.now();combo=now-lastBurstAt<=8000?Math.min(3,combo+1):1;lastBurstAt=now;
 window.dispatchEvent(new CustomEvent(EVENT,{detail:{x,y,combo,count:combo===1?14:combo===2?24:36}}));
}
type Particle={x:number;y:number;vx:number;vy:number;life:number;size:number;white:boolean;color:string};
export function SparkBurst(){
 const ref=useRef<HTMLCanvasElement>(null),reduce=useReducedMotion();
 useEffect(()=>{const canvas=ref.current;if(!canvas||reduce)return;const ctx=canvas.getContext('2d');if(!ctx)return;let raf=0,particles:Particle[]=[],visible=!document.hidden;
 const resize=()=>{const d=Math.min(devicePixelRatio||1,1.5);canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);};
 const draw=()=>{raf=0;if(!visible)return;ctx.clearRect(0,0,innerWidth,innerHeight);particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vx*=.9;p.vy=p.vy*.9+.055;p.life-=.045;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.white?'#fff':p.color;ctx.shadowBlur=8;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;ctx.shadowBlur=0;if(particles.length)raf=requestAnimationFrame(draw);};
 const burst=(e:Event)=>{const d=(e as CustomEvent<{x:number;y:number;count?:number}>).detail||{x:innerWidth/2,y:innerHeight/2};const count=d.count||14,color=getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()||'#a5a5ff';for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=2.5+Math.random()*4;particles.push({x:d.x,y:d.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,size:.8+Math.random()*1.7,white:Math.random()>.78,color});}if(visible&&!raf)raf=requestAnimationFrame(draw);};
 const visibility=()=>{visible=!document.hidden;if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}else if(visible&&particles.length&&!raf)raf=requestAnimationFrame(draw);};
 window.addEventListener('resize',resize,{passive:true});window.addEventListener(EVENT,burst);document.addEventListener('visibilitychange',visibility);resize();
 return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);window.removeEventListener(EVENT,burst);document.removeEventListener('visibilitychange',visibility);};
 },[reduce]);
 return <canvas ref={ref} className="atlas-spark-burst" aria-hidden="true"/>;
}

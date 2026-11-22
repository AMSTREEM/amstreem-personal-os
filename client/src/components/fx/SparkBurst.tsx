import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
const EVENT='atlas:spark-burst';
export function triggerSparkBurst(x:number,y:number){window.dispatchEvent(new CustomEvent(EVENT,{detail:{x,y}}));}
type Particle={x:number;y:number;vx:number;vy:number;life:number;size:number;white:boolean;color:string};
export function SparkBurst(){
 const ref=useRef<HTMLCanvasElement>(null),reduce=useReducedMotion();
 useEffect(()=>{const canvas=ref.current;if(!canvas||reduce)return;const ctx=canvas.getContext('2d');if(!ctx)return;let raf=0,particles:Particle[]=[];
 const resize=()=>{const d=Math.min(devicePixelRatio||1,1.5);canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);};const draw=()=>{raf=0;ctx.clearRect(0,0,innerWidth,innerHeight);particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vx*=.9;p.vy=p.vy*.9+.055;p.life-=.045;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.white?'#fff':p.color;ctx.shadowBlur=8;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;ctx.shadowBlur=0;if(particles.length)raf=requestAnimationFrame(draw);};
 const burst=(e:Event)=>{const {x,y}=(e as CustomEvent).detail||{};for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,v=2.5+Math.random()*4;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,size:.8+Math.random()*1.7,white:Math.random()>.72,color:getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()||'#a5a5ff'});}if(!raf)raf=requestAnimationFrame(draw);};
 const onResize=()=>resize();window.addEventListener('resize',onResize,{passive:true});window.addEventListener(EVENT,burst);resize();return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',onResize);window.removeEventListener(EVENT,burst);};
 },[reduce]);
 return <canvas ref={ref} className="atlas-spark-burst" aria-hidden="true"/>;
}

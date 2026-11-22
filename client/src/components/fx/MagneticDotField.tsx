import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
export function MagneticDotField(){
 const ref=useRef<HTMLCanvasElement>(null);const reduced=useReducedMotion();
 useEffect(()=>{const c=ref.current;if(!c||reduced||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;const ctx=c.getContext('2d',{alpha:true});if(!ctx)return;let raf=0,mx=-1000,my=-1000,w=0,h=0;
 const resize=()=>{const d=Math.min(devicePixelRatio||1,1.5);w=c.clientWidth;h=c.clientHeight;c.width=Math.max(1,w*d);c.height=Math.max(1,h*d);ctx.setTransform(d,0,0,d,0,0);};
 const move=(e:PointerEvent)=>{mx=e.clientX-c.getBoundingClientRect().left;my=e.clientY-c.getBoundingClientRect().top;if(!raf)raf=requestAnimationFrame(draw);};
 const draw=()=>{raf=0;ctx.clearRect(0,0,w,h);const style=getComputedStyle(document.documentElement),accent=style.getPropertyValue('--accent-primary').trim()||'#8b8cf6',muted=style.getPropertyValue('--text-muted').trim()||'#9298a5';ctx.fillStyle=muted;for(let y=13;y<h;y+=26)for(let x=13;x<w;x+=26){const dx=x-mx,dy=y-my,d=Math.hypot(dx,dy);let px=x,py=y,a=.14;if(d<130){const k=(1-d/130);px+=dx/(d||1)*k*9;py+=dy/(d||1)*k*9;a=.14+k*.41;ctx.fillStyle=accent;}else ctx.fillStyle=muted;ctx.globalAlpha=a;ctx.beginPath();ctx.arc(px,py,1.2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;};
 resize();draw();const ro=new ResizeObserver(resize);ro.observe(c);window.addEventListener('pointermove',move,{passive:true});const leave=()=>{mx=-1000;my=-1000;if(!raf)raf=requestAnimationFrame(draw);};window.addEventListener('blur',leave,{passive:true});return()=>{cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('pointermove',move);window.removeEventListener('blur',leave);};
 },[reduced]);
 return <canvas ref={ref} aria-hidden="true" className="atlas-dot-field"/>;
}

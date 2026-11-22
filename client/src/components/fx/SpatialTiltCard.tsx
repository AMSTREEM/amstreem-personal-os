import { useEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
export function SpatialTiltCard({children,className='',id}:{children:ReactNode;className?:string;id?:string}){
 const ref=useRef<HTMLDivElement>(null),reduce=useReducedMotion();
 useEffect(()=>{const el=ref.current;if(!el||reduce||!matchMedia('(hover: hover) and (pointer: fine)').matches)return;let raf=0,x=0,y=0;
 const move=(e:PointerEvent)=>{x=e.clientX;y=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;const r=el.getBoundingClientRect(),nx=(x-r.left)/r.width,ny=(y-r.top)/r.height;el.style.setProperty('--rx',((.5-ny)*9)+'deg');el.style.setProperty('--ry',((nx-.5)*9)+'deg');el.style.setProperty('--foil-x',(nx*100)+'%');el.style.setProperty('--foil-y',(ny*100)+'%');});};
 const reset=()=>{cancelAnimationFrame(raf);raf=0;el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg');};el.addEventListener('pointermove',move,{passive:true});el.addEventListener('pointerleave',reset,{passive:true});return()=>{cancelAnimationFrame(raf);el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',reset);reset();};
 },[reduce]);
 return <div ref={ref} id={id} className={'atlas-spatial-tilt '+className}>{children}<span className="atlas-spatial-tilt__foil" aria-hidden="true"/></div>;
}

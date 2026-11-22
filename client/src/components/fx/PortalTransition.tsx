import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
let origin:{x:number;y:number}|null=null;
export function setPortalOrigin(x:number,y:number){origin={x,y};}
export function PortalTransition({children}:{children:ReactNode}){
 const location=useLocation(),reduce=useReducedMotion(),[point,setPoint]=useState({x:innerWidth/2,y:innerHeight/2}),[active,setActive]=useState(false),first=useRef(true);
 useEffect(()=>{if(first.current){first.current=false;return;}setPoint(origin||{x:innerWidth/2,y:innerHeight/2});origin=null;setActive(true);const id=window.setTimeout(()=>setActive(false),380);return()=>clearTimeout(id);},[location.pathname]);
 const radius=Math.max(innerWidth,innerHeight)*1.7;
 return <motion.div key={location.pathname} className="atlas-portal-room" initial={reduce||!active?false:{clipPath:`circle(0px at ${point.x}px ${point.y}px)`}} animate={{clipPath:active&&!reduce?`circle(${radius}px at ${point.x}px ${point.y}px)`:'circle(150vmax at 50% 50%)'}} transition={reduce?{duration:0}:{duration:.34,ease:[.16,1,.3,1]}} onAnimationComplete={()=>setActive(false)}>{children}</motion.div>;
}

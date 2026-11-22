import { useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
let origin:{x:number;y:number}|null=null;
export function setPortalOrigin(x:number,y:number){origin={x,y};}
export function PortalTransition({children}:{children:ReactNode}){
 const location=useLocation(),reduce=useReducedMotion(),first=useRef(true),node=useRef<HTMLDivElement>(null);
 const initialPage=first.current;first.current=false;
 const point=origin||{x:window.innerWidth/2,y:window.innerHeight/2};origin=null;
 const radius=Math.max(window.innerWidth,window.innerHeight)*1.7;
 return <motion.div ref={node} key={location.pathname} className="atlas-portal-room" initial={reduce||initialPage?false:{clipPath:`circle(0px at ${point.x}px ${point.y}px)`}} animate={{clipPath:`circle(${radius}px at ${point.x}px ${point.y}px)`}} transition={reduce?{duration:0}:{duration:.34,ease:[.16,1,.3,1]}} onAnimationComplete={()=>{if(node.current)node.current.style.clipPath='none';}}>{children}</motion.div>;
}

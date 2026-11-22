import { motion, useReducedMotion } from 'motion/react';
export function KineticText({text,className='',delay=0}:{text:string;className?:string;delay?:number}){
 const reduce=useReducedMotion();
 return <span className={'atlas-kinetic-text '+className} aria-label={text}>{Array.from(text).map((char,i)=><span className="atlas-kinetic-char-mask" key={i} aria-hidden="true"><motion.span initial={reduce?false:{y:'105%',opacity:0,fontWeight:250}} animate={{y:'0%',opacity:1,fontWeight:700}} transition={reduce?{duration:0}:{duration:.3,delay:delay+i*.016,ease:[.16,1,.3,1]}}>{char===' '?'\u00a0':char}</motion.span></span>)}</span>;
}

import { motion, useReducedMotion } from 'motion/react';
export function OdometerNumber({value,className='',suffix=''}:{value:number|string;className?:string;suffix?:string}){
 const reduce=useReducedMotion(),text=String(value);
 return <span className={'atlas-odometer-number '+className} aria-label={text+suffix}>{Array.from(text).map((char,i)=>/^\\d$/.test(char)?<span className="atlas-odometer-number__slot" key={i} aria-hidden="true"><motion.span className="atlas-odometer-number__stack" animate={{y:`-${Number(char)*10}%`}} transition={reduce?{duration:0}:{type:'spring',stiffness:420,damping:32}}>{'0123456789'.split('').map(n=><span key={n}>{n}</span>)}</motion.span></span>:<span key={i} aria-hidden="true">{char}</span>)}{suffix}</span>;
}

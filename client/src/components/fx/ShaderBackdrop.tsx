import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

type Props = { className?: string; fixed?: boolean; intensity?: number };
const vertex = `#version 300 es
in vec2 position;
out vec2 v_uv;
void main(){ v_uv=position*.5+.5; gl_Position=vec4(position,0.,1.); }`;
const fragment = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 outColor;
uniform vec2 u_resolution; uniform float u_time; uniform vec2 u_mouse; uniform vec3 u_accent; uniform float u_light;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+17.1;a*=.5;}return v;}
void main(){
 vec2 uv=v_uv; vec2 p=(uv-.5)*vec2(u_resolution.x/u_resolution.y,1.);
 vec2 m=(u_mouse-.5)*.22; float t=u_time*.11;
 float warp=fbm(p*2.2+vec2(t,-t)+m); vec2 q=p+vec2(warp-.5,fbm(p*2.0-vec2(t*.7,t)+m)-.5)*.72;
 float n=fbm(q*3.1+vec2(t*.8,-t*.6)); float filament=smoothstep(.58,.88,fbm(q*5.0+vec2(-t,t*.7)));
 float glow=smoothstep(.74,.12,length(q-vec2(-.22,.08)))*.55+smoothstep(.68,.08,length(q-vec2(.35,-.18)))*.34;
 vec3 base=mix(vec3(.012,.018,.03),vec3(.94,.945,.94),u_light);
 vec3 tint=mix(u_accent,vec3(.72,.82,.91),u_light);
 float alpha=(.035+glow*.11+filament*(u_light>.5?.12:.14))*(.55+n*.45);
 vec3 color=mix(base,tint,alpha);
 outColor=vec4(color,1.0);
}`;
function compile(gl: WebGL2RenderingContext, type: number, source: string) { const shader=gl.createShader(type); if(!shader)return null; gl.shaderSource(shader,source); gl.compileShader(shader); if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;} return shader; }
export function ShaderBackdrop({className='',fixed=false,intensity=1}:Props){
 const canvas=useRef<HTMLCanvasElement>(null); const reduced=useReducedMotion(); const [fallback,setFallback]=useState(false);
 useEffect(()=>{
  const node=canvas.current;if(!node||reduced)return;
  const gl=node.getContext('webgl2',{alpha:true,antialias:false,powerPreference:'low-power'});
  if(!gl){setFallback(true);return;}
  const vs=compile(gl,gl.VERTEX_SHADER,vertex),fs=compile(gl,gl.FRAGMENT_SHADER,fragment);
  if(!vs||!fs){setFallback(true);return;}
  const program=gl.createProgram();if(!program){setFallback(true);return;}gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);setFallback(true);return;}
  const buffer=gl.createBuffer();if(!buffer){gl.deleteProgram(program);setFallback(true);return;}
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  gl.useProgram(program);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  const resolution=gl.getUniformLocation(program,'u_resolution'),time=gl.getUniformLocation(program,'u_time'),mouse=gl.getUniformLocation(program,'u_mouse'),accent=gl.getUniformLocation(program,'u_accent'),light=gl.getUniformLocation(program,'u_light');
  let raf=0,start=performance.now(),mx=.5,my=.5,tx=.5,ty=.5,visible=!document.hidden,disposed=false;
  const readTheme=()=>{const s=getComputedStyle(document.documentElement);const raw=s.getPropertyValue('--accent-primary').trim()||s.getPropertyValue('--accent').trim()||'#8b8cf6';const c=document.createElement('canvas').getContext('2d');if(!c)return; c.fillStyle=raw;const rgb=c.fillStyle.match(/\d+/g);if(rgb?.length){gl!.useProgram(program);gl!.uniform3f(accent,Number(rgb[0])/255,Number(rgb[1])/255,Number(rgb[2])/255);}gl!.uniform1f(light,document.documentElement.getAttribute('data-theme')?.startsWith('light-')?1:0);};
  const resize=()=>{const d=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(1,Math.floor(node.clientWidth*d)),h=Math.max(1,Math.floor(node.clientHeight*d));if(node.width!==w||node.height!==h){node.width=w;node.height=h;gl!.viewport(0,0,w,h);gl!.uniform2f(resolution,w,h);}};
  const pointer=(e:PointerEvent)=>{tx=e.clientX/Math.max(1,innerWidth);ty=1-e.clientY/Math.max(1,innerHeight);};
  const draw=(now:number)=>{if(disposed||!visible)return;resize();mx+=(tx-mx)*.08;my+=(ty-my)*.08;gl!.useProgram(program);gl!.uniform1f(time,(now-start)/1000);gl!.uniform2f(mouse,mx,my);gl!.drawArrays(gl!.TRIANGLES,0,6);raf=requestAnimationFrame(draw);};
  const visibility=()=>{visible=!document.hidden;if(visible&&!raf)raf=requestAnimationFrame(draw);else if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}};
  const observer=new MutationObserver(readTheme);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  window.addEventListener('resize',resize,{passive:true});window.addEventListener('pointermove',pointer,{passive:true});document.addEventListener('visibilitychange',visibility);readTheme();resize();raf=requestAnimationFrame(draw);
  return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('pointermove',pointer);document.removeEventListener('visibilitychange',visibility);gl!.deleteBuffer(buffer);gl!.deleteProgram(program);gl!.deleteShader(vs);gl!.deleteShader(fs);};
 },[reduced]);
 return <canvas ref={canvas} aria-hidden="true" className={'atlas-shader-backdrop '+className+(fallback?' is-fallback':'')} style={{position:fixed?'fixed':'absolute',inset:0,pointerEvents:'none',zIndex:0,opacity:intensity}}/>;
}

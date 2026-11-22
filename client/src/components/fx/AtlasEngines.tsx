import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

const vertex = `#version 300 es
in vec2 position;
out vec2 uv;
void main(){ uv=position*.5+.5; gl_Position=vec4(position,0.,1.); }`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader=gl.createShader(type); if(!shader) return null;
  gl.shaderSource(shader,source); gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}
  return shader;
}
function mountShader(canvas: HTMLCanvasElement, fragment: string, cap: number, onFrame: (gl:WebGL2RenderingContext,p:WebGLProgram,t:number,w:number,h:number)=>void) {
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,powerPreference:'low-power'});
  if(!gl) return ()=>{};
  const vs=compile(gl,gl.VERTEX_SHADER,vertex), fs=compile(gl,gl.FRAGMENT_SHADER,fragment);
  if(!vs||!fs){if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);return ()=>{};}
  const program=gl.createProgram(); if(!program){gl.deleteShader(vs);gl.deleteShader(fs);return ()=>{};}
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return ()=>{};}
  const buffer=gl.createBuffer(); if(!buffer){gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);return ()=>{};}
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  gl.useProgram(program);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  let raf=0,visible=!document.hidden,disposed=false,start=performance.now(),intersecting=true;
  const resize=()=>{const d=Math.min(window.devicePixelRatio||1,cap);const w=Math.max(1,Math.floor(canvas.clientWidth*d)),h=Math.max(1,Math.floor(canvas.clientHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl!.viewport(0,0,w,h);}};
  const draw=(now:number)=>{raf=0;if(disposed||!visible||!intersecting)return;resize();onFrame(gl!,program,(now-start)/1000,canvas.width,canvas.height);gl!.drawArrays(gl!.TRIANGLES,0,6);raf=requestAnimationFrame(draw);};
  const wake=()=>{if(!raf&&visible&&intersecting&&!disposed)raf=requestAnimationFrame(draw);};
  const visibility=()=>{visible=!document.hidden;if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}else wake();};
  const observer=new IntersectionObserver(entries=>{intersecting=!!entries[0]?.isIntersecting;if(!intersecting&&raf){cancelAnimationFrame(raf);raf=0;}else wake();});
  observer.observe(canvas);document.addEventListener('visibilitychange',visibility);window.addEventListener('resize',resize,{passive:true});resize();wake();
  return ()=>{disposed=true;if(raf)cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('resize',resize);gl!.deleteBuffer(buffer);gl!.deleteProgram(program);gl!.deleteShader(vs);gl!.deleteShader(fs);};
}

const fluidFragment = `#version 300 es
precision highp float; in vec2 uv; out vec4 color;
uniform vec2 resolution; uniform float time; uniform vec2 pointer; uniform float active; uniform vec3 accent;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=noise(p)*a;p=p*2.02+13.7;a*=.5;}return v;}
void main(){vec2 p=(uv-.5)*vec2(resolution.x/max(1.,resolution.y),1.);vec2 m=(pointer-.5)*vec2(resolution.x/max(1.,resolution.y),1.);float t=time*.13;
vec2 q=p;for(int i=0;i<4;i++){float n=fbm(q*2.8+vec2(t,-t*.7));float a=fbm(q*3.4+vec2(-t*.6,t)+n);q+=vec2(n-.5,a-.5)*.19;}
vec2 d=q-m;float swirl=atan(d.y,d.x)+length(d)*4.5-t*1.7;float ink=fbm(vec2(cos(swirl),sin(swirl))*3.2+q*5.0+t*.3);
float plume=exp(-length(d)*3.0)*(0.5+0.5*sin(swirl*3.0))*active;float filaments=smoothstep(.53,.78,ink+plume*.32);
vec3 base=vec3(.008,.014,.027);vec3 cyan=vec3(.08,.72,.83);
float glow=filaments*.72+plume*.18;vec3 col=mix(base,mix(accent,cyan,clamp(ink,0.,1.)),glow);
col+=vec3(.025,.035,.07)*fbm(q*7.);color=vec4(col,1.);}`;

export function AuthFluidInk() {
  const ref=useRef<HTMLCanvasElement>(null), reduced=useReducedMotion();
  useEffect(()=>{const node=ref.current;if(!node||reduced)return;let px=.5,py=.5,tx=.5,ty=.5,accentColor:[number,number,number]=[.55,.55,.96];
    const readAccent=()=>{const raw=getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()||getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#8b8cf6';const parser=document.createElement('canvas').getContext('2d');if(!parser)return;parser.fillStyle=raw;const value=parser.fillStyle;const hex=value.match(/^#([0-9a-f]{6})$/i);if(hex)accentColor=[parseInt(hex[1].slice(0,2),16)/255,parseInt(hex[1].slice(2,4),16)/255,parseInt(hex[1].slice(4,6),16)/255];else{const rgb=value.match(/\d+(?:\.\d+)?/g);if(rgb&&rgb.length>=3)accentColor=[Number(rgb[0])/255,Number(rgb[1])/255,Number(rgb[2])/255];}};readAccent();const themeObserver=new MutationObserver(readAccent);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','style']});
    const pointer=(e:PointerEvent)=>{tx=e.clientX/innerWidth;ty=1-e.clientY/innerHeight;};
    window.addEventListener('pointermove',pointer,{passive:true});
    const dispose=mountShader(node,fluidFragment,1.5,(gl,p,t,w,h)=>{px+=(tx-px)*.08;py+=(ty-py)*.08;gl.uniform2f(gl.getUniformLocation(p,'resolution'),w,h);gl.uniform1f(gl.getUniformLocation(p,'time'),t);gl.uniform2f(gl.getUniformLocation(p,'pointer'),px,py);gl.uniform1f(gl.getUniformLocation(p,'active'),1);gl.uniform3f(gl.getUniformLocation(p,'accent'),accentColor[0],accentColor[1],accentColor[2]);});
    return()=>{window.removeEventListener('pointermove',pointer);themeObserver.disconnect();dispose();};
  },[reduced]);
  return <canvas ref={ref} aria-hidden="true" className="atlas-fluid-ink" style={{position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0,opacity:.92,background:'radial-gradient(ellipse at 48% 45%, rgba(72,92,170,.2), rgba(5,9,22,0) 68%)'}}/>;
}

const metalFragment = `#version 300 es
precision highp float;in vec2 uv;out vec4 color;uniform vec2 resolution;uniform float time;uniform vec2 tilt;uniform float pulse;
float field(vec3 p){float a=length(p)-.62;float b=length(p-vec3(.28*sin(time*.7),.2*cos(time*.55),.08))-.34;float c=length(p-vec3(-.28*cos(time*.5),-.18*sin(time*.8),-.08))-.29;float k=.18;float h=clamp(.5+.5*(b-a)/k,0.,1.);float s=mix(b,a,h)-k*h*(1.-h);h=clamp(.5+.5*(c-s)/k,0.,1.);return mix(c,s,h)-k*h*(1.-h);}
vec3 normal(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(field(p+e.xyy)-field(p-e.xyy),field(p+e.yxy)-field(p-e.yxy),field(p+e.yyx)-field(p-e.yyx)));}
void main(){vec2 p=(uv-.5)*2.;p.x*=resolution.x/resolution.y;vec3 ro=vec3(tilt.x*.42,tilt.y*.42,2.7),rd=normalize(vec3(p-tilt*.12,-1.65));float d=0.,hit=-1.;for(int i=0;i<72;i++){vec3 pos=ro+rd*d;float h=field(pos);if(h<.002){hit=d;break;}d+=max(.006,h*.72);if(d>5.)break;}
vec3 col=vec3(.018,.025,.044);if(hit>0.){vec3 pos=ro+rd*hit,n=normal(pos),light=normalize(vec3(-.55,.8,1.));float diff=max(dot(n,light),0.);float spec=pow(max(dot(reflect(-light,n),-rd),0.),42.);float rim=pow(1.-max(dot(n,-rd),0.),3.);float bands=.5+.5*sin((pos.x+pos.y)*18.+time*1.4);vec3 steel=mix(vec3(.18,.25,.36),vec3(.72,.82,.94),bands*.28+diff*.42);col=steel*(.18+diff*.9)+vec3(.35,.62,.98)*spec*(.85+pulse*.35)+vec3(.12,.35,.65)*rim*(.45+pulse*.18);}
float vignette=1.-smoothstep(.65,1.25,length(p));color=vec4(col,vignette);}`;

export function FerrofluidCore({ className='', active=false }: {className?:string;active?:boolean}) {
  const ref=useRef<HTMLCanvasElement>(null),reduced=useReducedMotion();
  useEffect(()=>{const node=ref.current;if(!node||reduced)return;let tx=0,ty=0;const pointer=(event:PointerEvent)=>{const r=node.getBoundingClientRect();tx=Math.max(-1,Math.min(1,((event.clientX-r.left)/Math.max(1,r.width)-.5)*2));ty=Math.max(-1,Math.min(1,(.5-(event.clientY-r.top)/Math.max(1,r.height))*2));};window.addEventListener('pointermove',pointer,{passive:true});const dispose=mountShader(node,metalFragment,1.25,(gl,p,t,w,h)=>{gl.uniform2f(gl.getUniformLocation(p,'resolution'),w,h);gl.uniform1f(gl.getUniformLocation(p,'time'),t);gl.uniform2f(gl.getUniformLocation(p,'tilt'),tx,ty);gl.uniform1f(gl.getUniformLocation(p,'pulse'),active?(0.5+0.5*Math.sin(t*3.2)):0);});return()=>{window.removeEventListener('pointermove',pointer);dispose();};},[reduced,active]);
  return <canvas ref={ref} aria-hidden="true" className={'atlas-ferrofluid-core '+className} style={{display:'block',width:240,height:240,maxWidth:'100%',aspectRatio:'1',pointerEvents:'none',background:'radial-gradient(circle at 50% 48%, rgba(72,92,170,.24), rgba(5,9,22,0) 70%)'}}/>;
}

type ConstellationNode={id:string;label:string;kind:'goal'|'project'|'learning';goalId:number|null};
export function LifeConstellation({goals,projects,paths}:{goals:{id:number;title:string}[];projects:{id:number;title:string;goal_id:number|null}[];paths:{id:number;title:string;goal_id:number|null}[]}) {
  const ref=useRef<HTMLCanvasElement>(null),reduced=useReducedMotion();
  useEffect(()=>{const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
    const nodes: (ConstellationNode&{x:number;y:number;vx:number;vy:number;fx:number|null;fy:number|null})[]=[
      ...goals.map(x=>({id:'g'+x.id,label:x.title,kind:'goal' as const,goalId:x.id,x:0,y:0,vx:0,vy:0,fx:null,fy:null})),
      ...projects.map(x=>({id:'p'+x.id,label:x.title,kind:'project' as const,goalId:x.goal_id,x:0,y:0,vx:0,vy:0,fx:null,fy:null})),
      ...paths.map(x=>({id:'l'+x.id,label:x.title,kind:'learning' as const,goalId:x.goal_id,x:0,y:0,vx:0,vy:0,fx:null,fy:null}))
    ].slice(0,48);
    let width=0,height=280,raf=0,drag=-1,hover=-1,selected=-1,lastMove=0,downX=0,downY=0;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,1.5);width=Math.max(320,canvas.clientWidth);height=280;canvas.width=Math.floor(width*d);canvas.height=Math.floor(height*d);ctx!.setTransform(d,0,0,d,0,0);nodes.forEach((n,i)=>{if(!n.x){const a=i/Math.max(1,nodes.length)*Math.PI*2;n.x=width/2+Math.cos(a)*(70+i%4*12);n.y=height/2+Math.sin(a)*(65+i%3*10);}});wake();};
    const links:[number,number][]=[];nodes.forEach((n,i)=>{if(n.kind==='goal')return;const parent=nodes.findIndex(g=>g.kind==='goal'&&g.goalId===n.goalId);if(parent>=0)links.push([i,parent]);});
    const wake=()=>{if(!reduced&&!raf)raf=requestAnimationFrame(draw);};
    const draw=()=>{raf=0;ctx!.clearRect(0,0,width,height);for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.max(1,Math.hypot(dx,dy)),force=(dist-112)*.0008;a.vx+=dx/dist*force;b.vx-=dx/dist*force;a.vy+=dy/dist*force;b.vy-=dy/dist*force;if(dist<135){ctx!.strokeStyle='rgba(135,160,220,'+(1-dist/150)*.24+')';ctx!.lineWidth=1;ctx!.beginPath();ctx!.moveTo(a.x,a.y);ctx!.lineTo(b.x,b.y);ctx!.stroke();}}
      links.forEach(([a,b])=>{ctx!.strokeStyle='rgba(125,145,255,.5)';ctx!.lineWidth=1.2;ctx!.beginPath();ctx!.moveTo(nodes[a].x,nodes[a].y);ctx!.lineTo(nodes[b].x,nodes[b].y);ctx!.stroke();});
      let energy=0;nodes.forEach((n,i)=>{if(n.fx!==null){n.x=n.fx;n.y=n.fy??n.y;}else{n.vx+=(width/2-n.x)*.0008;n.vy+=(height/2-n.y)*.0008;n.vx*=.91;n.vy*=.91;n.x+=n.vx;n.y+=n.vy;}energy+=Math.abs(n.vx)+Math.abs(n.vy);ctx!.beginPath();ctx!.fillStyle=n.kind==='goal'?'#9b9cff':n.kind==='project'?'#6dc8d6':'#d2b3ff';if(i===selected){ctx!.strokeStyle='rgba(225,232,255,.95)';ctx!.lineWidth=1.5;ctx!.beginPath();ctx!.arc(n.x,n.y,12,0,Math.PI*2);ctx!.stroke();}ctx!.shadowBlur=i===hover?16:7;ctx!.shadowColor=String(ctx!.fillStyle);ctx!.arc(n.x,n.y,n.kind==='goal'?6:4,0,Math.PI*2);ctx!.fill();ctx!.shadowBlur=0;if(i===hover||n.kind==='goal'){ctx!.font='11px Inter, sans-serif';ctx!.fillStyle='rgba(230,235,250,.9)';ctx!.fillText(n.label.slice(0,25),n.x+9,n.y-8);}});
      if(!reduced&&(energy>.08||drag>=0||performance.now()-lastMove<900))raf=requestAnimationFrame(draw);else { /* settled: wait for pointer input */ }};
    const point=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    const move=(e:PointerEvent)=>{const p=point(e);lastMove=performance.now();if(drag>=0){nodes[drag].fx=p.x;nodes[drag].fy=p.y;nodes[drag].x=p.x;nodes[drag].y=p.y;}else{const next=nodes.findIndex(n=>Math.hypot(n.x-p.x,n.y-p.y)<16);if(next!==hover){hover=next;canvas.style.cursor=hover>=0?'grab':'default';} }wake();};
    const down=(e:PointerEvent)=>{const p=point(e);downX=p.x;downY=p.y;drag=nodes.findIndex(n=>Math.hypot(n.x-p.x,n.y-p.y)<18);if(drag>=0){nodes[drag].fx=p.x;nodes[drag].fy=p.y;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';}};
    const up=(e?:PointerEvent)=>{if(drag>=0){const p=e?point(e):{x:downX,y:downY};if(Math.hypot(p.x-downX,p.y-downY)<5)selected=drag;nodes[drag].fx=null;nodes[drag].fy=null;drag=-1;canvas.style.cursor='grab';wake();}};
    const cancel=()=>up();const leave=()=>{hover=-1;up();};
    const observer=new ResizeObserver(resize);observer.observe(canvas);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('pointerleave',leave);const vis=()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else if(!document.hidden)wake();};document.addEventListener('visibilitychange',vis);resize();if(reduced)draw();
    return()=>{if(raf)cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',vis);};
  },[goals,projects,paths,reduced]);
  return <section className="atlas-constellation" style={{border:"1px solid var(--border-subtle, rgba(150,160,190,.18))",borderRadius:20,padding:20,background:"var(--surface-raised, rgba(18,22,34,.55))"}}><div className="atlas-constellation__heading" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}><div><span className="eyebrow">THE LIVING SYSTEM</span><h2>Life Constellation</h2><p>Goals anchor the work. Projects and learning paths become the connected stars.</p></div><span>{goals.length} goals · {projects.length} projects · {paths.length} paths</span></div><canvas ref={ref} aria-label="Interactive life constellation. Drag nodes to explore connected goals, projects and learning paths." style={{display:'block',width:'100%',height:280,touchAction:'pan-y',cursor:'grab'}}/></section>;
}

const vortexEvent='atlas:energy-vortex';
export function triggerEnergyVortex(x:number,y:number){window.dispatchEvent(new CustomEvent(vortexEvent,{detail:{x,y}}));}
type Particle={a:number;r:number;speed:number;size:number;life:number;twist:number};
export function EnergyVortex(){
  const ref=useRef<HTMLCanvasElement>(null),reduced=useReducedMotion();
  useEffect(()=>{const canvas=ref.current;if(!canvas||reduced)return;const ctx=canvas.getContext('2d');if(!ctx)return;let raf=0,particles:Particle[]=[],started=0;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.floor(innerWidth*d);canvas.height=Math.floor(innerHeight*d);ctx!.setTransform(d,0,0,d,0,0);};
    const draw=(now:number)=>{raf=0;const elapsed=now-started;ctx!.clearRect(0,0,innerWidth,innerHeight);particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.a+=p.speed;p.r*=.994;p.life-=16/600;const x=canvas.dataset.cx?Number(canvas.dataset.cx):innerWidth/2,y=canvas.dataset.cy?Number(canvas.dataset.cy):innerHeight/2;const px=x+Math.cos(p.a+p.twist*elapsed/600)*p.r,py=y+Math.sin(p.a+p.twist*elapsed/600)*p.r;ctx!.globalAlpha=Math.max(0,p.life)*.8;ctx!.fillStyle=p.size>2?'#d6e3ff':'#8f9aff';ctx!.shadowBlur=10;ctx!.shadowColor='#8296ff';ctx!.beginPath();ctx!.arc(px,py,p.size,0,Math.PI*2);ctx!.fill();});ctx!.globalAlpha=1;ctx!.shadowBlur=0;if(particles.length&&elapsed<600)raf=requestAnimationFrame(draw);else{particles=[];ctx!.clearRect(0,0,innerWidth,innerHeight);}};
    const burst=(e:Event)=>{const d=(e as CustomEvent<{x:number;y:number}>).detail;if(!d)return;canvas.dataset.cx=String(d.x);canvas.dataset.cy=String(d.y);started=performance.now();particles=Array.from({length:180},(_,i)=>({a:i/180*Math.PI*2,r:12+Math.random()*150,speed:.035+Math.random()*.05,size:.7+Math.random()*2.2,life:1,twist:(Math.random()-.5)*5}));if(!raf)raf=requestAnimationFrame(draw);};
    const vis=()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else if(!document.hidden&&particles.length)raf=requestAnimationFrame(draw);};
    window.addEventListener(vortexEvent,burst);window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',vis);resize();
    return()=>{if(raf)cancelAnimationFrame(raf);window.removeEventListener(vortexEvent,burst);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',vis);};
  },[reduced]);
  return <canvas ref={ref} aria-hidden="true" className="atlas-energy-vortex" style={{position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:90}}/>;
}

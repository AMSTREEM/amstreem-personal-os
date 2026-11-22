import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Cascade } from './Cascade';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, ChevronDown, Circle, Clock3, Pause, Play, Plus, RotateCcw, Timer, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, json } from '../lib/api';
import { Button, Card, EmptyState, Field, TextArea, TextInput } from './ui';
import { playAtlasFeedback, primeAtlasAudio } from '../lib/microFeedback';
import { useFocusTimer, updateFocusTimer } from '../lib/focusTimerStore';
import { SpatialTiltCard } from './fx/SpatialTiltCard';
import { FocusSonar } from './fx/FocusSonar';
import { OdometerNumber } from './fx/OdometerNumber';
import { triggerSparkBurst } from './fx/SparkBurst';
import { FerrofluidCore, triggerEnergyVortex } from './fx/AtlasEngines';
import { AstrolabeRings } from './fx/FlagshipInstruments';

type Task = { id:number; title:string; detail:string; done:number; priority:number; due_date:string|null; project_id:number|null; goal_id:number|null; project_title?:string|null; goal_title?:string|null; parent_task_id:number|null; focus_minutes:number; subtask_count:number };
type Project = { id:number; title:string; goal_id:number|null; goal_title?:string|null; target_date:string|null; open_tasks:number; focus_minutes:number; progress_pct:number };
type Goal = { id:number; title:string };
type Lesson = { id:number; title:string; status:string; study_minutes:number };
type LearningPath = { id:number; title:string; goal_id:number|null; lessons:Lesson[] };
type Session = { id:number; session_date:string; minutes:number; focus:string; reflection:string; task_title?:string|null; project_title?:string|null; lesson_title?:string|null; path_title?:string|null; distractions?:string[] };
type TimerState = { remaining:number; deadline:number|null; durationSeconds:number; kind:'focus'|'break'; taskId:string; lessonId:string; projectId:string; focus:string; notes:string; distractions:string[]; sessionKey:string|null; startedAt:number|null };
const priorityLabels:Record<number,string>={1:'Urgent',2:'High',3:'Normal',4:'Low'};
const priorityClass=(value:number)=>'execution-priority execution-priority--'+(priorityLabels[value]||'Normal').toLowerCase();

export function FocusWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const client=useQueryClient();
  const timer=useFocusTimer();
  const setTimer=updateFocusTimer;
  const [now,setNow]=useState(Date.now());
  const [preset,setPreset]=useState('25');
  const [customMinutes,setCustomMinutes]=useState('40');
  const [breakMinutes,setBreakMinutes]=useState('5');
  const [projectFilter,setProjectFilter]=useState('all');
  const [goalFilter,setGoalFilter]=useState('all');
  const [selectedTaskId,setSelectedTaskId]=useState<number|null>(null);
  const [taskFilter,setTaskFilter]=useState<'open'|'all'|'done'>('open');
  const [newTask,setNewTask]=useState('');
  const [newTaskProject,setNewTaskProject]=useState('');
  const [newTaskPriority,setNewTaskPriority]=useState('2');
  const [newTaskDueDate,setNewTaskDueDate]=useState('');
  const [subtaskDrafts,setSubtaskDrafts]=useState<Record<number,string>>({});
  const [distractionDraft,setDistractionDraft]=useState('');
  const savedKeys=useRef(new Set<string>());
  const chimedKeys=useRef(new Set<string>());
  const launchHoldRef=useRef<number|null>(null);
  const launchHeldRef=useRef(false);
  const tasks=useQuery({queryKey:['tasks'],queryFn:()=>api<Task[]>('/tasks')});
  const projects=useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects')});
  const goals=useQuery({queryKey:['goals'],queryFn:()=>api<Goal[]>('/goals')});
  const learning=useQuery({queryKey:['learning-paths'],queryFn:()=>api<LearningPath[]>('/learning/paths')});
  const sessions=useQuery({queryKey:['sessions'],queryFn:()=>api<Session[]>('/sessions')});
  const remaining=timer.deadline===null?timer.remaining:Math.max(0,Math.ceil((timer.deadline-now)/1000));
  const running=timer.deadline!==null&&remaining>0;
  const timerText=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
  const taskSelected=tasks.data?.find(item=>String(item.id)===timer.taskId);
  const lessonSelected=learning.data?.flatMap(path=>path.lessons.map(lesson=>({...lesson,pathTitle:path.title}))).find(item=>String(item.id)===timer.lessonId);
  const projectSelected=projects.data?.find(item=>String(item.id)===timer.projectId);
  const contextLabel=taskSelected?.title||lessonSelected?.title||projectSelected?.title||timer.focus||'A quiet block for meaningful work';
  const sessionInProgress=timer.kind==='focus'&&!!timer.sessionKey&&timer.remaining>0;
  const focusMinutes=timer.kind==='focus'?timer.durationSeconds/60:0;

  useEffect(()=>{if(!running)return;const id=window.setInterval(()=>setNow(Date.now()),250);return()=>window.clearInterval(id);},[running]);
  useEffect(()=>{if(timer.deadline!==null&&remaining===0)setTimer(current=>({...current,remaining:0,deadline:null}));},[timer.deadline,remaining]);
  useEffect(()=>{
    if(timer.kind!=='focus'||timer.remaining!==0||timer.deadline!==null||!timer.sessionKey||chimedKeys.current.has(timer.sessionKey))return;
    chimedKeys.current.add(timer.sessionKey);
    playAtlasFeedback('complete');
    const timerNode=document.querySelector('.execution-timer');if(timerNode){const rect=timerNode.getBoundingClientRect();triggerSparkBurst(rect.left+rect.width/2,rect.top+rect.height/2);triggerEnergyVortex(rect.left+rect.width/2,rect.top+rect.height/2);}
  },[timer.kind,timer.remaining,timer.deadline,timer.sessionKey]);


  const saveSession=useMutation({
    mutationFn:(payload:{minutes:number;focus:string;reflection:string;task_id:number|null;project_id:number|null;lesson_id:number|null;session_key:string;distractions:string[]})=>api<Session>('/sessions',json('POST',payload)),
    onSuccess:()=>{void client.invalidateQueries({queryKey:['sessions']});void client.invalidateQueries({queryKey:['tasks']});void client.invalidateQueries({queryKey:['projects']});void client.invalidateQueries({queryKey:['goals']});void client.invalidateQueries({queryKey:['overview']});void client.invalidateQueries({queryKey:['intelligence']});void client.invalidateQueries({queryKey:['learning-paths']});void client.invalidateQueries({queryKey:['learning-study-logs']});void client.invalidateQueries({queryKey:['achievements']});}
  });
  useEffect(()=>{
    if(timer.kind!=='focus'||timer.remaining!==0||timer.deadline!==null||!timer.sessionKey||savedKeys.current.has(timer.sessionKey))return;
    savedKeys.current.add(timer.sessionKey);
    const elapsed=Math.max(1,Math.min(600,Math.round((timer.durationSeconds-(timer.remaining||0))/60)));
    saveSession.mutate({minutes:elapsed,focus:(timer.focus||contextLabel).trim()||'Focused work',reflection:timer.notes,task_id:timer.taskId?Number(timer.taskId):null,project_id:timer.projectId?Number(timer.projectId):null,lesson_id:timer.lessonId?Number(timer.lessonId):null,session_key:timer.sessionKey,distractions:timer.distractions});
  },[timer.kind,timer.remaining,timer.deadline,timer.sessionKey,timer.durationSeconds,timer.focus,timer.notes,timer.taskId,timer.projectId,timer.lessonId,timer.distractions,contextLabel]);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const requestedTask=params.get('task'),requestedLesson=params.get('lesson'),requestedFocus=params.get('focus');
    if(timer.deadline!==null||(timer.sessionKey&&timer.remaining>0))return;
    if(requestedTask&&tasks.data?.some(task=>String(task.id)===requestedTask)){
      const task=tasks.data.find(item=>String(item.id)===requestedTask)!;
      setTimer(current=>({...current,taskId:requestedTask,lessonId:'',projectId:task.project_id?String(task.project_id):current.projectId,focus:task.title}));
    } else if(requestedLesson&&learning.data?.some(path=>path.lessons.some(lesson=>String(lesson.id)===requestedLesson))){
      const lesson=learning.data.flatMap(path=>path.lessons).find(item=>String(item.id)===requestedLesson)!;
      setTimer(current=>({...current,lessonId:requestedLesson,taskId:'',focus:lesson.title}));
    } else if(requestedFocus) setTimer(current=>({...current,focus:requestedFocus.slice(0,120)}));
  },[tasks.data,learning.data]);

  const createTask=useMutation({mutationFn:()=>api<Task>('/tasks',json('POST',{title:newTask,category:'Personal',project_id:newTaskProject||null,priority:Number(newTaskPriority),due_date:newTaskDueDate||null})),onSuccess:()=>{setNewTask('');setNewTaskDueDate('');void client.invalidateQueries({queryKey:['tasks']});void client.invalidateQueries({queryKey:['projects']});}});
  const toggleTask=useMutation({mutationFn:(task:Task)=>api('/tasks/'+task.id,json('PATCH',{done:!task.done})),onMutate:task=>{if(!task.done){playAtlasFeedback('tick');triggerSparkBurst(window.innerWidth/2,window.innerHeight*.44);}},onSuccess:()=>{void client.invalidateQueries({queryKey:['tasks']});void client.invalidateQueries({queryKey:['projects']});void client.invalidateQueries({queryKey:['overview']});}});
  const createSubtask=useMutation({mutationFn:({parentId,title}:{parentId:number;title:string})=>api('/tasks',json('POST',{title,category:'Personal',parent_task_id:parentId,project_id:tasks.data?.find(item=>item.id===parentId)?.project_id||null})),onSuccess:(_data,variables)=>{setSubtaskDrafts(current=>({...current,[variables.parentId]:''}));void client.invalidateQueries({queryKey:['tasks']});}});
  const visibleTasks=useMemo(()=>{
    const rows=tasks.data||[];
    return rows.filter(task=>{const linkedGoal=task.goal_id||projects.data?.find(project=>project.id===task.project_id)?.goal_id||null;return !task.parent_task_id&&(projectFilter==='all'||String(task.project_id||'none')===projectFilter)&&(goalFilter==='all'||String(linkedGoal||'none')===goalFilter)&&(taskFilter==='all'||(taskFilter==='open'?!task.done:!!task.done));});
  },[tasks.data,projects.data,projectFilter,goalFilter,taskFilter]);
  const children=(parentId:number)=>(tasks.data||[]).filter(task=>task.parent_task_id===parentId);
  const inspectedTask=tasks.data?.find(task=>task.id===selectedTaskId)||null;
  const inspectedSubtasks=inspectedTask?children(inspectedTask.id):[];

  function start(kind:'focus'|'break') {
    if(running)return;
    if(kind==='focus')primeAtlasAudio();
    const seconds=kind==='break'?Math.max(1,Math.min(60,Number(breakMinutes)||5))*60:Math.max(1,Math.min(600,Number(preset==='custom'?customMinutes:preset)||25))*60;
    const key=kind==='focus'?(globalThis.crypto?.randomUUID?.()||'atlas-'+Date.now()+'-'+Math.random().toString(36).slice(2)):null;
    setTimer(current=>({...current,remaining:seconds,durationSeconds:seconds,deadline:Date.now()+seconds*1000,kind,sessionKey:key,startedAt:Date.now(),focus:current.focus||contextLabel}));
    setNow(Date.now());
  }
  function pause(){setTimer(current=>({...current,remaining,deadline:null}));}
  function reset(){const seconds=timer.kind==='break'?Math.max(1,Math.min(60,Number(breakMinutes)||5))*60:Math.max(1,Math.min(600,Number(preset==='custom'?customMinutes:preset)||25))*60;setTimer(current=>({...current,remaining:seconds,durationSeconds:seconds,deadline:null,sessionKey:null,startedAt:null}));}
  function selectTask(task:Task){if(sessionInProgress)return;setTimer(current=>({...current,taskId:String(task.id),lessonId:'',projectId:task.project_id?String(task.project_id):'',focus:task.title}));}
  function focusProject(project:Project){if(sessionInProgress)return;setTimer(current=>({...current,taskId:'',lessonId:'',projectId:String(project.id),focus:project.title}));start('focus');navigate('/focus');}
  function selectLesson(lessonId:string){if(running)return;const lesson=learning.data?.flatMap(path=>path.lessons).find(item=>String(item.id)===lessonId);setTimer(current=>({...current,lessonId,focus:lesson?.title||current.focus}));}
  function finish(){if(timer.kind==='break'){setTimer(current=>({...current,remaining:0,deadline:null,sessionKey:null}));return;}const elapsed=timer.durationSeconds-remaining;if(elapsed<60)return;setTimer(current=>({...current,remaining:0,deadline:null,durationSeconds:elapsed}));}
  function addDistraction(){const value=distractionDraft.trim();if(!value)return;setTimer(current=>({...current,distractions:[...current.distractions,value.slice(0,240)].slice(-50)}));setDistractionDraft('');}
  function focusTask(task:Task){if(sessionInProgress)return;selectTask(task);start('focus');navigate('/focus');}
  const selectedDuration=timer.durationSeconds/60;

  const isFocusRoute=location.pathname==='/focus';
  return <Cascade className={isFocusRoute ? "stack execution-workspace focus-room-only" : "stack execution-workspace"}>
    <div className="execution-heading"><div><span className="eyebrow">ROOM 03 / EXECUTION & FOCUS</span><h1>{isFocusRoute?'Settle into deep work.':'Protect your attention.'}</h1><p>{isFocusRoute?'One clear intention. One protected block. Your progress is recorded alongside the work it supports.':'Choose the work. Protect your attention. Let each completed session strengthen the same record.'}</p></div><div className="execution-heading-stat"><b>{sessions.data?.length||0}</b><span>RECORDED SESSIONS</span></div></div>
    <div className={"execution-split "+(isFocusRoute?"focus-room-layout":"execution-projects-layout")+(inspectedTask&&!isFocusRoute?" has-task-inspector":"")}>
      {!isFocusRoute && <section className="execution-projects-panel">
        <Card className="execution-panel-card">
          <div className="execution-panel-heading"><div><span className="eyebrow">01 / DAILY ACTION</span><h2>Task queue.</h2><p>Choose the next useful action, with project and goal context close at hand.</p></div></div>
          <div className="execution-project-rail">
            <button className={projectFilter==='all'?'is-active':''} onClick={()=>{setProjectFilter('all');setGoalFilter('all');}}>All work <small>{(tasks.data||[]).filter(task=>!task.parent_task_id&&!task.done).length}</small></button>
            {(projects.data||[]).map(project=><div className={'execution-project-choice '+(projectFilter===String(project.id)?'is-active':'')} key={project.id}><button className="execution-project-choice__select" onClick={()=>{setProjectFilter(String(project.id));setGoalFilter('all');if(!sessionInProgress)setTimer(current=>({...current,taskId:'',lessonId:'',projectId:String(project.id),focus:project.title}));}}>{project.title}<small>{project.open_tasks}</small></button><button className="execution-project-choice__focus" disabled={sessionInProgress} onClick={()=>focusProject(project)} aria-label={'Start focus on '+project.title}><Timer size={12}/></button></div>)}
            <button className={projectFilter==='none'?'is-active':''} onClick={()=>{setProjectFilter('none');setGoalFilter('all');}}>Standalone <small>{(tasks.data||[]).filter(task=>!task.project_id&&!task.done&&!task.parent_task_id).length}</small></button>
          </div>
          <div className="execution-project-rail execution-goal-filter-rail" aria-label="Filter tasks by goal"><button className={goalFilter==='all'?'is-active':''} onClick={()=>{setGoalFilter('all');setProjectFilter('all');}}>All goals</button>{(goals.data||[]).map(goal=><button key={goal.id} className={goalFilter===String(goal.id)?'is-active':''} onClick={()=>{setGoalFilter(String(goal.id));setProjectFilter('all');}}>{goal.title}</button>)}<button className={goalFilter==='none'?'is-active':''} onClick={()=>{setGoalFilter('none');setProjectFilter('all');}}>Unlinked</button></div>
          <div className="execution-task-toolbar"><div><b>Tasks</b><span>{visibleTasks.length} shown</span></div><div className="execution-filter-tabs"><button className={taskFilter==='open'?'is-active':''} onClick={()=>setTaskFilter('open')}>Open</button><button className={taskFilter==='all'?'is-active':''} onClick={()=>setTaskFilter('all')}>All</button><button className={taskFilter==='done'?'is-active':''} onClick={()=>setTaskFilter('done')}>Done</button></div></div>
          <details className="atlas-add-disclosure"><summary>+ Add task</summary><form className="execution-quick-add" onSubmit={event=>{event.preventDefault();if(newTask.trim())createTask.mutate();}}>
            <TextInput value={newTask} onChange={event=>setNewTask(event.target.value)} placeholder="Add a clear next action…" />
            <select className="field-input" value={newTaskProject} onChange={event=>setNewTaskProject(event.target.value)}><option value="">No project</option>{(projects.data||[]).map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select>
            <select className="field-input" value={newTaskPriority} onChange={event=>setNewTaskPriority(event.target.value)}><option value="1">Urgent</option><option value="2">High</option><option value="3">Normal</option><option value="4">Low</option></select>
            <TextInput type="date" value={newTaskDueDate} onChange={event=>setNewTaskDueDate(event.target.value)} aria-label="Task due date"/>
            <Button type="submit" disabled={!newTask.trim()||createTask.isPending}><Plus size={14}/> Add</Button>
          </form></details>
          {createTask.isError&&<p className="inline-error">{createTask.error.message}</p>}
          <div className="execution-task-list">
            {tasks.isLoading?<div className="atlas-skeleton-list" aria-label="Loading tasks"><i/><i/><i/></div>:visibleTasks.length?<AnimatePresence initial={false}>{visibleTasks.map(task=><motion.article layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, y: -5, marginBottom: 0 }} transition={{ layout: { type: 'spring', stiffness: 420, damping: 35, bounce: 0 }, opacity: { duration: 0.14 }, height: { duration: 0.16 } }} className={'execution-task '+(task.done?'is-done':'')+(selectedTaskId===task.id?' is-selected':'')} key={task.id} onClick={()=>setSelectedTaskId(task.id)} tabIndex={0} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedTaskId(task.id);}}}>
              <div className="execution-task-main"><motion.button whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 420, damping: 35, bounce: 0 }} className={"execution-task-check execution-task-check--"+(priorityLabels[task.priority]||"Normal").toLowerCase()} onClick={()=>toggleTask.mutate(task)} aria-label={task.done?'Reopen '+task.title:'Complete '+task.title}>{task.done?<Check size={15}/>:<Circle size={15}/>}</motion.button><div className="execution-task-copy"><b>{task.title}</b><div className="execution-task-meta"><span className={priorityClass(task.priority)}>{priorityLabels[task.priority]||'Normal'}</span>{task.due_date&&<time>{task.due_date}</time>}{task.project_title&&<span>{task.project_title}</span>}{task.focus_minutes>0&&<span><Clock3 size={11}/> {task.focus_minutes}m focused</span>}</div></div><Button size="sm" variant="secondary" disabled={sessionInProgress||!!task.done} onClick={()=>focusTask(task)}><Timer size={13}/> Focus</Button></div>
              {!!children(task.id).length&&<div className="execution-subtasks">{children(task.id).map(child=><label key={child.id}><input type="checkbox" checked={!!child.done} onChange={()=>toggleTask.mutate(child)}/><span className={child.done?'is-complete':''}>{child.title}</span></label>)}</div>}
              <details className="atlas-add-disclosure atlas-add-disclosure--compact"><summary>+ Add subtask</summary><form className="execution-subtask-form" onSubmit={event=>{event.preventDefault();const title=subtaskDrafts[task.id]?.trim();if(title)createSubtask.mutate({parentId:task.id,title});}}><input value={subtaskDrafts[task.id]||''} onChange={event=>setSubtaskDrafts(current=>({...current,[task.id]:event.target.value}))} placeholder="Add subtask…" aria-label={'Add subtask to '+task.title}/><button type="submit" disabled={!subtaskDrafts[task.id]?.trim()||createSubtask.isPending}><Plus size={12}/> Subtask</button></form></details>
            </motion.article>)}</AnimatePresence>:<EmptyState title="Nothing in this view." detail="Add a task or choose another project filter."/>}
          </div>
        </Card>
        <div className="execution-project-metrics">{(projects.data||[]).filter(project=>projectFilter==='all'||String(project.id)===projectFilter).slice(0,3).map(project=><Card key={project.id} className="execution-project-metric"><span className="eyebrow">{project.title}</span><b>{project.progress_pct}%</b><small>{project.focus_minutes}m focused · {project.open_tasks} open</small><i><span style={{width:project.progress_pct+'%'}}/></i></Card>)}</div>
      </section>}
      {!isFocusRoute && inspectedTask && <motion.aside initial={{opacity:0,x:22}} animate={{opacity:1,x:0}} className="execution-task-inspector" aria-label="Task details"><div className="execution-inspector-top"><span className="eyebrow">TASK INSPECTOR</span><button className="icon-button" type="button" onClick={()=>setSelectedTaskId(null)} aria-label="Close task inspector"><X size={16}/></button></div><div className="execution-inspector-title"><span className={priorityClass(inspectedTask.priority)}>{priorityLabels[inspectedTask.priority]||'Normal'} priority</span><h2>{inspectedTask.title}</h2><p>{inspectedTask.detail||'No additional task detail has been added.'}</p></div><div className="execution-inspector-meta"><span>{inspectedTask.project_title||'Standalone task'}</span><span>{inspectedTask.due_date||'No due date'}</span><span>{inspectedTask.focus_minutes||0}m focused</span></div><div className="execution-inspector-section"><div className="execution-inspector-heading"><b>Subtasks</b><small>{inspectedSubtasks.filter(item=>item.done).length}/{inspectedSubtasks.length} complete</small></div>{inspectedSubtasks.length?inspectedSubtasks.map(child=><label className="execution-inspector-subtask" key={child.id}><input type="checkbox" checked={!!child.done} onChange={()=>toggleTask.mutate(child)}/><span className={child.done?'is-complete':''}>{child.title}</span></label>):<p className="muted">Break this task into smaller steps when useful.</p>}<form className="execution-subtask-form execution-inspector-add" onSubmit={event=>{event.preventDefault();const title=subtaskDrafts[inspectedTask.id]?.trim();if(title)createSubtask.mutate({parentId:inspectedTask.id,title});}}><input value={subtaskDrafts[inspectedTask.id]||''} onChange={event=>setSubtaskDrafts(current=>({...current,[inspectedTask.id]:event.target.value}))} placeholder="Add a subtask…" aria-label="Add a subtask"/><button type="submit" disabled={!subtaskDrafts[inspectedTask.id]?.trim()||createSubtask.isPending}><Plus size={13}/> Add</button></form></div><div className="execution-inspector-actions"><Button disabled={!!inspectedTask.done||sessionInProgress} onClick={()=>focusTask(inspectedTask)}><Timer size={14}/> Focus this task</Button><Button variant="secondary" onClick={()=>toggleTask.mutate(inspectedTask)}>{inspectedTask.done?'Reopen task':'Mark complete'}</Button></div></motion.aside>}
      {isFocusRoute && <section className="execution-focus-panel">
        <Card className="execution-focus-card">
          <div className="execution-panel-heading"><div><span className="eyebrow">02 / FOCUS TIMER</span><h2>One thing at a time.</h2><p>{running?'Your timer is protected while you move around Atlas.':'Choose a duration and begin when you are ready.'}</p></div><Timer size={19}/></div>
          <div className="execution-focus-context"><span>THIS SESSION</span><b>{contextLabel}</b><small>{taskSelected?.project_title||lessonSelected?.pathTitle||'Unlinked focus is fine too'}</small></div>
          <SpatialTiltCard className="execution-timer-tilt"><div className={"execution-timer"+(running&&timer.kind==='focus'?' is-running':'')} role="timer" aria-live="off"><FocusSonar active={timer.kind==="focus"&&timer.remaining===0&&!!timer.sessionKey} sessionKey={timer.sessionKey}/><AstrolabeRings active={running&&timer.kind==='focus'}/><div className="execution-timer-core" style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",width:220,height:220,opacity:running ? 0.82 : 0.56,zIndex:0,pointerEvents:"none"}}><FerrofluidCore active={running}/></div><svg className="execution-timer-ring" viewBox="0 0 220 220" aria-hidden="true">{Array.from({length:60},(_,index)=>{const angle=(index/60)*Math.PI*2-Math.PI/2;const major=index%5===0;const inner=major?99:102;const outer=major?108:106;return <line key={index} className={major?"execution-timer-tick execution-timer-tick--major":"execution-timer-tick"} x1={110+Math.cos(angle)*inner} y1={110+Math.sin(angle)*inner} x2={110+Math.cos(angle)*outer} y2={110+Math.sin(angle)*outer}/>;})}<circle className="execution-timer-ring__track" cx="110" cy="110" r="90"/><circle className="execution-timer-ring__progress" cx="110" cy="110" r="90" style={{strokeDasharray:565.49,strokeDashoffset:565.49*(1-Math.max(0,Math.min(1,remaining/Math.max(1,timer.durationSeconds))))}}/></svg><div className={"execution-timer-readout"+(timer.kind==="focus"&&timer.remaining===0&&!!timer.sessionKey?" is-complete":"")}><OdometerNumber value={timerText}/><small>{timer.kind==='break'?'BREAK':'DEEP WORK'}</small></div></div></SpatialTiltCard>
          <div className="execution-presets">{[['25','25m'],['50','50m'],['80','80m'],['custom','Custom']].map(([value,label])=><button key={value} className={preset===value?'is-active':''} disabled={running} onClick={()=>{setPreset(value);if(value!=='custom'){const seconds=Number(value)*60;setTimer(current=>({...current,remaining:seconds,durationSeconds:seconds,deadline:null,sessionKey:null}));}}}>{label}</button>)}</div>
          {preset==='custom'&&<Field label="Custom focus duration (minutes)"><TextInput type="number" min="1" max="600" value={customMinutes} disabled={running} onChange={event=>{setCustomMinutes(event.target.value);const seconds=Math.max(1,Math.min(600,Number(event.target.value)||1))*60;setTimer(current=>({...current,remaining:seconds,durationSeconds:seconds,deadline:null,sessionKey:null}));}}/></Field>}
          <div className="execution-timer-actions"><span className="focus-charge-launch"><Button onClick={()=>{if(launchHeldRef.current){launchHeldRef.current=false;return;}running?pause():start('focus');}} onPointerDown={()=>{if(!running)launchHoldRef.current=window.setTimeout(()=>{launchHeldRef.current=true;start('focus');},650);}} onPointerUp={()=>{if(launchHoldRef.current!==null){window.clearTimeout(launchHoldRef.current);launchHoldRef.current=null;}}} onPointerLeave={()=>{if(launchHoldRef.current!==null){window.clearTimeout(launchHoldRef.current);launchHoldRef.current=null;}}} disabled={timer.kind==='break'&&running?false:running&&timer.kind==='break'}>{running?<><Pause size={15}/> Pause</>:<><Play size={15}/> {timer.remaining===0?'Start next block':'Start focus'}</>}</Button></span><Button variant="ghost" onClick={reset}><RotateCcw size={14}/> Reset</Button><Button variant="ghost" onClick={finish} disabled={timer.kind!=='focus'||!timer.sessionKey||timer.remaining===0||(!running&&timer.remaining===timer.durationSeconds)}><Check size={14}/> Finish & save</Button></div>
          {saveSession.isPending&&<p className="execution-save-state">Saving your verified focus record…</p>}
          {saveSession.isError&&<div className="execution-save-error"><p className="inline-error">{saveSession.error.message}</p><Button size="sm" variant="secondary" onClick={()=>{if(!timer.sessionKey)return;savedKeys.current.delete(timer.sessionKey);saveSession.mutate({minutes:Math.max(1,Math.min(600,Math.round(timer.durationSeconds/60))),focus:(timer.focus||contextLabel).trim()||'Focused work',reflection:timer.notes,task_id:timer.taskId?Number(timer.taskId):null,project_id:timer.projectId?Number(timer.projectId):null,lesson_id:timer.lessonId?Number(timer.lessonId):null,session_key:timer.sessionKey,distractions:timer.distractions});}}>Retry save</Button></div>}
          {timer.sessionKey&&timer.remaining===0&&!saveSession.isError&&<p className="execution-save-state">This focus block has been sent to your workspace.</p>}
          <div className="execution-break-row"><div><b>Break timer</b><small>Rest without adding to focus totals.</small></div><select className="field-input" value={breakMinutes} disabled={running} onChange={event=>setBreakMinutes(event.target.value)}><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option></select><Button variant="secondary" size="sm" disabled={running} onClick={()=>start('break')}>Start break</Button></div>
          <div className="execution-focus-links">
            <Field label="Link a task"><select className="field-input" value={timer.taskId} disabled={running} onChange={event=>{const task=tasks.data?.find(item=>String(item.id)===event.target.value);setTimer(current=>({...current,taskId:event.target.value,projectId:task?.project_id?String(task.project_id):'',focus:task?.title||current.focus}));}}><option value="">No task</option>{(tasks.data||[]).filter(task=>!task.parent_task_id).map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></Field>
            <Field label="Also link a lesson"><select className="field-input" value={timer.lessonId} disabled={running} onChange={event=>selectLesson(event.target.value)}><option value="">No lesson</option>{learning.data?.flatMap(path=>path.lessons.map(lesson=><option key={lesson.id} value={lesson.id}>{path.title} · {lesson.title}</option>))}</select></Field>
          </div>
          <Field label="Session notes"><TextArea value={timer.notes} disabled={timer.remaining===0&&!!timer.sessionKey} onChange={event=>setTimer(current=>({...current,notes:event.target.value}))} placeholder="What are you moving forward? Capture the useful outcome…" /></Field>
          <div className="execution-distractions"><div><b>Distraction log</b><small>Notice interruptions without judging yourself.</small></div><form onSubmit={event=>{event.preventDefault();addDistraction();}}><input value={distractionDraft} onChange={event=>setDistractionDraft(event.target.value)} placeholder="What pulled your attention away?"/><button type="submit" disabled={!distractionDraft.trim()}><Plus size={13}/></button></form>{timer.distractions.length>0&&<ul>{timer.distractions.map((item,index)=><li key={index}>{item}<button onClick={()=>setTimer(current=>({...current,distractions:current.distractions.filter((_,i)=>i!==index)}))} aria-label="Remove distraction"><X size={11}/></button></li>)}</ul>}</div>
        </Card>
        <Card className="execution-history-card"><div className="execution-panel-heading"><div><span className="eyebrow">YOUR ATTENTION, RECORDED</span><h2>Recent sessions</h2><p>{sessions.data?.reduce((sum,item)=>sum+item.minutes,0)||0} {sessions.data?.reduce((sum,item)=>sum+item.minutes,0)===1?'minute':'minutes'} across the latest records.</p></div><Clock3 size={17}/></div>
          {sessions.data?.length?<div className="execution-history-list">{sessions.data.slice(0,8).map(item=><article key={item.id}><span className="execution-history-mark"><Clock3 size={14}/></span><div><b>{item.focus}</b><small>{item.session_date}{item.task_title?' · '+item.task_title:''}{item.lesson_title?' · '+item.path_title+' / '+item.lesson_title:''}{item.project_title?' · '+item.project_title:''}</small>{item.reflection&&<p>{item.reflection}</p>}{item.distractions&&item.distractions.length>0&&<small>{item.distractions.length} distraction notes</small>}</div><strong>{item.minutes}m</strong></article>)}</div>:<EmptyState title="Your focus history starts here." detail="A completed focus block will appear here and update your connected work."/>}
        </Card>
      </section>}
    </div>
  </Cascade>;
}

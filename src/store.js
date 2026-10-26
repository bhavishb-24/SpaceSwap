import {blankProject,demoProject} from './data.js';
const REAL_KEY='spaceswap.project.v1',DEMO_KEY='spaceswap.judge-demo.v1',MODE_KEY='spaceswap.mode.v1';
const clone=x=>structuredClone(x);
export function validProject(p){
 const finite=(n,min=0,max=1e8)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const optional=n=>n===null||finite(n);
 if(p?.version!==1||typeof p.name!=='string'||p.name.length>100||!Array.isArray(p.apartments)||p.apartments.length>30||!Array.isArray(p.inventory)||p.inventory.length>1000||!p.preferences)return false;
 const pref=p.preferences;
 if(!['metric','imperial'].includes(pref.units)||!finite(pref.clearance,.1,3)||!['cost','reuse','area','conflicts','newFurniture'].every(key=>finite(pref.weights?.[key],0,100))||!optional(pref.budget)||!(pref.months===null&&p.apartments.length===0||Number.isInteger(pref.months)&&pref.months>=1&&pref.months<=120))return false;
 return p.apartments.every(a=>typeof a.id==='string'&&typeof a.name==='string'&&a.name.length<=100&&[a.rent,a.moving,a.setup,a.recurring].every(optional)&&Array.isArray(a.rooms)&&a.rooms.length<=100&&Array.isArray(a.furniture)&&a.furniture.length<=1000&&Array.isArray(a.openings)&&Array.isArray(a.replacementIds)&&Array.isArray(a.clearances)&&a.rooms.every(r=>typeof r.name==='string'&&finite(r.x,-1000,1000)&&finite(r.z,-1000,1000)&&finite(r.width,.01,100)&&finite(r.depth,.01,100))&&a.furniture.every(f=>typeof f.name==='string'&&f.name.length<=100&&finite(f.width,.01,100)&&finite(f.depth,.01,100)&&finite(f.height,.01,100)&&finite(f.x,-1000,1000)&&finite(f.z,-1000,1000)&&optional(f.price)));
}
const valid=validProject;
let loadError=false,saveError=false;
function read(key,fallback){try{const raw=localStorage.getItem(key);if(!raw)return fallback();const value=JSON.parse(raw);if(!valid(value))throw Error('Invalid project');return value;}catch{loadError=true;return fallback();}}
let real=read(REAL_KEY,blankProject),demo=null,mode=sessionStorage.getItem(MODE_KEY)==='demo'?'demo':'real';
if(mode==='demo')demo=read(DEMO_KEY,demoProject);
let project=mode==='demo'?demo:real,history=[],future=[];
const listeners=new Set();
function emit(){listeners.forEach(fn=>fn());}
function persist(){try{localStorage.setItem(mode==='demo'?DEMO_KEY:REAL_KEY,JSON.stringify(project));saveError=false;}catch{saveError=true;}}
function switchMode(next){mode=next;sessionStorage.setItem(MODE_KEY,next);if(next==='demo'){demo=demo||read(DEMO_KEY,demoProject);project=demo;}else{project=real;}history=[];future=[];emit();}
export const store={
 get:()=>project,
 get mode(){return mode;},get loadError(){return loadError;},get saveError(){return saveError;},
 get legacySample(){return mode==='real'&&real.apartments.some(a=>['willow','cedar'].includes(a.id));},
 get canUndo(){return history.length>0;},get canRedo(){return future.length>0;},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 checkpoint(){history.push(clone(project));if(history.length>50)history.shift();future=[];},
 save:persist,
 update(fn,{checkpoint=true,notify=true}={}){if(checkpoint)this.checkpoint();fn(project);mode==='demo'?demo=project:real=project;persist();if(notify)emit();},
 emit,
 undo(){if(!history.length)return;future.push(clone(project));project=history.pop();mode==='demo'?demo=project:real=project;persist();emit();},
 redo(){if(!future.length)return;history.push(clone(project));project=future.pop();mode==='demo'?demo=project:real=project;persist();emit();},
 reset(){this.checkpoint();project=mode==='demo'?demoProject():blankProject();mode==='demo'?demo=project:real=project;persist();emit();},
 replace(next){if(!valid(next))throw Error('Invalid project');this.checkpoint();project=clone(next);mode==='demo'?demo=project:real=project;persist();emit();},
 enterDemo(){switchMode('demo');},
 exitDemo(){switchMode('real');},
 clearDemo(){localStorage.removeItem(DEMO_KEY);demo=null;if(mode==='demo')switchMode('real');else emit();},
 moveLegacyToDemo(){if(!this.legacySample)return;const nextDemo=clone(real),originals=demoProject().apartments;for(const apartment of nextDemo.apartments){const original=originals.find(a=>a.id===apartment.id);if(original&&!apartment.moveRoute)apartment.moveRoute=clone(original.moveRoute);}localStorage.setItem(DEMO_KEY,JSON.stringify(nextDemo));demo=nextDemo;real=blankProject();if(mode==='real'){project=real;history=[];future=[];persist();emit();}}
};
export const activeApartment=()=>project.apartments.find(a=>a.id===project.activeApartmentId)||project.apartments[0]||null;

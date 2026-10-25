import {demoProject} from './data.js';
const KEY='spaceswap.project.v1';
let project;let loadError=false;
try{const raw=localStorage.getItem(KEY);project=raw?JSON.parse(raw):demoProject();if(project.version!==1||!Array.isArray(project.apartments)||!project.apartments.length||!project.preferences||!Array.isArray(project.inventory))throw Error('Invalid project');for(const a of project.apartments){if(!Array.isArray(a.rooms)||!Array.isArray(a.furniture)||!Array.isArray(a.openings)||!Array.isArray(a.replacementIds))throw Error('Invalid apartment');}}catch{project=demoProject();loadError=true;}
let history=[],future=[];let saveError=false;
const listeners=new Set();
const clone=x=>structuredClone(x);
export const store={
 get:()=>project,
 get loadError(){return loadError;},get saveError(){return saveError;},
 get canUndo(){return history.length>0;},get canRedo(){return future.length>0;},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 checkpoint(){history.push(clone(project));if(history.length>50)history.shift();future=[];},
 save(){try{localStorage.setItem(KEY,JSON.stringify(project));saveError=false;}catch{saveError=true;}},
 update(fn,{checkpoint=true,notify=true}={}){if(checkpoint)this.checkpoint();fn(project);this.save();if(notify)listeners.forEach(fn=>fn());},
 emit(){listeners.forEach(fn=>fn());},
 undo(){if(!history.length)return;future.push(clone(project));project=history.pop();this.save();this.emit();},
 redo(){if(!future.length)return;history.push(clone(project));project=future.pop();this.save();this.emit();},
 reset(){this.checkpoint();project=demoProject();this.save();this.emit();},
 replace(next){this.checkpoint();project=next;this.save();this.emit();}
};
export const activeApartment=()=>project.apartments.find(a=>a.id===project.activeApartmentId)||project.apartments[0];

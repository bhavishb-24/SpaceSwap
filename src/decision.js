import {analyze,fitProblems,itemIssues} from './geometry.js';
import {compare,calculateCosts} from './costs.js';

export const routeStages=[
 {key:'entry',label:'Building entrance',kind:'opening',fields:['width','height']},
 {key:'hall',label:'Narrowest hallway',kind:'opening',fields:['width','height']},
 {key:'liftDoor',label:'Elevator door',kind:'opening',fields:['width','height']},
 {key:'liftCabin',label:'Elevator cabin',kind:'cabin',fields:['width','depth','height']},
 {key:'stairs',label:'Stairwell clear width',kind:'opening',fields:['width','height']},
];
export function routeFor(apartment){return apartment.moveRoute||{};}
const permutations=([a,b,c])=>[[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]];
const known=value=>Number.isFinite(value)&&value>0;
function openingResult(item,stage){
 if(!known(stage.width)||!known(stage.height))return 'unknown';
 return permutations([item.width,item.depth,item.height]).some(([width,,height])=>width<=stage.width+1e-7&&height<=stage.height+1e-7)?'pass':'blocked';
}
function cabinResult(item,stage){
 if(!['width','depth','height'].every(key=>known(stage[key])))return 'unknown';
 return permutations([item.width,item.depth,item.height]).some(([width,depth,height])=>width<=stage.width+1e-7&&depth<=stage.depth+1e-7&&height<=stage.height+1e-7)?'pass':'blocked';
}
export function routeResults(apartment,{stairsOnly=false}={}){
 const route=routeFor(apartment),stages=routeStages.filter(s=>stairsOnly?['entry','hall','stairs'].includes(s.key):s.key!=='stairs');
 const issues=analyze(apartment,{clearance:.6});
 return apartment.furniture.filter(item=>!item.builtIn&&item.source==='owned').map(item=>{
  const roomIssues=fitProblems(itemIssues(issues,item.id));
  const checks=stages.map(stage=>({stage:stage.key,label:stage.label,status:stage.kind==='cabin'?cabinResult(item,route[stage.key]||{}):openingResult(item,route[stage.key]||{})}));
  const blocked=checks.find(check=>check.status==='blocked'),missing=checks.filter(check=>check.status==='unknown');
  const status=blocked?'blocked':roomIssues.length?'room-risk':missing.length?'measure':'possible';
  return {item,status,checks,blocked,missing,roomIssues,verified:item.measurementConfidence==='verified'};
 });
}
export function tourTasks(apartment){
 const route=routeFor(apartment),tasks=[];
 for(const stage of routeStages){const missing=stage.fields.filter(key=>!known(route[stage.key]?.[key]));if(missing.length)tasks.push({id:`route-${stage.key}`,label:`Measure ${stage.label.toLowerCase()}`,detail:`Needed: ${missing.join(', ')} (meters).`});}
 for(const item of apartment.furniture.filter(f=>!f.builtIn&&f.source==='owned'&&f.measurementConfidence!=='verified'))tasks.push({id:`furniture-${item.id}`,label:`Verify ${item.name} dimensions`,detail:'Confirm width, depth, height and whether it can be disassembled.'});
 for(const result of routeResults(apartment))if(result.status==='blocked')tasks.push({id:`blocked-${result.item.id}`,label:`Ask about another route for ${result.item.name}`,detail:`The entered ${result.blocked.label.toLowerCase()} dimensions reject all axis-aligned orientations.`});
 tasks.push({id:'building-policy',label:'Ask about moving rules',detail:'Check elevator reservations, permitted hours, and any move-in fees.'});
 tasks.push({id:'utilities',label:'Check outlets and utilities',detail:'Photograph appliance hookups, outlets, and any included fixtures.'});
 return tasks;
}
export function scenarioProject(project,scenario={}){
 const next=structuredClone(project),months=Number(scenario.months)||next.preferences.months;
 next.preferences.months=Math.max(1,Math.min(120,months));
 const rise=Math.max(0,Math.min(100,Number(scenario.rentRise)||0))/100;
 const extra=Math.max(0,Number(scenario.extraMoving)||0);
 const split=scenario.roommate?2:1;
 for(const apartment of next.apartments){
  if(apartment.rent!==null)apartment.rent=apartment.rent*(1+rise)/split;
  if(apartment.recurring!==null)apartment.recurring/=split;
  if(apartment.moving!==null)apartment.moving+=extra;
  if(scenario.replaceSofa){const sofa=next.inventory.find(i=>i.source==='owned'&&i.type==='sofa'&&apartment.furniture.some(f=>f.inventoryId===i.id));if(sofa&&!apartment.replacementIds.includes(sofa.id))apartment.replacementIds.push(sofa.id);}
 }
 return next;
}
export function scenarioRows(project,scenario){const next=scenarioProject(project,scenario);return compare(next).map(row=>({...row,base:calculateCosts(project.apartments.find(a=>a.id===row.apartment.id),project)}));}
export function briefSnapshot(project){
 const rows=compare(project);
 return {v:1,d:!!project.demoData,n:project.name,m:project.preferences.months,b:project.preferences.budget,a:rows.map(row=>({n:row.apartment.name,s:Math.round(row.score),p:row.provisional,t:row.costs.total,c:row.costs.complete,r:row.costs.remaining,f:row.conflicts,u:row.reused,k:{rent:row.costs.rent,recurring:row.costs.recurring,furnishing:row.costs.furnishing,replacement:row.costs.replacement,moving:row.costs.moving,setup:row.costs.setup},z:{rent:row.apartment.rent===null,recurring:row.apartment.recurring===null,moving:row.apartment.moving===null,setup:row.apartment.setup===null,furnishing:row.costs.missing.some(label=>label.endsWith(' price')),replacement:row.costs.missing.some(label=>label.endsWith(' replacement allowance'))},q:routeResults(row.apartment).reduce((acc,item)=>(acc[item.status]=(acc[item.status]||0)+1,acc),{}),tasks:tourTasks(row.apartment).filter(task=>!(row.apartment.tourCompleted||[]).includes(task.id)).length}))};
}
export function encodeBrief(snapshot){const bytes=new TextEncoder().encode(JSON.stringify(snapshot));let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function decodeBrief(token){try{if(!token||token.length>12000||!/^[A-Za-z0-9_-]+$/.test(token))return null;const raw=atob(token.replace(/-/g,'+').replace(/_/g,'/'));const bytes=Uint8Array.from(raw,character=>character.charCodeAt(0));const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(data?.v!==1||typeof data.n!=='string'||data.n.length>100||!Number.isInteger(data.m)||data.m<1||data.m>120||!Number.isFinite(data.b)||data.b<0||!Array.isArray(data.a)||!data.a.length||data.a.length>30||!['boolean','undefined'].includes(typeof data.d))return null;if(!data.a.every(row=>row&&typeof row.n==='string'&&row.n.length<=100&&[row.s,row.t,row.r,row.f,row.u,row.tasks].every(Number.isFinite)&&typeof row.c==='boolean'&&typeof row.p==='boolean'&&row.q&&typeof row.q==='object'&&!Array.isArray(row.q)&&Object.values(row.q).every(x=>Number.isInteger(x)&&x>=0)&&(!row.k||Object.values(row.k).every(x=>Number.isFinite(x)&&x>=0))&&(!row.z||Object.values(row.z).every(x=>typeof x==='boolean'))))return null;return data;}catch{return null;}}

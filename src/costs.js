import {analyze,area,fitProblems,itemIssues} from './geometry.js';
export const money=n=>n===null||!Number.isFinite(n)?'Not entered':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export function calculateCosts(apartment,project){
 const missing=[];const value=(n,label)=>{if(n===null||!Number.isFinite(n)){missing.push(label);return 0;}return n;};
 const furnishing=apartment.furniture.filter(f=>f.source!=='owned').reduce((s,f)=>s+value(f.price,`${f.name} price`),0);
 const replacementItems=project.inventory.filter(i=>i.source==='owned'&&apartment.replacementIds.includes(i.id));
 const replacement=replacementItems.reduce((s,f)=>s+value(f.price,`${f.name} replacement allowance`),0);
 const moving=value(apartment.moving,'moving cost'),setup=value(apartment.setup,'setup cost'),rent=value(apartment.rent,'monthly rent'),recurring=value(apartment.recurring,'monthly extras');
 const months=project.preferences.months;
 if(!Number.isInteger(months)||months<1)missing.push('stay length');
 if(!Number.isFinite(project.preferences.budget))missing.push('move-in budget');
 const oneTime=furnishing+replacement+moving+setup,total=oneTime+(rent+recurring)*(Number.isInteger(months)&&months>0?months:0);
 return {furnishing,replacement,replacementItems,moving,setup,rent,recurring,oneTime,total,remaining:Number.isFinite(project.preferences.budget)?project.preferences.budget-oneTime:null,missing,complete:missing.length===0};
}
export function compare(project){
 const rows=project.apartments.map(a=>{const issues=analyze(a,project.preferences),costs=calculateCosts(a,project);const reused=project.inventory.filter(i=>{const f=a.furniture.find(f=>f.inventoryId===i.id);return i.source==='owned'&&f&&!a.replacementIds.includes(i.id)&&!itemIssues(issues,f.id).some(i=>fitProblems([i]).length||i.kind==='missing');}).length;return {apartment:a,issues,costs,reused,area:area(a),conflicts:fitProblems(issues).length,newFurniture:a.furniture.filter(f=>f.source!=='owned').length+costs.replacementItems.length};});
 const criteria={cost:r=>r.costs.total,reuse:r=>r.reused,area:r=>r.area,conflicts:r=>r.conflicts,newFurniture:r=>r.newFurniture};
 const weights=project.preferences.weights,weightTotal=Object.values(weights).reduce((s,w)=>s+w,0)||1;
 rows.forEach(r=>{r.components={};r.score=0;for(const[key,fn]of Object.entries(criteria)){const values=rows.map(fn),low=Math.min(...values),high=Math.max(...values);let normalized=high===low?1:(fn(r)-low)/(high-low);if(high!==low&&['cost','conflicts','newFurniture'].includes(key))normalized=1-normalized;const points=normalized*weights[key]/weightTotal*100;r.components[key]=points;r.score+=points;}r.provisional=!r.costs.complete||r.issues.some(i=>['measurement','missing','doorway'].includes(i.kind))||project.inventory.some(i=>i.source==='owned'&&!r.apartment.furniture.some(f=>f.inventoryId===i.id));});
 return rows.sort((a,b)=>b.score-a.score);
}

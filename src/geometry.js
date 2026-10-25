export const EPS=1e-7;
export const validDimension=v=>Number.isFinite(v)&&v>0;
export function footprint(item) {
 const angle=(item.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return [[-item.width/2,-item.depth/2],[item.width/2,-item.depth/2],[item.width/2,item.depth/2],[-item.width/2,item.depth/2]].map(([x,z])=>({x:item.x+x*c-z*s,z:item.z+x*s+z*c}));
}
export function rectangle(x,z,width,depth){return [{x,z},{x:x+width,z},{x:x+width,z:z+depth},{x,z:z+depth}];}
export function intersection(a,b) {
 let minDepth=Infinity;
 for(const polygon of [a,b]) for(let i=0;i<polygon.length;i++) {
  const p=polygon[i],q=polygon[(i+1)%polygon.length],len=Math.hypot(q.x-p.x,q.z-p.z);
  if(len<EPS)continue;
  const nx=-(q.z-p.z)/len,nz=(q.x-p.x)/len;
  const pa=a.map(p=>p.x*nx+p.z*nz),pb=b.map(p=>p.x*nx+p.z*nz);
  const amin=Math.min(...pa),amax=Math.max(...pa),bmin=Math.min(...pb),bmax=Math.max(...pb);
  if(amax<=bmin+EPS||bmax<=amin+EPS)return {overlaps:false,depth:0};
  minDepth=Math.min(minDepth,amax-bmin,bmax-amin);
 }
 return {overlaps:true,depth:minDepth};
}
export function pointSegment(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
export function polygonDistance(a,b){if(intersection(a,b).overlaps)return 0;let min=Infinity;for(const [p,q]of [[a,b],[b,a]])for(const x of p)for(let i=0;i<q.length;i++)min=Math.min(min,pointSegment(x,q[i],q[(i+1)%q.length]));return min;}
export function openingRegion(door,room,clearance=0.6){
 const d=Math.max(clearance,door.width),o=door.offset,w=door.width;
 switch(door.wall){case'north':return rectangle(room.x+o,room.z,w,d);case'south':return rectangle(room.x+o,room.z+room.depth-d,w,d);case'west':return rectangle(room.x,room.z+o,d,w);default:return rectangle(room.x+room.width-d,room.z+o,d,w);}
}
export function doorwayCheck(item,door){
 if(![item.width,item.depth,item.height,door.width,door.height].every(validDimension))return {status:'unknown',message:'Measure all three furniture dimensions and the clear door width and height.'};
 const dimensions=[item.width,item.depth,item.height];
 const fits=dimensions.some((w,i)=>dimensions.some((h,j)=>i!==j&&w<=door.width+EPS&&h<=door.height+EPS));
 return {status:fits?'preliminary':'fail',message:fits?'An axis-aligned orientation fits the measured opening. Turning space and the carrying route are not verified.':`No axis-aligned orientation fits the ${door.width.toFixed(2)} × ${door.height.toFixed(2)} m opening. Check disassembly and the full carrying route; diagonal carrying is not modeled.`};
}
export function analyze(apartment,preferences={clearance:0.6}) {
 const issues=[];const add=(item,kind,severity,message,extra={})=>issues.push({id:`${item.id}-${kind}-${issues.length}`,itemId:item.id,kind,severity,message,...extra});
 for(const room of apartment.rooms)if(room.measurementConfidence!=='verified')issues.push({id:`${room.id}-measurement`,roomId:room.id,kind:'measurement',severity:'info',message:`${room.name} dimensions are ${room.measurementConfidence}. Verify its ${room.width.toFixed(2)} × ${room.depth.toFixed(2)} m size before committing to a layout.`});
 for(const door of apartment.openings)if(door.measurementConfidence!=='verified')issues.push({id:`${door.id}-measurement`,openingId:door.id,kind:'measurement',severity:'info',message:`${apartment.rooms.find(r=>r.id===door.roomId)?.name} ${door.type} width is ${door.measurementConfidence}. Measure the clear opening; current checks are provisional.`});
 const furniture=apartment.furniture;
 for(let i=0;i<furniture.length;i++){
  const f=furniture[i],room=apartment.rooms.find(r=>r.id===f.roomId);
  if(![f.width,f.depth,f.height].every(validDimension)){add(f,'missing','warning',`${f.name} is missing a valid dimension. Enter its width, depth, and height before checking fit.`);continue;}
  if(f.measurementConfidence!=='verified')add(f,'measurement','info',`${f.name} dimensions are ${f.measurementConfidence}. Confirm ${f.width.toFixed(2)} × ${f.depth.toFixed(2)} × ${f.height.toFixed(2)} m; fit results are provisional.`);
  if(!room){add(f,'boundary','error',`${f.name} has no assigned room. Choose a room in its properties.`);continue;}
  const poly=footprint(f);
  const outside=Math.max(0,...poly.flatMap(p=>[room.x-p.x,p.x-room.x-room.width,room.z-p.z,p.z-room.z-room.depth]));
  if(outside>EPS)add(f,'boundary','error',`${f.name} extends ${Math.round(outside*100)} cm beyond ${room.name}. Move it inward, rotate it, or reassign its room.`,{distance:outside});
  for(let j=i+1;j<furniture.length;j++){
   const other=furniture[j];if(![other.width,other.depth].every(validDimension))continue;
   const otherPoly=footprint(other),hit=intersection(poly,otherPoly);
   if(hit.overlaps)add(f,'overlap','error',`${f.name} overlaps ${other.name}; approximately ${Math.ceil(hit.depth*100)} cm of separation along a tested axis is needed. Move or rotate either item.`,{otherId:other.id,distance:hit.depth});
   else if(f.roomId===other.roomId&&(['wardrobe','fridge'].includes(f.type)||['wardrobe','fridge'].includes(other.type))){
    const gap=polygonDistance(poly,otherPoly);if(gap+EPS<preferences.clearance)add(f,'clearance','warning',`${f.name} and ${other.name} have ${Math.round(gap*100)} cm between footprints, below your ${Math.round(preferences.clearance*100)} cm clearance setting. Increase the gap to allow access.`,{otherId:other.id,distance:gap});
   }
  }
  for(const door of apartment.openings.filter(d=>d.type==='door')){
   const dr=apartment.rooms.find(r=>r.id===door.roomId);if(!dr)continue;
   if(intersection(poly,openingRegion(door,dr,preferences.clearance)).overlaps)add(f,'door','error',`${f.name} intrudes into the ${Math.round(door.width*100)} cm door's approach in ${dr.name}. Move it outside the dashed swing and clearance area.`,{openingId:door.id});
   if(!f.builtIn&&door.roomId===room.id){const check=doorwayCheck(f,door);if(check.status==='fail'||check.status==='unknown')add(f,'doorway','warning',`${f.name}: ${check.message}`,{openingId:door.id});}
  }
  for(const path of apartment.clearances||[]){if(intersection(poly,rectangle(path.x,path.z,path.width,path.depth)).overlaps)add(f,'path','warning',`${f.name} blocks ${path.name}, a ${Math.round(path.width*100)} cm wide reserved route. Move it out of the marked area.`);}
 }
 return issues;
}
export const itemIssues=(issues,id)=>issues.filter(i=>i.itemId===id||i.otherId===id);
export const fitProblems=issues=>issues.filter(i=>['overlap','boundary','door','path','clearance'].includes(i.kind));
export const area=apartment=>apartment.rooms.reduce((s,r)=>s+r.width*r.depth,0);
export function formatLength(m,units='metric'){if(!Number.isFinite(m))return 'Unknown';if(units==='imperial'){const inches=Math.round(m/0.0254);return `${Math.floor(inches/12)}′ ${inches%12}″`;}return `${m.toFixed(2)} m`;}
export const toMeters=(value,units='metric')=>units==='imperial'?value*0.3048:value;
export const fromMeters=(value,units='metric')=>units==='imperial'?value/0.3048:value;
export const formatArea=(m,units='metric')=>units==='imperial'?`${Math.round(m*10.7639104)} ft²`:`${m.toFixed(1)} m²`;

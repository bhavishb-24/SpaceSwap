import * as THREE from '../../vendor/three.module.js';
import {woodUV} from './materials.js';
import {floorAccents} from '../styling.js';

export function buildArchitecture(apartment, group, studio, cutaway) {
  const materials=studio.materials;
  for(const room of apartment.rooms){
    const center=new THREE.Vector3(room.x+room.width/2,0,room.z+room.depth/2);
    const floor=woodUV(new THREE.BoxGeometry(room.width,.12,room.depth),1.7,center);
    const side=materials.get('stone','#c8c0ae'),top=materials.get(room.floor==='tile'?'tile':'floor');
    studio.mesh(group,floor,[side,side,top,side,side,side],center.x,-.061,center.z);
    if(room.floor==='tile'){
      for(let x=.6;x<room.width;x+=.6)studio.box(group,.006,.002,room.depth,room.x+x,.001,center.z,'grout','',.0001);
      for(let z=.6;z<room.depth;z+=.6)studio.box(group,room.width,.002,.006,center.x,.001,room.z+z,'grout','',.0001);
    }
  }
  for(const rug of floorAccents(apartment)){
    const mesh=studio.box(group,rug.width,.008,rug.depth,rug.x,.004,rug.z,'rug',rug.color,.003);
    mesh.rotation.y=-rug.rotation*Math.PI/180;mesh.castShadow=false;
    const border=new THREE.Group();border.position.set(rug.x,.009,rug.z);border.rotation.y=mesh.rotation.y;group.add(border);
    for(const s of[-1,1]){
      studio.box(border,rug.width-.1,.001,.014,0,0,s*(rug.depth/2-.06),'fabric','#b2a58d',.0003).castShadow=false;
      studio.box(border,.014,.001,rug.depth-.1,s*(rug.width/2-.06),0,0,'fabric','#b2a58d',.0003).castShadow=false;
    }
  }
  // Merge coincident boundaries: an opening from either adjacent room cuts the shared wall.
  const lines=new Map(),minX=Math.min(...apartment.rooms.map(r=>r.x)),minZ=Math.min(...apartment.rooms.map(r=>r.z));
  for(const room of apartment.rooms)for(const side of['north','south','east','west']){
    const horizontal=['north','south'].includes(side),constant=horizontal?room.z+(side==='south'?room.depth:0):room.x+(side==='east'?room.width:0);
    const start=horizontal?room.x:room.z,end=start+(horizontal?room.width:room.depth),key=`${horizontal?'h':'v'}:${constant.toFixed(5)}`;
    if(!lines.has(key))lines.set(key,{horizontal,constant,spans:[],openings:[]});
    const line=lines.get(key);line.spans.push([start,end]);
    for(const opening of apartment.openings.filter(o=>o.roomId===room.id&&o.wall===side))line.openings.push({...opening,start:start+opening.offset,end:start+opening.offset+opening.width});
  }
  for(const line of lines.values()){
    const {horizontal,constant}=line;
    const keepBack=horizontal?Math.abs(constant-minZ)<.001:Math.abs(constant-minX)<.001;
    const height=cutaway&&!keepBack?.19:2.65;
    const spans=[];
    for(const span of line.spans.sort((a,b)=>a[0]-b[0])){const last=spans[spans.length-1];if(last&&span[0]<=last[1]+.001)last[1]=Math.max(last[1],span[1]);else spans.push([...span]);}
    const openings=[];
    for(const o of line.openings.sort((a,b)=>a.start-b.start))if(!openings.some(x=>Math.abs(x.start-o.start)<.001&&Math.abs(x.end-o.end)<.001))openings.push(o);
    const element=(start,end,bottom,top,kind='plaster',thickness=.12,offset=0)=>{
      if(end<=start+.001||top<=bottom+.001)return;
      const x=horizontal?(start+end)/2:constant+offset,z=horizontal?constant+offset:(start+end)/2;
      return studio.box(group,horizontal?end-start:thickness,top-bottom,horizontal?thickness:end-start,x,(top+bottom)/2,z,kind,'',.004);
    };
    const solid=(start,end,bottom,top)=>{element(start,end,bottom,top);if(bottom===0&&top>.12)for(const offset of[-.065,.065])element(start,end,.008,.1,'trim',.015,offset);};
    for(const [start,end]of spans){
      let cursor=start;
      for(const o of openings.filter(o=>o.end>start&&o.start<end)){
        const left=Math.max(start,o.start),right=Math.min(end,o.end);solid(cursor,left,0,height);
        if(o.type==='door'){
          element(left,right,Math.min(height,o.height),height);
          if(height>o.height)for(const offset of[-.075,.075]){element(left-.025,left+.025,0,o.height+.04,'trim',.018,offset);element(right-.025,right+.025,0,o.height+.04,'trim',.018,offset);element(left,right,o.height,o.height+.045,'trim',.018,offset);}
        }else{
          const sill=.94,top=Math.min(sill+o.height,2.35);solid(left,right,0,Math.min(height,sill));element(left,right,top,height);
          if(height>sill){
            const visibleTop=Math.min(top,height),frame=.045;
            element(left,right,sill,sill+frame,'trim',.18);element(left,right,visibleTop-frame,visibleTop,'trim',.14);
            element(left,left+frame,sill,visibleTop,'trim',.14);element(right-frame,right,sill,visibleTop,'trim',.14);element((left+right)/2-.018,(left+right)/2+.018,sill,visibleTop,'trim',.09);
            const glass=element(left+frame,right-frame,sill+frame,visibleTop-frame,'glass',.018);if(glass)glass.castShadow=false;
            if(keepBack&&o.width>1.4)curtains(group,studio,line,left,right,sill,visibleTop);
          }
        }
        cursor=Math.max(cursor,right);
      }
      solid(cursor,end,0,height);
    }
  }
  const living=apartment.rooms.find(r=>/living/i.test(r.name)&&Math.abs(r.x-minX)<.01);
  if(living)wallArt(group,studio,living);
}

function curtains(group,studio,line,left,right,sill,top){
  const horizontal=line.horizontal,c=line.constant,rodHeight=Math.min(2.48,top+.19),bottom=.17;
  const place=(along,y,inset)=>horizontal?[along,y,c+inset]:[c+inset,y,along];
  studio.rod(group,place(left-.22,rodHeight,.16),place(right+.22,rodHeight,.16),.012,'brass');
  for(const along of[left-.04,right+.04]){
    const width=.36,geometry=new THREE.PlaneGeometry(width,rodHeight-bottom,32,20),p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),wave=Math.sin((x/width+.5)*Math.PI*10)*.034;p.setZ(i,wave);p.setX(i,x*(1+.08*(1-y/(rodHeight-bottom))));}
    geometry.computeVertexNormals();const material=studio.materials.get('fabric','#e8e1d3');material.side=THREE.DoubleSide;
    const curtain=studio.mesh(group,geometry,material,...place(along,(rodHeight+bottom)/2,.17));if(!horizontal)curtain.rotation.y=Math.PI/2;
  }
}

function wallArt(group,studio,room){
  const z=room.z+room.depth*.54,y=1.62,x=room.x+.078;
  studio.box(group,.045,1.06,.87,x,y,z,'walnut','',.008);
  if(!studio.materials.artworkMaterial){
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=480;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#eee8d9';ctx.fillRect(0,0,384,480);ctx.fillStyle='#b8bba3';ctx.beginPath();ctx.roundRect(42,110,155,330,76);ctx.fill();
  ctx.fillStyle='#b8a487';ctx.beginPath();ctx.ellipse(262,178,67,108,-.25,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#76765d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(143,395);ctx.bezierCurveTo(310,370,168,225,304,76);ctx.stroke();
  const texture=studio.materials.texture(canvas,true),material=new THREE.MeshStandardMaterial({map:texture,roughness:1});studio.materials.artworkMaterial=material;studio.materials.materials.set('wall-art',material);}
  const mesh=studio.mesh(group,new THREE.PlaneGeometry(.79,.98),studio.materials.artworkMaterial,x+.025,y,z);mesh.rotation.y=Math.PI/2;
}

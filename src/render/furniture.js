import * as THREE from '../../vendor/three.module.js';
import {RoundedBoxGeometry} from '../../vendor/geometries/RoundedBoxGeometry.js';
import {woodUV} from './materials.js';
import {catalog} from '../data.js';

export class FurnitureStudio {
  constructor(materials) {this.materials = materials;}
  mesh(group, geometry, material, x=0,y=0,z=0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  box(group,w,h,d,x,y,z,kind='oak',color='',radius=.012) {
    const r=Math.max(.0001,Math.min(radius,w/2-.0001,h/2-.0001,d/2-.0001));
    const geometry=new RoundedBoxGeometry(w,h,d,3,r);
    if(['oak','walnut'].includes(kind))woodUV(geometry);
    return this.mesh(group,geometry,this.materials.get(kind,color),x,y,z);
  }
  rod(group,start,end,radius,kind='walnut',endRadius=radius){
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a);
    const mesh=this.mesh(group,new THREE.CylinderGeometry(endRadius,radius,delta.length(),12),this.materials.get(kind));
    mesh.position.copy(a.add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    return mesh;
  }
  tube(group,points,radius,kind='metal',color='',closed=false){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    return this.mesh(group,new THREE.TubeGeometry(curve,Math.max(18,points.length*5),radius,6,closed),this.materials.get(kind,color));
  }
  seam(group,w,d,y,color='#aaa18f'){
    const r=Math.min(w,d)*.12,pts=[];
    for(let corner=0;corner<4;corner++){
      const cx=[1,-1,-1,1][corner]*(w/2-r),cz=[1,1,-1,-1][corner]*(d/2-r);
      for(let i=0;i<5;i++){const angle=corner*Math.PI/2+i*Math.PI/8;pts.push([cx+Math.cos(angle)*r,y,cz+Math.sin(angle)*r]);}
    }
    return this.tube(group,pts,.0022,'fabric',color,true);
  }
  cushion(group,w,h,d,x,y,z,color='#d1c6b3',seam=true){
    const holder=new THREE.Group();holder.position.set(x,y,z);group.add(holder);
    const geometry=new RoundedBoxGeometry(w,h,d,7,Math.min(w,h,d)*.44);
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const xx=p.getX(i)/(w/2),yy=p.getY(i)/(h/2),zz=p.getZ(i)/(d/2);
      const bulge=(1-xx*xx)*(1-zz*zz)*.018;
      p.setY(i,p.getY(i)+Math.sign(yy)*bulge*Math.abs(yy));
      if(d<h)p.setZ(i,p.getZ(i)+Math.sign(zz)*(1-xx*xx)*(1-yy*yy)*.028*Math.abs(zz));
      const crease=Math.sin(xx*22+zz*9)*.0018*Math.pow(Math.abs(xx*zz),3);
      p.setY(i,p.getY(i)+crease);
    }
    geometry.computeVertexNormals();this.mesh(holder,geometry,this.materials.get('fabric',color));
    if(seam){const trim=new THREE.Group();holder.add(trim);if(d<h){trim.rotation.x=Math.PI/2;this.seam(trim,w-.018,h-.018,0,new THREE.Color(color).multiplyScalar(.89).getStyle());}else this.seam(trim,w-.018,d-.018,h*.12,new THREE.Color(color).multiplyScalar(.89).getStyle());}
    return holder;
  }
  lathe(group,profile,x,y,z,kind='ceramic',color=''){
    return this.mesh(group,new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),40),this.materials.get(kind,color),x,y,z);
  }
  vase(group,x,y,z,size=.16,color='#d8ccba'){
    return this.lathe(group,[[.02,0],[.065,.015],[.08,.07],[.068,.14],[.035,.18],[.03,.23],[.038,.24]],x,y,z,'ceramic',color).scale.setScalar(size/.24);
  }
  cloth(group,w,d,x,y,z,color,fold=0){
    const geometry=new THREE.PlaneGeometry(w,d,38,30);geometry.rotateX(-Math.PI/2);
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const xx=p.getX(i),zz=p.getZ(i),u=xx/(w/2),v=zz/(d/2);
      const drape=-.085*Math.pow(Math.max(0,(Math.abs(u)-.8)/.2),2)-.07*Math.pow(Math.max(0,(v-.82)/.18),2);
      const ripples=Math.sin(u*12+v*2)*.008+Math.sin(v*9-u*5)*.005;
      const crease=fold?Math.sin(u*26+v)*.012+Math.exp(-Math.pow((v+.7)*8,2))*.035:0;
      p.setY(i,drape+ripples+crease);
    }
    geometry.computeVertexNormals();const material=this.materials.get('fabric',color);material.side=THREE.DoubleSide;
    return this.mesh(group,geometry,material,x,y,z);
  }
  create(f){
    const g=new THREE.Group(),w=f.width,d=f.depth,h=f.height;
    const color=f.color||'#d2c7b3';
    const defaultTint=catalog.find(item=>item.type===f.type)?.color||(f.builtIn?'#d5c9b2':color);
    const customTint=color!==defaultTint;
    const box=(W,H,D,x,y,z,kind='oak',c='',r=.012)=>this.box(g,W,H,D,x,y,z,kind,customTint&&['oak','walnut','ivory'].includes(kind)?color:c,r);
    const legs=(top,spread=.04,kind='walnut',r=.028)=>{
      for(const x of[-1,1])for(const z of[-1,1])this.rod(g,[x*(w/2-.09+spread),.015,z*(d/2-.09+spread)],[x*(w/2-.09),top,z*(d/2-.09)],r,kind,r*1.3);
    };
    switch(f.type){
      case 'sofa': {
        legs(.19,0,'walnut',.032);
        box(w-.13,.12,d-.12,0,.19,0,'walnut','',.025);
        this.cushion(g,w-.04,.2,d-.02,0,.29,0,color,false);
        const back=this.cushion(g,w-.12,h*.53,.2,0,h*.68,-d/2+.13,color,false);back.rotation.x=-.07;
        for(const s of[-1,1]){
          this.cushion(g,.22,.42,d-.02,s*(w/2-.11),.45,0,color,false);
          this.cushion(g,(w-.5)/2,.17,d-.28,s*(w-.5)/4,.43,.07,'#ded4c2');
          const pillow=this.cushion(g,(w-.52)/2,.36,.19,s*(w-.52)/4,.65,-d*.23,color);pillow.rotation.x=-.16;
        }
        const sage=this.cushion(g,.34,.34,.13,-w*.29,.63,-.01,'#8e9c7d');sage.rotation.z=.16;sage.rotation.x=-.16;
        const oatmeal=this.cushion(g,.31,.31,.12,w*.29,.62,.02,'#b5a792');oatmeal.rotation.z=-.15;oatmeal.rotation.x=-.17;
        break;
      }
      case 'bed': {
        legs(.17,0,'walnut',.035);box(w-.05,.18,d-.03,0,.21,0,'walnut','',.045);
        this.cushion(g,w,.15,d,0,.34,0,'#c5b89e',false);
        this.cushion(g,w-.1,.22,d-.1,0,.47,0,'#f0eadd');
        this.cushion(g,w,.84,.14,0,.53,-d/2+.07,color,false);
        for(let i=1;i<6;i++)this.tube(g,[[-w/2+i*w/6,.28,-d/2+.148],[-w/2+i*w/6,.88,-d/2+.148]],.002,'fabric','#b8ac97');
        for(const s of[-1,1]){
          const pillow=this.cushion(g,w*.42,.16,d*.23,s*w*.23,.64,-d*.29,'#f4eee2');pillow.rotation.y=s*.045;
          const accent=this.cushion(g,w*.23,.09,d*.17,s*w*.23,.73,-d*.21,s<0?'#b4baa3':'#d0c1a7');accent.rotation.y=-s*.06;
        }
        this.cloth(g,w-.045,d*.66,0,.62,d*.15,'#e7dfce');
        this.cloth(g,w-.025,.33,0,.65,-d*.13,'#f3ecdf',1);
        this.cloth(g,w-.02,.55,0,.655,d*.32,'#8e9b7f',1);
        break;
      }
      case 'desk': {
        legs(h-.06,.035,'walnut',.025);
        box(w-.16,.075,d-.17,0,h-.105,0,'walnut');
        box(w,.045,d,0,h-.024,0,'oak','#dac3a1',.02);
        box(w*.42,.09,d*.66,w*.19,h-.12,.04,'walnut','',.01);
        box(.18,.012,.012,w*.19,h-.12,d*.37,'brass','',.005);
        this.rod(g,[-w*.35,.25,-d*.25],[w*.35,.25,-d*.25],.014,'metal');
        box(w*.4,.002,d*.43,-w*.17,h-.0008,0,'dark','',.015);
        box(.2,.004,.16,w*.3,h+.001,d*.11,'paper','',.005);
        break;
      }
      case 'chair': {
        legs(h*.52,.025,'walnut',.022);
        box(w-.03,.045,d-.04,0,h*.5,0,'walnut','',.08);
        this.cushion(g,w-.04,.09,d-.04,0,h*.55,0,color);
        const back=this.cushion(g,w,.29,.075,0,h*.82,-d*.4,color,false);back.rotation.x=-.12;
        for(const s of[-1,1])this.rod(g,[s*w*.39,h*.48,-d*.32],[s*w*.39,h*.85,-d*.4],.018,'walnut');
        break;
      }
      case 'dining': {
        for(const s of[-1,1]){
          const leg=box(.12,h-.06,d*.6,s*w*.29,(h-.06)/2,0,'walnut','',.03);leg.rotation.z=s*.14;
          box(.28,.05,d*.65,s*w*.33,.026,0,'walnut','',.02);
        }
        box(w*.65,.08,.09,0,h*.42,0,'walnut','',.025);
        box(w-.04,.04,d-.04,0,h-.055,0,'walnut','',.019);
        box(w,.045,d,0,h-.0225,0,'oak','#e8d5b8',.022);
        break;
      }
      case 'coffee': {
        const shape=new THREE.Shape();shape.moveTo(-w*.48,-d*.2);shape.bezierCurveTo(-w*.54,-d*.5,-w*.13,-d*.56,w*.26,-d*.43);shape.bezierCurveTo(w*.6,-d*.3,w*.53,d*.25,w*.26,d*.43);shape.bezierCurveTo(-w*.1,d*.58,-w*.49,d*.32,-w*.48,-d*.2);
        const geometry=new THREE.ExtrudeGeometry(shape,{depth:.04,bevelEnabled:true,bevelSize:.013,bevelThickness:.009,bevelSegments:3,curveSegments:16});geometry.rotateX(-Math.PI/2);woodUV(geometry);
        this.mesh(g,geometry,this.materials.get('oak','#d6bd94'),0,h-.055,0);
        for(const [x,z]of[[-w*.3,-d*.22],[w*.25,-d*.17],[0,d*.26]])this.lathe(g,[[.07,0],[.065,.02],[.045,h-.08],[.055,h-.04]],x,0,z,'walnut');
        break;
      }
      case 'wardrobe': {
        box(w-.1,.1,d-.08,0,.05,0,'dark');
        box(w,h-.12,d,0,h/2+.06,0,'walnut','',.015);
        for(const s of[-1,1]){
          box(w/2-.018,h-.18,.035,s*w/4,h/2+.065,d/2+.008,'ivory','#d7cdbb',.009);
          for(let i=0;i<9;i++)box(.012,h-.24,.012,s*w/4-w*.22+i*w*.055,h/2+.065,d/2+.03,'oak','#cbbca2',.005);
          this.rod(g,[s*.045,h*.43,d/2+.055],[s*.045,h*.57,d/2+.055],.008,'metal');
        }
        break;
      }
      case 'bookshelf': {
        box(w,h,.025,0,h/2,-d/2+.012,'ivory','#c6b99f');
        for(const s of[-1,1])box(.035,h,d,s*(w/2-.0175),h/2,0,'walnut');
        for(let i=0;i<5;i++){
          const y=.04+i*(h-.08)/4;box(w,.028,d,0,y,0,'walnut');
          if(i<4){const left=i%2===0;for(let j=0;j<4;j++){
            const bookH=.17+(j%3)*.035,x=(left?-w*.31:w*.02)+j*.065;
            box(.047,bookH,d*.64,x,y+bookH/2+.018,0,'paper',['#919d7e','#d3bfa4','#e4ddce','#9b7964'][j],.003);
            box(.049,.006,.009,x,y+bookH*.7,d*.326,'paper','#e3d8bc',.001);
          }this.vase(g,left?w*.25:-w*.26,y+.016,0,.18,i%2?'#a4ad90':'#d8c8ae');}
        }
        break;
      }
      case 'lamp': {
        this.lathe(g,[[0,0],[w*.34,0],[w*.38,.02],[w*.34,.055],[.035,.065]],0,0,0,'metal');
        this.tube(g,[[0,.04,0],[0,h*.5,0],[.025,h*.76,0],[.04,h*.84,0],[0,h*.88,0]],.011,'brass');
        const shadeH=h*.21,geometry=new THREE.CylinderGeometry(w*.29,w*.48,shadeH,96,5,true),p=geometry.attributes.position;
        for(let i=0;i<p.count;i++){const angle=Math.atan2(p.getZ(i),p.getX(i)),pleat=1+.018*Math.cos(angle*48);p.setX(i,p.getX(i)*pleat);p.setZ(i,p.getZ(i)*pleat);}geometry.computeVertexNormals();
        const shade=this.materials.get('fabric',customTint?color:'#e5d8bd');shade.side=THREE.DoubleSide;shade.emissive=new THREE.Color('#a88d57');shade.emissiveIntensity=.12;
        this.mesh(g,geometry,shade,0,h-shadeH/2,0);
        for(const [y,r]of[[h-shadeH,w*.48],[h,w*.29]]){const torus=this.mesh(g,new THREE.TorusGeometry(r,.005,6,64),this.materials.get('brass'),0,y,0);torus.rotation.x=Math.PI/2;}
        this.lathe(g,[[0,0],[w*.34,0],[w*.34,.005],[0,.005]],0,h-shadeH+.02,0,'ivory','#fff1d0');
        break;
      }
      case 'fridge': {
        box(w,h,d,0,h/2,0,'metal','#cbd0c7',.035);
        box(w-.025,h*.68,d*.03,0,h*.345,d/2,'ivory','#dedfd6',.012);
        box(w-.025,h*.28,d*.03,0,h*.85,d/2,'ivory','#dedfd6',.012);
        for(const y of[h*.5,h*.79])this.rod(g,[w*.33,y-.08,d/2+.02],[w*.33,y+.08,d/2+.02],.009,'metal');break;
      }
      case 'plant': {
        this.lathe(g,[[w*.18,0],[w*.24,.03],[w*.27,h*.3],[w*.29,h*.32],[w*.25,h*.33]],0,0,0,'ceramic','#c9b899');
        this.lathe(g,[[0,0],[w*.25,0],[w*.25,.01],[0,.01]],0,h*.31,0,'dark','#655d45');
        for(let i=0;i<12;i++){
          const angle=i*2.4,reach=w*(.2+(i%3)*.05),yy=h*(.5+(i%5)*.1),x=Math.cos(angle)*reach,z=Math.sin(angle)*reach;
          this.tube(g,[[0,h*.3,0],[x*.4,yy*.85,z*.4],[x,yy,z]],.004,'leaf');
          const leaf=this.mesh(g,new THREE.SphereGeometry(1,12,8),this.materials.get('leaf',i%2?'#74865b':'#5e754c'),x,yy,z);leaf.scale.set(w*.14,.018,w*.22);leaf.rotation.set(.3,angle,.2);
        }break;
      }
      case 'kitchen': {
        box(w*.96,h*.12,d*.96,0,h*.06,0,'dark');box(w,h*.8,d,0,h*.5,0,'ivory','#c7c9b9',.015);
        box(w+.025,.055,d+.025,0,h-.025,0,'stone','#e1d9c8',.016);
        for(let i=0;i<3;i++){const zz=-d/2+(i+.5)*d/3;box(.025,h*.72,d/3-.02,w/2+.012,h*.51,zz,'ivory','#d3d1c2',.006);this.rod(g,[w/2+.035,h*.8,zz-.06],[w/2+.035,h*.8,zz+.06],.006,'metal');}
        box(w*.62,.01,d*.28,0,h+.006,-d*.24,'metal','#494f47',.025);
        for(const x of[-1,1])for(const z of[-1,1]){const ring=this.mesh(g,new THREE.TorusGeometry(.065,.003,6,24),this.materials.get('metal','#979d91'),x*w*.16,h+.015,-d*.24+z*d*.075);ring.rotation.x=Math.PI/2;}
        box(w*.62,.015,d*.27,0,h+.005,d*.23,'metal','#adada1',.03);box(w*.48,.017,d*.19,0,h+.012,d*.23,'dark','#8d9189',.03);
        this.tube(g,[[-w*.3,h,d*.23],[-w*.3,h+.18,d*.23],[-w*.1,h+.23,d*.23],[0,h+.18,d*.23]],.008,'metal');break;
      }
      case 'vanity': {
        box(w-.1,h*.2,d-.08,0,h*.1,0,'dark');box(w,h*.75,d,0,h*.5,0,'walnut','',.02);
        for(const s of[-1,1])box(w/2-.018,h*.65,.025,s*w/4,h*.53,d/2,'oak','#d9c6a6',.006);
        box(w+.02,.04,d+.02,0,h*.9,0,'stone','#e5dfd2',.015);
        this.lathe(g,[[0,0],[.17,0],[.2,.025],[.22,.09],[.2,.1],[.17,.04],[0,.03]],0,h*.91,0,'ceramic','#f5f1e7');
        this.tube(g,[[0,h*.9,-d*.34],[0,h*1.15,-d*.34],[0,h*1.18,-d*.05],[0,h*1.12,0]],.012,'brass');break;
      }
      case 'toilet': {
        const base=this.mesh(g,new THREE.SphereGeometry(1,32,20),this.materials.get('ceramic','#eeeae0'),0,h*.3,d*.1);base.scale.set(w*.43,h*.28,d*.43);
        box(w*.76,h*.65,d*.25,0,h*.58,-d*.31,'ceramic','#eeeae0',.07);
        const seat=this.mesh(g,new THREE.TorusGeometry(1,.15,10,40),this.materials.get('ceramic','#faf7ef'),0,h*.54,d*.13);seat.rotation.x=Math.PI/2;seat.scale.set(w*.38,d*.35,.12);
        box(.08,.012,.045,0,h*.92,-d*.31,'metal','',.01);break;
      }
      case 'shower': {
        box(w,.055,d,0,.028,0,'stone','#dfded4',.025);
        box(.012,h,d,-w/2,h/2,0,'glass');box(w,h,.012,0,h/2,-d/2,'glass');
        for(const x of[-w/2,w/2])this.rod(g,[x,.04,-d/2],[x,h,-d/2],.008,'brass');
        this.rod(g,[-w/2,h,-d/2],[w/2,h,-d/2],.008,'brass');
        this.tube(g,[[w*.3,h*.25,-d*.4],[w*.3,h*.91,-d*.4],[w*.3,h*.95,-d*.18]],.01,'brass');
        box(.23,.016,.23,w*.3,h*.94,-d*.16,'metal','',.04);box(.06,.008,.06,0,.06,0,'metal');break;
      }
      default:box(w,h,d,0,h/2,0,'oak',color,.025);
    }
    return g;
  }
}

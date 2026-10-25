import * as THREE from '../vendor/three.module.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {RGBELoader} from '../vendor/loaders/RGBELoader.js';
import {InteriorMaterials} from './render/materials.js';
import {FurnitureStudio} from './render/furniture.js';
import {assetManifest,loadFurnitureAsset,cloneFurnitureAsset,normalizeFurniture} from './render/assets.js';
import {buildArchitecture} from './render/architecture.js';
import {planBounds} from './plan.js';
import {analyze,fitProblems,itemIssues} from './geometry.js';
import {batchStaticMeshes} from './render/batch.js';

export class ApartmentScene {
  constructor(container,options){
    this.container=container;this.options=options;this.cutaway=true;this.disposed=false;
    this.apartmentId=options.apartment().id;this.templates=new Map();this.assetState={status:'loading',loaded:0,failed:[]};
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e8e8df');
    this.camera=new THREE.PerspectiveCamera(36,1,.08,150);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.VSMShadowMap;
    this.renderer.shadowMap.autoUpdate=false;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.14;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','3D interior. Drag to orbit; scroll to zoom; right-drag to pan. Select furniture to edit its exact dimensions.');
    this.status=document.createElement('div');this.status.className='scene-asset-status';this.status.setAttribute('role','status');this.status.textContent='Refining local materials…';container.appendChild(this.status);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.09;
    this.controls.minDistance=2;this.controls.maxDistance=45;this.controls.maxPolarAngle=Math.PI*.46;this.controls.minPolarAngle=.01;
    this.controls.addEventListener('change',()=>this.requestRender());
    this.scene.add(new THREE.HemisphereLight(0xf6f2e8,0x8e9585,1.05));
    this.sun=new THREE.DirectionalLight(0xfff1d9,1.8);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.radius=3;this.sun.shadow.blurSamples=8;this.sun.shadow.normalBias=.01;this.sun.shadow.bias=-.00012;
    Object.assign(this.sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:40});
    this.scene.add(this.sun,this.sun.target);
    const fill=new THREE.DirectionalLight(0xe4edff,.38);fill.position.set(8,5,10);this.scene.add(fill);
    this.materials=new InteriorMaterials(this.renderer,()=>this.requestRender());this.studio=new FurnitureStudio(this.materials);
    this.model=new THREE.Group();this.scene.add(this.model);
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#e8e8df',roughness:1}));
    this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-.14;this.scene.add(this.ground);
    this.groundShadow=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.13}));this.groundShadow.rotation.x=-Math.PI/2;this.groundShadow.position.y=-.139;this.groundShadow.receiveShadow=true;this.scene.add(this.groundShadow);
    this.contactTexture=this.createContactTexture();
    this.raycaster=new THREE.Raycaster();this.downPosition=null;
    this.onDown=e=>this.downPosition={x:e.clientX,y:e.clientY};
    this.onUp=e=>{
      if(!this.downPosition||Math.hypot(e.clientX-this.downPosition.x,e.clientY-this.downPosition.y)>5||e.button!==0)return;
      const rect=this.renderer.domElement.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);
      const hit=this.raycaster.intersectObjects(this.model.children,true).find(h=>h.object.userData.furnitureId||!h.object.material?.transparent);
      this.options.select(hit?.object.userData.furnitureId||null);
    };
    this.renderer.domElement.addEventListener('pointerdown',this.onDown);this.renderer.domElement.addEventListener('pointerup',this.onUp);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.build();this.resize();this.initializing=true;this.resetCamera();this.initializing=false;this.animate();
    this.ready=this.loadDetails();
  }

  async loadDetails(){
    const types=[...new Set(this.options.apartment().furniture.map(f=>f.type))].filter(type=>assetManifest[type]);
    const jobs=types.map(async type=>{const template=await loadFurnitureAsset(type);if(this.disposed)return;if(template){this.templates.set(type,template);this.assetState.loaded++;}else this.assetState.failed.push(type);this.status.textContent=`Refining local details · ${this.assetState.loaded}/${types.length}`;});
    jobs.push(this.loadEnvironment(),this.materials.ready);
    await Promise.allSettled(jobs);
    if(this.disposed)return;
    this.assetState.status=this.assetState.failed.length?'fallback':'ready';
    this.status.textContent=this.assetState.failed.length?'Some detail assets are unavailable. Matching studio models are shown.':'';
    this.status.classList.toggle('has-fallback',this.assetState.failed.length>0);this.status.hidden=!this.assetState.failed.length;
    this.build();
  }

  async loadEnvironment(){
    try{
      const hdr=await new RGBELoader().loadAsync(new URL('../assets/environment/studio_small_09.hdr',import.meta.url).href);
      if(this.disposed){hdr.dispose();return;}
      const generator=new THREE.PMREMGenerator(this.renderer);this.environment=generator.fromEquirectangular(hdr);hdr.dispose();generator.dispose();
      this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.45;this.scene.environmentRotation.y=.8;this.requestRender();
    }catch{ /* Physical daylight and fill remain available if the optional HDR fails. */ }
  }

  createContactTexture(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
    const gradient=ctx.createRadialGradient(64,64,10,64,64,64);gradient.addColorStop(0,'rgba(65,52,31,.3)');gradient.addColorStop(.65,'rgba(65,52,31,.12)');gradient.addColorStop(1,'rgba(65,52,31,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return this.materials.texture(canvas,true);
  }

  clearModel(){
    this.model.traverse(child=>{
      if(!child.userData.sharedAsset)child.geometry?.dispose();
      const materials=Array.isArray(child.material)?child.material:[child.material];
      for(const material of materials)if(material?.userData.owned)material.dispose();
    });
    this.model.clear();
  }

  build(){
    this.clearModel();const apartment=this.options.apartment();
    const architecture=new THREE.Group();buildArchitecture(apartment,architecture,this.studio,this.cutaway);
    this.architecture=batchStaticMeshes(architecture);this.architecture.name='Architecture';this.model.add(this.architecture);
    const bounds=planBounds(apartment,0),center=new THREE.Vector3(bounds.x+bounds.w/2,0,bounds.y+bounds.h/2);
    this.sun.position.copy(center).add(new THREE.Vector3(-5,15,-7));this.sun.target.position.copy(center);
    const span=Math.max(bounds.w,bounds.h)+1;Object.assign(this.sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span});this.sun.shadow.camera.updateProjectionMatrix();
    const issues=this.options.showChecks?.()?analyze(apartment,this.options.preferences?.()||{clearance:.6}):[];
    for(const item of apartment.furniture){
      if(![item.width,item.height,item.depth].every(v=>Number.isFinite(v)&&v>0))continue;
      let source=this.templates.has(item.type)?cloneFurnitureAsset(this.templates.get(item.type),item,this.materials):batchStaticMeshes(this.studio.create(item));
      let instance;
      try{instance=normalizeFurniture(source,item);}catch{source=batchStaticMeshes(this.studio.create(item));instance=normalizeFurniture(source,item);}
      instance.name=item.name;instance.userData.loadedAsset=this.templates.has(item.type);this.model.add(instance);
      const shadowMaterial=new THREE.MeshBasicMaterial({map:this.contactTexture,transparent:true,depthWrite:false,opacity:.55});shadowMaterial.userData.owned=true;
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(item.width*1.12,item.depth*1.12),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.rotation.z=-item.rotation*Math.PI/180;shadow.position.set(item.x,.009,item.z);this.model.add(shadow);
      if(this.options.selected()===item.id||fitProblems(itemIssues(issues,item.id)).length){
        const corners=[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([x,z])=>new THREE.Vector3(x*(item.width/2+.025),.025,z*(item.depth/2+.025)));
        const material=new THREE.LineBasicMaterial({color:this.options.selected()===item.id?0x537b4e:0xb48152});material.userData.owned=true;
        const outline=new THREE.Line(new THREE.BufferGeometry().setFromPoints(corners),material);outline.position.set(item.x,0,item.z);outline.rotation.y=-item.rotation*Math.PI/180;this.model.add(outline);
      }
    }
    this.renderer.shadowMap.needsUpdate=true;
    this.requestRender();
  }

  resetCamera(top=false){
    const b=planBounds(this.options.apartment(),.1);this.frameBounds(new THREE.Box3(new THREE.Vector3(b.x,0,b.y),new THREE.Vector3(b.x+b.w,2.65,b.y+b.h)),top);
  }

  focusRoom(){
    const apartment=this.options.apartment(),selected=this.options.selected(),item=apartment.furniture.find(f=>f.id===selected);
    const room=apartment.rooms.find(r=>r.id===(item?.roomId||selected))||apartment.rooms.find(r=>/living/i.test(r.name))||apartment.rooms[0];
    if(room)this.frameBounds(new THREE.Box3(new THREE.Vector3(room.x,.1,room.z),new THREE.Vector3(room.x+room.width,1.8,room.z+room.depth)),false,true);
  }

  frameBounds(box,top=false,detail=false){
    const startPosition=this.camera.position.clone(),startTarget=this.controls.target.clone();
    const center=box.getCenter(new THREE.Vector3());center.y=detail?.65:.7;
    const size=box.getSize(new THREE.Vector3()),direction=top?new THREE.Vector3(0,1,.0001):new THREE.Vector3(1.08,1.18,1.38).normalize();
    let distance=Math.max(size.x,size.z)*(detail?1.6:1.85);this.controls.target.copy(center);
    for(let pass=0;pass<5;pass++){
      this.camera.position.copy(center).addScaledVector(direction,distance);this.camera.lookAt(center);this.camera.updateMatrixWorld();let extent=0;
      for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(this.camera);extent=Math.max(extent,Math.abs(p.x)/.89,Math.abs(p.y)/.82);}
      if(extent>.99)distance*=Math.max(1.01,extent);else if(pass===0)distance*=Math.max(.7,extent);else break;
    }
    const endPosition=center.clone().addScaledVector(direction,distance),endTarget=center.clone();
    if(this.initializing||matchMedia('(prefers-reduced-motion: reduce)').matches){this.camera.position.copy(endPosition);this.controls.target.copy(endTarget);this.controls.update();this.requestRender();return;}
    this.camera.position.copy(startPosition);this.controls.target.copy(startTarget);this.cameraTween={fromPosition:startPosition,fromTarget:startTarget,toPosition:endPosition,toTarget:endTarget,start:performance.now(),duration:360};this.controls.enabled=false;this.requestRender();
  }

  resize(){const{width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.requestRender();}
  requestRender(){this.dirty=true;}
  animate(time=performance.now()){if(this.disposed)return;this.frame=requestAnimationFrame(next=>this.animate(next));if(this.cameraTween){const tween=this.cameraTween,t=Math.min(1,(time-tween.start)/tween.duration),eased=1-Math.pow(1-t,3);this.camera.position.lerpVectors(tween.fromPosition,tween.toPosition,eased);this.controls.target.lerpVectors(tween.fromTarget,tween.toTarget,eased);this.dirty=true;if(t===1){this.cameraTween=null;this.controls.enabled=true;}}this.controls.update();if(this.dirty){this.renderer.render(this.scene,this.camera);this.dirty=false;}}
  dispose(){
    this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerdown',this.onDown);this.renderer.domElement.removeEventListener('pointerup',this.onUp);
    this.clearModel();this.ground.geometry.dispose();this.ground.material.dispose();this.groundShadow.geometry.dispose();this.groundShadow.material.dispose();this.environment?.dispose();this.materials.dispose();
    this.sun.shadow.map?.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.container.innerHTML='';
  }
}

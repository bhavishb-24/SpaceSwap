import * as THREE from '../../vendor/three.module.js';
import {mergeGeometries} from '../../vendor/utils/BufferGeometryUtils.js';

/** Bake fixed local transforms and combine meshes with the same material into one draw call. */
export function batchStaticMeshes(root) {
  root.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),batches=new Map(),kept=[];
  root.traverse(child=>{
    if(!child.isMesh)return;
    if(Array.isArray(child.material)){kept.push(child);return;}
    const key=child.material.uuid;
    if(!batches.has(key))batches.set(key,{material:child.material,geometries:[],cast:false,receive:false});
    const batch=batches.get(key),transform=new THREE.Matrix4().multiplyMatrices(inverse,child.matrixWorld);
    const clone=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
    clone.applyMatrix4(transform);
    // These are intentionally static, unskinned meshes; only the common PBR attributes are needed.
    for(const name of Object.keys(clone.attributes))if(!['position','normal','uv'].includes(name))clone.deleteAttribute(name);
    batch.geometries.push(clone);batch.cast ||= child.castShadow;batch.receive ||= child.receiveShadow;
  });
  const result=new THREE.Group();
  for(const batch of batches.values()){
    const geometry=mergeGeometries(batch.geometries,false);
    batch.geometries.forEach(g=>g.dispose());
    if(!geometry)throw Error('Unable to batch static interior geometry.');
    const mesh=new THREE.Mesh(geometry,batch.material);mesh.castShadow=batch.cast;mesh.receiveShadow=batch.receive;result.add(mesh);
  }
  for(const child of kept){child.updateMatrixWorld();const copy=new THREE.Mesh(child.geometry.clone(),child.material);copy.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,child.matrixWorld));copy.castShadow=child.castShadow;copy.receiveShadow=child.receiveShadow;result.add(copy);}
  root.traverse(child=>child.geometry?.dispose());
  return result;
}

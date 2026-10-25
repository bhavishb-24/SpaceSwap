import * as THREE from '../../vendor/three.module.js';
import {GLTFLoader} from '../../vendor/loaders/GLTFLoader.js';
import {catalog} from '../data.js';

export const assetManifest = {
  chair: {asset: 'modern_arm_chair_01', rotation: 0, author: 'Vibrant Nordic'},
  coffee: {asset: 'modern_coffee_table_01', rotation: 0, author: 'Amin'},
  plant: {asset: 'potted_plant_02', rotation: 0, author: 'Rico Cilliers'},
};
const cache = new Map();
const failed = new Map();
const loader = new GLTFLoader();

export async function loadFurnitureAsset(type) {
  const entry = assetManifest[type];
  if (!entry) return null;
  if (!cache.has(type)) {
    const url = new URL(`../../assets/models/${entry.asset}/model.gltf`, import.meta.url).href;
    cache.set(type, loader.loadAsync(url).then(gltf => {
      gltf.scene.rotation.y = entry.rotation;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(child => {
        if (child.isMesh) {
          child.castShadow = child.receiveShadow = true;
          child.userData.sharedAsset = true;
        }
      });
      return gltf.scene;
    }).catch(error => {failed.set(type, error.message);return null;}));
  }
  return cache.get(type);
}

export function cloneFurnitureAsset(template, item, materials) {
  const clone = template.clone(true);
  clone.traverse(child => {
    if (!child.isMesh) return;
    const original = child.material;
    if (item.type === 'chair' && /pillow/i.test(original.name)) {
      // The scanned upholstery geometry is retained; the finish joins our fabric palette.
      child.material = materials.get('fabric', item.color || '#9ba78c');
    }else if(item.color && item.color!==catalog.find(entry=>entry.type===item.type)?.color && item.type!=='chair'){
      child.material=original.clone();child.material.color.multiply(new THREE.Color(item.color));child.material.userData.owned=true;
    }
    child.userData.sharedAsset = true;
  });
  return clone;
}

/** Normalize every visible mesh to the item's meter dimensions, centered on x/z, resting at y=0. */
export function normalizeFurniture(model, item) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(v => Number.isFinite(v) && v > 1e-6)) throw new Error('Furniture asset has no usable bounds.');
  const center = bounds.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  pivot.add(model);
  // Translation lives in a separate group, so authored transforms remain intact.
  const origin = new THREE.Group();
  origin.add(pivot);
  pivot.position.set(-center.x, -bounds.min.y, -center.z);
  origin.scale.set(item.width / size.x, item.height / size.y, item.depth / size.z);
  const instance = new THREE.Group();
  instance.add(origin);
  instance.position.set(item.x, 0, item.z);
  instance.rotation.y = -item.rotation * Math.PI / 180;
  instance.userData = {furnitureId: item.id, originalBounds: size.toArray(), dimensions: [item.width,item.height,item.depth], asset: assetManifest[item.type]?.asset || 'spaceswap-studio'};
  instance.traverse(child => { if (child.isMesh) child.userData.furnitureId = item.id; });
  instance.updateMatrixWorld(true);
  return instance;
}

export function assetFailures() {return Object.fromEntries(failed);}

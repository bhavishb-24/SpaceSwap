import * as THREE from '../../vendor/three.module.js';

// A small, bounded CPU cache survives view switches. GPU resources belong to each scene.
const imageCache = new Map();
function image(url) {
  if (!imageCache.has(url)) imageCache.set(url, new THREE.ImageLoader().loadAsync(url));
  return imageCache.get(url);
}

function weave() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), data = ctx.createImageData(256, 256);
  let seed = 1943;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const thread = Math.sin(x * Math.PI / 2) * 8 + Math.sin(y * Math.PI / 2) * 6;
    const n = 222 + thread + (seed / 4294967296 - .5) * 15, i = (y * 256 + x) * 4;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = n;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function finishMap(source, kind, floor) {
  const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<data.data.length;i+=4){
    if(kind==='roughness'){
      const value=(floor?.68:.45)*255+data.data[i]*(floor?.22:.3);
      data.data[i]=data.data[i+1]=data.data[i+2]=value;
    }else if(floor){
      const luma=data.data[i]*.3+data.data[i+1]*.59+data.data[i+2]*.11;
      for(let c=0;c<3;c++)data.data[i+c]=Math.min(255,luma*.28+data.data[i+c]*.72+[37,35,30][c]);
    }
  }
  ctx.putImageData(data,0,0);return canvas;
}

export class InteriorMaterials {
  constructor(renderer, onChange) {
    this.renderer = renderer;
    this.onChange = onChange;
    this.materials = new Map();
    this.textures = new Set();
    this.disposed = false;
    this.weaveMap = this.texture(weave(), true);
    this.weaveMap.repeat.set(7, 7);
    this.ready = this.loadWood();
  }

  texture(source, color = false) {
    const texture = new THREE.Texture(source);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    this.textures.add(texture);
    return texture;
  }

  async loadWood() {
    this.maps = {};
    const outcomes = await Promise.allSettled(['wood_floor', 'oak_veneer_01'].map(async name => {
      const sources = await Promise.all(['Diffuse', 'nor_gl', 'Rough'].map(kind =>
        image(new URL(`../../assets/textures/${name}/${kind}.jpg`, import.meta.url).href)));
      if (this.disposed) return;
      this.maps[name] = sources.map((source, i) => this.texture(i===2?finishMap(source,'roughness',name==='wood_floor'):i===0?finishMap(source,'diffuse',name==='wood_floor'):source, i === 0));
    }));
    if (this.disposed) return;
    for (const material of this.materials.values()) this.assignMaps(material);
    this.onChange?.();
    return outcomes;
  }

  assignMaps(material) {
    const maps = this.maps?.[material.userData.wood];
    if (!maps) return;
    [material.map, material.normalMap, material.roughnessMap] = maps;
    material.normalScale.setScalar(material.userData.wood === 'wood_floor' ? .3 : .18);
    material.needsUpdate = true;
  }

  get(kind, color = '') {
    const key = `${kind}:${color}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const palettes = {
      ivory: '#f3f0e8', plaster: '#eae7df', trim: '#f5f1e8', stone: '#d7cebd',
      oak: '#e5d1b1', walnut: '#b4a28e', floor: '#eee0c6', metal: '#454940',
      brass: '#a99369', ceramic: '#d5c9b4', paper: '#e6ddca', leaf: '#647650',
      glass: '#dbe9e6', grout: '#b7b2a6', dark: '#3e423b', tile: '#dcd9cf',
    };
    const options = { color: color || palettes[kind] || '#d0c5b3', roughness: .75 };
    if (kind === 'fabric') Object.assign(options, {roughness: .97, sheen: .45, sheenRoughness: .9, sheenColor: new THREE.Color('#e7decb'), bumpMap: this.weaveMap, bumpScale: .0015});
    if (kind === 'rug') Object.assign(options, {roughness: 1, map: this.weaveMap, bumpMap: this.weaveMap, bumpScale: .004});
    if (['oak', 'walnut', 'floor'].includes(kind)) Object.assign(options, {roughness: 1, specularIntensity:kind==='floor'?.3:.55,normalScale: new THREE.Vector2(.2, .2)});
    if (kind === 'metal') Object.assign(options, {metalness: .68, roughness: .43});
    if (kind === 'brass') Object.assign(options, {metalness: .72, roughness: .4});
    if (kind === 'ceramic') Object.assign(options, {roughness: .42, clearcoat: .1});
    if (kind === 'glass') Object.assign(options, {roughness: .1, metalness: .05, transparent: true, opacity: .18, depthWrite: false});
    const material = new THREE.MeshPhysicalMaterial(options);
    if (['oak', 'walnut', 'floor'].includes(kind)) material.userData.wood = kind === 'floor' ? 'wood_floor' : 'oak_veneer_01';
    this.assignMaps(material);
    this.materials.set(key, material);
    return material;
  }

  dispose() {
    this.disposed = true;
    this.materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose());
  }
}

// World-space UVs keep wood grain at the same scale as a room or item is resized.
export function woodUV(geometry, scale = 1.8, offset = new THREE.Vector3()) {
  const position = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
  if (!uv) return geometry;
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    const x = position.getX(i) + offset.x, y = position.getY(i) + offset.y, z = position.getZ(i) + offset.z;
    if (ny >= nx && ny >= nz) uv.setXY(i, x / scale, z / scale);
    else if (nz >= nx) uv.setXY(i, x / scale, y / scale);
    else uv.setXY(i, z / scale, y / scale);
  }
  uv.needsUpdate = true;
  return geometry;
}

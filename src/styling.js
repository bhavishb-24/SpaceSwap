import {footprint} from './geometry.js';

// Rugs are floor finishes, not collision obstacles. Both renderers use the same rectangles.
export function floorAccents(apartment) {
  return apartment.furniture.filter(f=>['sofa','bed'].includes(f.type)).flatMap(f=>{
    const room=apartment.rooms.find(r=>r.id===f.roomId);if(!room)return [];
    const angle=f.rotation*Math.PI/180,offset=f.type==='sofa'?.55:.1;
    const rug={id:`rug-${f.id}`,x:f.x-Math.sin(angle)*offset,z:f.z+Math.cos(angle)*offset,width:f.width+(f.type==='sofa'?.6:.65),depth:f.type==='sofa'?f.depth+1.4:f.depth+.3,rotation:f.rotation,color:f.type==='sofa'?'#d4c6ae':'#b6baa5'};
    if(footprint(rug).some(p=>p.x<room.x+.05||p.x>room.x+room.width-.05||p.z<room.z+.05||p.z>room.z+room.depth-.05))return [];
    return [rug];
  });
}

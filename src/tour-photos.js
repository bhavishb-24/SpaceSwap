const DATABASE='spaceswap-tour-photos';
let connection;
function openDatabase(){
 if(!('indexedDB' in window))return Promise.reject(Error('Local photo storage is unavailable in this browser.'));
 if(!connection)connection=new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>{const db=request.result;const store=db.createObjectStore('photos',{keyPath:'id'});store.createIndex('apartmentId','apartmentId');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Photo storage could not open.'));});
 return connection;
}
function transaction(action,mode='readonly'){
 return openDatabase().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction('photos',mode),request=action(tx.objectStore('photos'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error||Error('Photo operation failed.'));tx.onabort=()=>reject(tx.error||Error('Photo operation was cancelled.'));}));
}
export function listTourPhotos(apartmentId){return transaction(store=>store.index('apartmentId').getAll(apartmentId)).then(rows=>rows.sort((a,b)=>a.created-b.created));}
export function deleteTourPhoto(id){return transaction(store=>store.delete(id),'readwrite');}
export async function clearTourPhotos(namespace='real'){
 const rows=await transaction(store=>store.getAll());
 await Promise.all(rows.filter(row=>namespace==='demo'?row.apartmentId.startsWith('demo:'):!row.apartmentId.startsWith('demo:')).map(row=>deleteTourPhoto(row.id)));
}
export async function moveTourPhotosToDemo(apartmentIds){
 const rows=await transaction(store=>store.getAll());
 await Promise.all(rows.filter(row=>apartmentIds.includes(row.apartmentId)).map(row=>transaction(store=>store.put({...row,apartmentId:`demo:${row.apartmentId}`}), 'readwrite')));
}
export async function saveTourPhoto(apartmentId,file){
 if(!file?.type.startsWith('image/'))throw Error('Choose an image file.');
 if(file.size>12*1024*1024)throw Error('Choose a photo smaller than 12 MB.');
 const existing=await listTourPhotos(apartmentId);if(existing.length>=6)throw Error('You can keep up to six photos per apartment.');
 const source='createImageBitmap' in window?await createImageBitmap(file):await new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('This photo could not be opened.'));};image.src=url;});
 const scale=Math.min(1,1200/Math.max(source.width,source.height)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);source.close?.();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.78));if(!blob)throw Error('This photo could not be processed.');
 const row={id:crypto.randomUUID(),apartmentId,name:file.name.slice(0,100),created:Date.now(),blob};await transaction(store=>store.put(row),'readwrite');return row;
}

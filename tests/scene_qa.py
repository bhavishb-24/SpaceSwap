import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('/tmp/spaceswap-visual-review');out.mkdir(exist_ok=True)
checks=[]
def check(name,condition):
    assert condition,name
    checks.append(name);print('PASS',name,flush=True)

measure_script="""async () => {
  const THREE=await import('/vendor/three.module.js');
  const s=spaceSwap.scene,a=spaceSwap.activeApartment();
  return a.furniture.map(item=>{
    const instance=s.model.children.find(g=>g.userData.furnitureId===item.id);
    instance.updateMatrixWorld(true);
    const inverse=instance.matrixWorld.clone().invert(),box=new THREE.Box3();
    instance.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;
      const transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
      for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(transform));
    });
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    return {id:item.id,type:item.type,loaded:instance.userData.loadedAsset,error:Math.max(Math.abs(size.x-item.width),Math.abs(size.y-item.height),Math.abs(size.z-item.depth)),floor:box.min.y,centerError:Math.max(Math.abs(center.x),Math.abs(center.z)),positionError:Math.max(Math.abs(instance.position.x-item.x),Math.abs(instance.position.z-item.z)),rotationError:Math.abs(instance.rotation.y+item.rotation*Math.PI/180)};
  });
}"""

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1050},device_scale_factor=1)
    errors=[];remote=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:remote.append(request.url) if request.url.startswith('http') and not request.url.startswith('http://127.0.0.1:5173') else None)
    page.goto('http://127.0.0.1:5173/#editor',wait_until='networkidle')
    page.locator('[data-action="mode"][data-mode="3d"]').first.click()
    page.wait_for_function('spaceSwap.scene?.assetState.status === "ready"',timeout=60000)
    page.wait_for_timeout(400)
    measurements=page.evaluate(measure_script)
    check('All 14 furniture and fixture instances render',len(measurements)==14)
    check('All visible model bounds match authoritative dimensions',all(x['error']<.00001 for x in measurements))
    check('All models rest on the floor and are centered on their footprint',all(abs(x['floor'])<.00001 and x['centerError']<.00001 for x in measurements))
    check('All instance positions and rotations match 2D state',all(x['positionError']<.00001 and x['rotationError']<.00001 for x in measurements))
    check('All three local glTF types load successfully',len([x for x in measurements if x['loaded']])==3)
    check('No runtime external requests',not remote)
    check('Wood has diffuse, normal, and bounded roughness maps',page.evaluate('spaceSwap.scene.materials.get("floor").map!==null && spaceSwap.scene.materials.get("floor").roughness===1 && spaceSwap.scene.materials.get("floor").normalMap!==null'))
    check('Static mesh batching keeps draw calls below 160',page.evaluate('spaceSwap.scene.renderer.info.render.calls')<160)
    page.screenshot(path=str(out/'studio-default.png'),full_page=True)
    page.locator('[data-action="expand-scene"]').click();page.locator('[data-action="camera"]').click();page.wait_for_timeout(400)
    page.screenshot(path=str(out/'studio-expanded.png'),full_page=True)
    # Exercise actual camera orbit with pointer input.
    before=page.evaluate('spaceSwap.scene.camera.position.toArray()')
    canvas=page.locator('#canvas canvas').bounding_box()
    page.mouse.move(canvas['x']+canvas['width']*.52,canvas['y']+canvas['height']*.45)
    page.mouse.down();page.mouse.move(canvas['x']+canvas['width']*.6,canvas['y']+canvas['height']*.5,steps=8);page.mouse.up();page.wait_for_timeout(400)
    check('Pointer orbit changes camera smoothly',before!=page.evaluate('spaceSwap.scene.camera.position.toArray()'))
    page.locator('[data-action="top-camera"]').click()
    check('Top camera looks down on the whole apartment',page.evaluate('spaceSwap.scene.camera.position.y > 10 && Math.abs(spaceSwap.scene.camera.position.x-spaceSwap.scene.controls.target.x)<.01'))
    page.locator('[data-action="camera"]').click();page.locator('[data-action="room-camera"]').click();page.wait_for_timeout(400)
    page.screenshot(path=str(out/'living-detail.png'),full_page=True)
    check('Room-detail camera targets the living room',page.evaluate('spaceSwap.scene.controls.target.x<5.2 && spaceSwap.scene.controls.target.z<5.5'))
    page.locator('[data-action="camera"]').click()
    page.locator('[data-action="walls"]').click();check('Full-wall mode is functional',page.evaluate('spaceSwap.scene.cutaway===false'))
    page.locator('[data-action="walls"]').click();check('Cutaway mode restores correctly',page.evaluate('spaceSwap.scene.cutaway===true'))
    # Ensure rebuilding selections does not accumulate geometry or textures.
    memory_before=page.evaluate('({g:spaceSwap.scene.renderer.info.memory.geometries,t:spaceSwap.scene.materials.textures.size})')
    for _ in range(6):page.evaluate('spaceSwap.scene.build()')
    page.wait_for_timeout(300)
    memory_after=page.evaluate('({g:spaceSwap.scene.renderer.info.memory.geometries,t:spaceSwap.scene.materials.textures.size})')
    check('Repeated scene rebuilds keep geometry and texture counts stable',memory_before==memory_after)
    # Timing is explicitly a software-renderer measurement, not a hardware performance claim.
    timing=page.evaluate("""async()=>{const s=spaceSwap.scene;s.controls.autoRotate=true;s.controls.autoRotateSpeed=.5;const values=[];let previous=performance.now();for(let i=0;i<15;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>2)values.push(now-previous);previous=now;}s.controls.autoRotate=false;values.sort((a,b)=>a-b);return {medianFrameMs:values[Math.floor(values.length/2)],p95FrameMs:values[values.length-1],drawCalls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles};}""")
    print('SOFTWARE RENDERER TIMING',json.dumps(timing),flush=True)
    # Verify all catalog fallbacks, including uncommon items, normalize correctly.
    fallback_catalog=page.evaluate("""async()=>{const THREE=await import('/vendor/three.module.js');const {catalog}=await import('/src/data.js');const {normalizeFurniture}=await import('/src/render/assets.js');return catalog.map(f=>{const item={...f,id:f.id,x:0,z:0,rotation:0},g=normalizeFurniture(spaceSwap.scene.studio.create(item),item),b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3());g.traverse(m=>m.geometry?.dispose());return Math.max(Math.abs(s.x-f.width),Math.abs(s.y-f.height),Math.abs(s.z-f.depth),Math.abs(b.min.y));});}""")
    check('Every catalog fallback is dimensionally correct',all(error<.00001 for error in fallback_catalog))
    # Test independent clean contexts so the asset cache cannot mask a loading failure.
    failure=browser.new_page(viewport={'width':1440,'height':900})
    failure.on('pageerror',lambda error:errors.append(str(error)))
    failure.route('**/assets/models/**',lambda route:route.abort())
    failure.goto('http://127.0.0.1:5173/#editor',wait_until='networkidle')
    failure.locator('[data-action="mode"][data-mode="3d"]').first.click()
    failure.wait_for_function('spaceSwap.scene?.assetState.status === "fallback"',timeout=60000)
    fallback_measurements=failure.evaluate(measure_script)
    check('Missing assets retain the complete apartment',len(fallback_measurements)==14 and failure.evaluate('spaceSwap.scene.renderer.info.render.triangles')>1000)
    check('Asset failures show an honest fallback notice',failure.locator('.scene-asset-status.has-fallback').is_visible())
    check('Failed-asset models retain exact dimensions',all(x['error']<.00001 for x in fallback_measurements))
    failure.screenshot(path=str(out/'asset-fallback.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844})
    mobile.on('pageerror',lambda error:errors.append(str(error)))
    mobile.goto('http://127.0.0.1:5173/#editor',wait_until='networkidle');mobile.locator('[data-action="mode"][data-mode="3d"]').first.click()
    mobile.wait_for_function('spaceSwap.scene?.assetState.status === "ready"',timeout=60000)
    check('Mobile 3D has no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth<=390'))
    mobile.screenshot(path=str(out/'studio-mobile.png'),full_page=True)
    check('No runtime exceptions across ready, fallback, and mobile scenes',not errors)
    (out/'scene-results.json').write_text(json.dumps({'checks':checks,'measurements':measurements,'timing':timing,'errors':errors},indent=2))
    print('SCENE CHECKS',len(checks),flush=True)
    browser.close()

import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless=True)
    page=browser.new_page(viewport={'width':1512,'height':982})
    page.goto('http://127.0.0.1:5173/#editor',wait_until='networkidle')
    page.locator('[data-action="mode"][data-mode="3d"]').first.click()
    page.wait_for_function('spaceSwap.scene?.assetState.status === "ready"',timeout=60000)
    result=page.evaluate("""async()=>{
      const s=spaceSwap.scene,gl=s.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
      const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
      await new Promise(r=>setTimeout(r,500));s.controls.autoRotate=true;s.controls.autoRotateSpeed=.6;
      const frames=[];let previous=performance.now();
      for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>4)frames.push(now-previous);previous=now;}
      s.controls.autoRotate=false;frames.sort((a,b)=>a-b);
      return {renderer,medianFrameMs:frames[Math.floor(frames.length/2)],p95FrameMs:frames[Math.floor(frames.length*.95)],drawCalls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,cachedShadows:!s.renderer.shadowMap.autoUpdate,viewport:[s.renderer.domElement.width,s.renderer.domElement.height]};
    }""")
    print(json.dumps(result,indent=2),flush=True)
    Path('/tmp/spaceswap-visual-review/benchmark.json').write_text(json.dumps(result,indent=2))
    browser.close()

import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path('/tmp/spaceswap-visual-review');out.mkdir(exist_ok=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1050},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:5173/#editor',wait_until='networkidle')
    page.locator('[data-action="mode"][data-mode="3d"]').first.click()
    page.wait_for_function('spaceSwap.scene?.assetState.status !== undefined && spaceSwap.scene.assetState.status !== "loading"',timeout=60000)
    page.wait_for_timeout(1500)
    page.screenshot(path=str(out/'studio-default.png'),full_page=True)
    page.locator('[data-action="expand-scene"]').click()
    page.locator('[data-action="camera"]').click()
    page.wait_for_timeout(700)
    page.screenshot(path=str(out/'studio-expanded.png'),full_page=True)
    page.locator('[data-action="room-camera"]').click()
    page.wait_for_timeout(700)
    page.screenshot(path=str(out/'living-detail.png'),full_page=True)
    print('ASSET STATE',page.evaluate('spaceSwap.scene.assetState'),flush=True)
    print('RENDER',page.evaluate('({triangles:spaceSwap.scene.renderer.info.render.triangles,calls:spaceSwap.scene.renderer.info.render.calls,geometries:spaceSwap.scene.renderer.info.memory.geometries,textures:spaceSwap.scene.renderer.info.memory.textures})'),flush=True)
    print('ERRORS',errors,flush=True)
    browser.close()

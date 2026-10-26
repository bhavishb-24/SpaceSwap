import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get('SPACESWAP_URL','http://127.0.0.1:5173')
CHROME=os.environ.get('CHROME_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
OUT=Path('/tmp/spaceswap-decision-review');OUT.mkdir(exist_ok=True)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path=CHROME,headless=True)
    context=browser.new_context(viewport={'width':1512,'height':982},permissions=['clipboard-read','clipboard-write'])
    page=context.new_page();errors=[];failed=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.on('response',lambda response:failed.append((response.status,response.url)) if response.status>=400 else None)
    page.goto(BASE,wait_until='networkidle')
    assert page.locator('.landing-hero').is_visible(), 'Public root should open landing page'
    assert page.locator('.landing-difference').is_visible(), 'Distinct value proposition should be visible'
    page.screenshot(path=str(OUT/'landing.png'),full_page=True)
    page.locator('[data-page="judges"]').first.click()
    assert page.locator('.judge-grid article').count()==4
    page.wait_for_timeout(440)
    page.screenshot(path=str(OUT/'judges.png'),full_page=True)
    page.locator('[data-action="enter-demo"][data-page="move"]').first.click()
    assert page.locator('.readiness-row').count()>=6
    assert page.locator('.readiness-status.blocked').count()>=1
    page.screenshot(path=str(OUT/'moveready.png'),full_page=True)
    original=page.locator('[data-route-stage="liftCabin"][data-route-field="depth"]').input_value()
    page.locator('[data-route-stage="liftCabin"][data-route-field="depth"]').fill('2.5')
    page.locator('[data-route-stage="liftCabin"][data-route-field="depth"]').press('Tab')
    assert page.evaluate('spaceSwap.activeApartment().moveRoute.liftCabin.depth')==2.5
    page.locator('[data-route-stage="liftCabin"][data-route-field="depth"]').fill(original)
    page.locator('[data-route-stage="liftCabin"][data-route-field="depth"]').press('Tab')
    page.locator('[data-page="tour"]').first.click()
    assert page.locator('.tour-task').count()>=3
    task=page.locator('.tour-task input').first;task.check()
    assert page.evaluate('spaceSwap.activeApartment().tourCompleted.length')==1
    page.locator('#tour-notes').fill('Elevator reservation required after 4 PM')
    page.locator('#tour-notes').press('Tab')
    assert '4 PM' in page.evaluate('spaceSwap.activeApartment().tourNotes')
    page.locator('[data-tour-photo]').set_input_files('assets/textures/wood_floor/Diffuse.jpg')
    page.locator('.tour-photo-card img').wait_for()
    assert page.locator('.tour-photo-card').count()==1
    page.locator('[data-action="remove-tour-photo"]').click()
    page.wait_for_function('document.querySelectorAll(".tour-photo-card").length === 0')
    page.screenshot(path=str(OUT/'tour.png'),full_page=True)
    page.locator('[data-page="stress"]').first.click()
    baseline=page.locator('.scenario-amount').first.inner_text()
    page.locator('[data-scenario="rentRise"]').fill('8')
    page.locator('[data-scenario="rentRise"]').press('Tab')
    assert page.locator('.scenario-amount').first.inner_text()!=baseline
    assert page.evaluate('spaceSwap.store.get().apartments[0].rent')==2450
    page.locator('[data-scenario="stairsOnly"]').check()
    assert page.locator('.scenario-route-note').count()==2
    page.screenshot(path=str(OUT/'scenarios.png'),full_page=True)
    page.locator('[data-page="brief"]').first.click()
    assert page.locator('.brief-card').count()==2
    page.locator('[data-action="share-brief"]').click()
    link=page.evaluate('navigator.clipboard.readText()')
    assert 'brief=' in link and '#brief' in link
    shared=browser.new_context(viewport={'width':1240,'height':850}).new_page()
    shared.goto(link,wait_until='networkidle')
    assert 'read-only brief' in shared.locator('.decision-heading').inner_text().lower() or 'frozen' in shared.locator('.decision-heading').inner_text().lower()
    assert shared.locator('.brief-card').count()==2
    assert '4 PM' not in shared.content()
    page.screenshot(path=str(OUT/'brief.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844})
    mobile.goto(BASE+'/#judges',wait_until='networkidle')
    mobile.locator('[data-action="enter-demo"]').first.click()
    mobile.goto(BASE+'/#move',wait_until='networkidle')
    assert mobile.locator('.decision-hero').is_visible()
    assert mobile.evaluate('document.documentElement.scrollWidth <= 390')
    mobile.screenshot(path=str(OUT/'mobile-move.png'),full_page=True)
    for route in ['tour','stress','brief','judges','landing']:
        mobile.goto(BASE+'/#'+route,wait_until='networkidle')
        assert mobile.evaluate('document.documentElement.scrollWidth <= 390'),route
    bad={'v':1,'n':'bad','m':12,'b':4000,'a':[{'n':'<img src=x onerror=alert(1)>','s':50,'p':False,'t':100,'c':True,'r':20,'f':0,'u':0,'q':{'blocked':'<img>'},'tasks':1}]}
    token=base64.urlsafe_b64encode(json.dumps(bad).encode()).decode().rstrip('=')
    mobile.goto(BASE+'/?brief='+token+'#brief',wait_until='networkidle')
    assert mobile.locator('.empty-project h1').inner_text()=='This snapshot link cannot be opened.'
    assert not errors,errors
    assert not failed,failed
    print('DECISION FLOW PASSED',flush=True)
    browser.close()

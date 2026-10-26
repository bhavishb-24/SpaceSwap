import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('SPACESWAP_URL', 'http://127.0.0.1:5173')
CHROME = os.environ.get('CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=CHROME, headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{URL}/#judges', wait_until='networkidle')
    page.locator('[data-action="enter-demo"]').first.click()
    page.goto(f'{URL}/#landing', wait_until='networkidle')
    page.reload(wait_until='networkidle')

    page.keyboard.press('Tab')
    assert page.locator('.skip-link').evaluate('(node) => node === document.activeElement')
    page.wait_for_timeout(250)
    assert page.locator('.skip-link').evaluate('(node) => getComputedStyle(node).transform') == 'matrix(1, 0, 0, 1, 0, 0)'

    page.locator('[data-action="navigate"][data-page="overview"]').click()
    assert page.locator('.space-card').count() == 2
    assert page.evaluate('document.querySelector("#page").getAnimations({subtree:true}).length') > 0
    page.locator('.next-step').scroll_into_view_if_needed()
    page.wait_for_timeout(650)
    assert 'is-visible' in (page.locator('.next-step').get_attribute('class') or '')

    page.locator('[data-action="navigate"][data-page="inventory"]').click()
    page.locator('[data-action="custom-inventory"]').first.click()
    assert page.locator('dialog').get_attribute('open') is not None
    page.wait_for_timeout(300)
    assert page.locator('dialog').evaluate('(node) => getComputedStyle(node).opacity') == '1'
    page.locator('[data-action="close-modal"]').first.click()

    reduced = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    reduced_errors = []
    reduced.on('pageerror', lambda error: reduced_errors.append(str(error)))
    reduced.goto(f'{URL}/#judges', wait_until='networkidle')
    reduced.locator('[data-action="enter-demo"]').first.click()
    reduced.goto(f'{URL}/#landing', wait_until='networkidle')
    reduced.locator('[data-action="navigate"][data-page="editor"]').first.click()
    assert reduced.locator('.editor-workbench').is_visible()
    assert reduced.locator('.motion-reveal').count() == 0
    assert reduced.evaluate('document.documentElement.scrollWidth <= 390')
    assert not errors and not reduced_errors, errors + reduced_errors
    print('MOTION CHECKS 10')
    browser.close()

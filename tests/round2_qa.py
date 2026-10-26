"""Fresh-profile, judge isolation, share, responsive, and PDF smoke checks."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("SPACESWAP_URL", "http://127.0.0.1:5173")
CHROME = os.environ.get("CHROME_PATH", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME, headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    context = browser.new_context(viewport={"width": 390, "height": 844}, permissions=["clipboard-read", "clipboard-write"])
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL)
    assert "Cedar" not in page.locator("body").inner_text()
    assert page.evaluate("spaceSwap.store.get().apartments.length") == 0
    assert page.evaluate("localStorage.getItem('spaceswap.project.v1')") is None
    page.locator('[data-page="editor"]').first.click()
    assert page.get_by_text("Your workspace is ready.").is_visible()
    page.get_by_role("button", name="Add your first apartment").click()
    form = page.locator("#dialog-form")
    for name, value in {
        "name": "My Flat", "address": "Oak Road", "roomName": "Living room",
        "roomWidth": "4.2", "roomDepth": "3.8", "rent": "1800",
        "months": "12", "budget": "3500",
    }.items():
        form.locator(f'[name="{name}"]').fill(value)
    form.get_by_role("button", name="Create space").click()
    assert page.evaluate("spaceSwap.store.get().apartments[0].rooms[0].width") == 4.2
    page.reload()
    assert page.evaluate("spaceSwap.store.get().apartments[0].name") == "My Flat"
    page.goto(URL + "/#editor")
    page.locator('[data-action="custom-furniture"]').first.click()
    furniture = page.locator("#dialog-form")
    assert all(furniture.locator(f'[name="{name}"]').input_value() == "" for name in ("width", "depth", "height", "price"))
    for name, value in {"name": "My sofa", "width": "0.9", "depth": "0.8", "height": "0.7", "price": "0"}.items():
        furniture.locator(f'[name="{name}"]').fill(value)
    furniture.locator('[name="source"]').select_option("owned")
    furniture.get_by_role("button", name="Add furniture").click()
    assert page.evaluate("spaceSwap.store.get().inventory[0].width") == 0.9
    page.reload()
    assert page.evaluate("spaceSwap.store.get().inventory[0].width") == 0.9
    page.goto(URL + "/#inventory")
    page.locator('[data-action="edit-inventory"]').first.click()
    assert page.locator('#dialog-form [name="width"]').input_value() == "0.9"
    page.locator('#dialog-form [name="width"]').fill("0")
    page.locator('#dialog-form button[type="submit"]').click()
    assert page.locator("dialog").get_attribute("open") is not None
    assert page.evaluate("spaceSwap.store.get().inventory[0].width") == 0.9
    page.locator('[data-action="close-modal"]').first.click()
    backup = page.evaluate("JSON.stringify({...spaceSwap.store.get(),demoData:false})")
    page.evaluate("spaceSwap.store.update(p => p.name = 'Changed name')")
    page.goto(URL + "/#settings")
    page.locator("[data-import-project]").set_input_files({
        "name": "spaceswap-project.json", "mimeType": "application/json", "buffer": backup.encode()
    })
    page.locator('[data-action="confirm-import"]').click()
    assert page.evaluate("spaceSwap.store.get().name") == "My SpaceSwap project"

    page.goto(URL + "/#judges")
    assert "Demo data" in page.locator("body").inner_text()
    page.get_by_role("button", name="Load judge demo").first.click()
    assert page.evaluate("spaceSwap.store.mode") == "demo"
    assert page.evaluate("spaceSwap.store.get().apartments.length") == 2
    page.get_by_role("button", name="Return to my project").first.click()
    assert page.evaluate("spaceSwap.store.mode") == "real"
    assert page.evaluate("spaceSwap.store.get().apartments[0].name") == "My Flat"
    page.goto(URL + "/#overview")
    assert "Cedar" not in page.locator("body").inner_text()
    page.goto(URL + "/#brief")
    page.get_by_role("button", name="Copy shareable brief").click()
    link = page.evaluate("navigator.clipboard.readText()")
    assert "brief=" in link
    fresh = browser.new_context()
    recipient = fresh.new_page()
    recipient.goto(link)
    assert "My Flat" in recipient.locator("body").inner_text()
    assert recipient.evaluate("spaceSwap.store.get().apartments.length") == 0
    assert "frozen" in recipient.locator("body").inner_text().lower()
    fresh.close()
    migration = browser.new_context()
    old = migration.new_page()
    old.goto(URL + "/#judges")
    old.get_by_role("button", name="Load judge demo").first.click()
    old.evaluate("""() => {
        localStorage.setItem('spaceswap.project.v1', JSON.stringify(spaceSwap.store.get()));
        sessionStorage.setItem('spaceswap.mode.v1', 'real');
    }""")
    old.reload()
    assert old.get_by_text("Your saved sample workspace").is_visible()
    old.get_by_role("button", name="Move it to judge demo").click()
    assert old.evaluate("spaceSwap.store.get().apartments.length") == 0
    assert old.evaluate("JSON.parse(localStorage.getItem('spaceswap.judge-demo.v1')).apartments.length") == 2
    migration.close()
    denied = browser.new_context()
    failed_copy = denied.new_page()
    failed_copy.add_init_script("Object.defineProperty(navigator, 'clipboard', {value: {writeText: () => Promise.reject(new Error('denied'))}})")
    failed_copy.goto(URL + "/#judges")
    failed_copy.get_by_role("button", name="Load judge demo").first.click()
    failed_copy.goto(URL + "/#brief")
    failed_copy.get_by_role("button", name="Copy shareable brief").click()
    assert failed_copy.get_by_text("Automatic copy failed.").is_visible()
    failed_copy.goto(URL + "/#settings")
    failed_copy.locator('[data-setting="clearance"]').fill("")
    failed_copy.locator('[data-setting="clearance"]').press("Tab")
    assert failed_copy.evaluate("spaceSwap.store.get().preferences.clearance") == 0.6
    denied.close()
    for width in (320, 390, 1280):
        page.set_viewport_size({"width": width, "height": 800})
        page.goto(URL + "/#judges")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), f"judge overflow at {width}px"
        page.goto(URL + "/#tour")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), f"tour overflow at {width}px"
    page.goto(URL + "/#reports")
    assert page.locator(".report-document").is_visible()
    assert "Building access · simplified check" in page.locator(".report-document").inner_text()
    page.emulate_media(media="print")
    assert page.locator(".skip-link").evaluate("(el) => getComputedStyle(el).display") == "none"
    pdf = Path("/tmp/spaceswap-round2-report.pdf")
    page.pdf(path=str(pdf), format="A4", print_background=True)
    assert pdf.exists() and pdf.stat().st_size > 10000
    touch_context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    touch = touch_context.new_page()
    touch.goto(URL + "/#judges")
    touch.get_by_role("button", name="Load judge demo").first.click()
    touch.goto(URL + "/#editor")
    sofa = touch.locator('[data-furniture="a-sofa"]')
    sofa.scroll_into_view_if_needed()
    box = sofa.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    before = touch.evaluate('spaceSwap.activeApartment().furniture.find(f=>f.id==="a-sofa").x')
    session = touch_context.new_cdp_session(touch)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + 35, "y": y, "id": 1}]})
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    assert touch.evaluate('spaceSwap.activeApartment().furniture.find(f=>f.id==="a-sofa").x') != before
    touch.goto(URL + "/#tour")
    touch.locator(".tour-task").first.tap()
    assert touch.evaluate("spaceSwap.activeApartment().tourCompleted.length") == 1
    touch.locator("#tour-notes").fill("Check the elevator")
    touch.locator("#tour-notes").press("Tab")
    assert "elevator" in touch.evaluate("spaceSwap.activeApartment().tourNotes")
    touch_context.close()
    assert not errors, errors
    print("PASS fresh profile, creation, reload, import, migration, judge isolation, fresh recipient share, widths, PDF, touch drag")
    browser.close()

# SpaceSwap

A working apartment decision tool with a shared 2D/3D floor plan, deterministic furniture checks, editable budgets, and an explainable apartment comparison.

## Run

From this folder:

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Open **http://127.0.0.1:5173**. The public root opens the landing page; `/#editor` opens the working planner. No build, Node installation, account, API key, or backend is required. If Node is installed, `npm run dev` also starts the Python server.

The landing page links directly to the planner, MoveReady, and a judge guide. All fonts, Three.js, and controls are bundled locally; there are no external asset requests.

## What works

- Two furnished sample apartments, with separate layouts, rents, and cost assumptions.
- SVG floor-plan editing: selection, dragging, arbitrary numerical rotation, 90° rotation, numerical resizing, pan, zoom, fit, and 5 cm snapping. The visible world grid is 25 cm.
- Rooms, door/window openings, and explicit walking clearances. Room movement carries its furniture and paths; overlapping rooms and invalid openings are rejected.
- Real Three.js rendering of the same model, with locally bundled CC0 glTF furniture, purpose-built upholstered models, PBR wood/fabric/stone finishes, HDR fill, daylight shadows, curtains, window trim, shared-wall openings, and kitchen/bath fixtures. Orbit/pan/zoom, cutaway/full walls, top/isometric/room-detail cameras, and an expanded scene view are included. Selection and inspector edits work in 3D.
- Personal furniture inventory, custom dimensions, sample catalog search and category filtering. Linked inventory dimensions and ownership synchronize across apartments. Positions stay apartment-specific.
- Deterministic rotation-aware intersection, boundary, door approach, path, storage/appliance clearance, and preliminary doorway checks. Unverified dimensions stay visibly provisional.
- Undo/redo for project changes, localStorage persistence, project JSON export, and a confirmable demo reset.
- Editable rent, recurring costs, moving/setup costs, planned purchases, replacement allowances, stay length, and budget. Each placed item counts as one unit; duplication adds a separately priced unit.
- Weighted apartment comparison with visible scoring math. Recommendations are withheld when costs are missing.
- A report generated from live project data, with browser printing / Save as PDF.
- Responsive desktop and mobile layouts, keyboard furniture movement, and a WebGL fallback.
- MoveReady building route checkpoints: editable entrance, hallway, elevator, and stair measurements checked against owned furniture. Missing values remain unknown; apparent passes are preliminary because continuous turning and carrying are not modeled.
- Tour Mode: dynamically generated measurement and question checklist, notes in the project, and up to six locally stored photos per apartment. Photos use IndexedDB and are omitted from project JSON exports and shared briefs.
- Scenario Lab: live rent rise, stay length, one-time moving cost, sofa replacement, roommate split, and elevator-unavailable views. Scenarios never edit the saved baseline.
- A shareable, read-only decision brief URL with costs, reuse, layout and route risks, and open task counts. It is a frozen summary; names and planning figures in the link are visible to anyone who has it, while inventory details, notes, and photos remain local.
- A judge page showing the problem, the connected workflow, and a 90-second live demo path.

## A 90-second demo

1. Open **For judges** from the public landing page for the product story.
2. Open MoveReady: the sample sofa meets a blocked elevator checkpoint; the sample bedroom piece meets a narrow entrance.
3. Open Tour Mode: see the generated route questions, add a note or photo, and mark a task complete.
4. Open Scenario Lab: raise rent or remove the elevator and compare outcomes without changing the saved project.
5. Open the shareable brief and copy its read-only snapshot link; then enter the 2D/3D planner to show the underlying geometry.
6. Show Apartment Battle and the printable decision report for detailed math and assumptions.

## Validation

Core checks are available at **http://127.0.0.1:5173/tests/**. They cover separated/overlapping/edge-touching objects, arbitrary rotation, floating-point tolerance, boundary violations, doorway constraints, missing dimensions, measurement confidence, walking paths, units, budget arithmetic, and comparison behavior.

The browser regression script uses Python Playwright and an installed Chrome browser:

```sh
python3 -m venv /tmp/spaceswap-qa
/tmp/spaceswap-qa/bin/pip install playwright
/tmp/spaceswap-qa/bin/python tests/browser_qa.py
```

The server must already be running. On a different machine, set `CHROME_PATH` to your Chrome executable and optionally `SPACESWAP_URL` to the server URL. Results, screenshots, and the generated report PDF go to `/tmp/spaceswap-qa-results`.

Before submitting, manually check orbit/zoom performance on the presentation laptop, drag furniture with your intended mouse/trackpad, and open the print dialog to choose the correct PDF destination. These are device-specific interactions beyond the automated geometry and browser checks.

## Architecture

- `src/data.js`: catalog, sample project, stable identifiers.
- `src/store.js`: local persistence, undo/redo, immutable history snapshots.
- `src/geometry.js`: meter-based oriented polygons, separating-axis intersection tests, distances, clearance/door checks, and unit conversion.
- `src/costs.js`: cost accounting and weighted comparison.
- `src/plan.js`: SVG furniture artwork and interactive 2D rendering.
- `src/scene.js`: shared-model Three.js renderer, cameras, local detail loading, and resource cleanup.
- `src/render/`: material management, glTF normalization, custom furniture, and architectural geometry.
- `src/styling.js`: shared 2D/3D floor-finish placement.
- `assets/`: local CC0 models, PBR maps, HDR environment, source manifest, and credits.
- `src/views.js`: application views and inspector templates.
- `src/app.js`: interactions, input validation, shared-model updates, and navigation.
- `vendor/`: Three.js 0.170.0, OrbitControls, fonts, and license notices.

## Scope and assumptions

Rooms are rectangular and walls are derived from their boundaries. Floor area is gross room area, not a navigable-area simulation. Neighboring rooms can share boundaries; this is not a CAD or building-code tool.

Doorway compatibility tests whether an axis-aligned orientation of the item's three bounding dimensions fits the door width and height. It does not verify diagonal carrying, disassembly, stairs, turning space, or a continuous carrying route. Door approaches are conservatively reserved inside rooms regardless of swing direction. Furniture access clearances cover marked routes and gaps beside storage/appliances, not all possible walking routes.

3D placement uses the inspector; direct drag-to-move is provided in 2D. Full walls and cutaway views use a fixed 2.65 m wall height. No eye-height walkthrough, floor-plan image extraction, AI service, cloud sync, retailer integration, or automatic layout generation is included.

Prices are illustrative USD amounts. Existing owned items cost zero unless explicitly selected for a replacement allowance. Candidate and planned purchases count toward the total. Replacement allowances are user choices and should be removed if a separate replacement purchase is already included. Data is saved in this browser, with no cross-device synchronization. JSON export is a readable backup; importing backups is outside this version's scope.

## Interior art direction

The studio collection uses natural oak, warm ivory plaster, shaped cream upholstery, walnut joinery, sage textiles, and restrained brass/dark-metal details. Imported glTF models are normalized from their actual bounds to the exact shared-model dimensions. The scene renders custom models immediately, then replaces selected pieces with local assets; a failed asset retains the correctly sized custom model.

See [asset credits and licensing](assets/CREDITS.md) and the checksum-verified [download manifest](assets/download-manifest.json). All models, textures, fonts, and loaders are bundled. The application makes no runtime calls to Poly Haven. Existing browser-saved layouts remain intact; Settings → Reset demo project loads the new furnished demonstration layout.

For visual screenshots of the default view, expanded scene, and living-room detail:

```sh
/tmp/spaceswap-qa/bin/python tests/visual_review.py
/tmp/spaceswap-qa/bin/python tests/decision_qa.py
```

Screenshots are written to `/tmp/spaceswap-visual-review`.

The dedicated renderer checks exercise real mesh bounds, model-loading failures, PBR maps, camera controls, repeated scene rebuilds, and mobile rendering:

```sh
/tmp/spaceswap-qa/bin/python tests/scene_qa.py
/tmp/spaceswap-qa/bin/python tests/render_benchmark.py
/tmp/spaceswap-qa/bin/python tests/motion_qa.py
```

Validation completed: 36 core checks, 33 browser regression checks, 20 renderer checks, 10 focused motion/accessibility checks, and the end-to-end decision-flow browser check passed. Desktop, room-detail, expanded, judge, decision, and mobile screenshots were inspected. A short orbit benchmark on the Apple M2 Metal backend measured 16.6 ms median / 18.1 ms 95th-percentile frame time at a 774 × 645 render resolution, with 129 draw calls and approximately 284,000 triangles. This is a local measurement, not a guarantee for other devices. Shadows are cached until the scene changes, and unchanged views do not render continuously.

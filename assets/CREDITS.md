# SpaceSwap interior collection — sources and licenses

The following assets were downloaded from **[Poly Haven](https://polyhaven.com/)** and bundled locally. Poly Haven releases these assets under **CC0 1.0 Universal**; commercial use, adaptation, and redistribution are permitted. These assets remain public-domain resources and are not represented as original SpaceSwap work.

License verification: [Poly Haven asset license](https://polyhaven.com/license) · [CC0 legal text](https://creativecommons.org/publicdomain/zero/1.0/legalcode)

| Asset | Author | Use in SpaceSwap |
| --- | --- | --- |
| [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | Vibrant Nordic | Local glTF chair geometry and wood PBR maps; upholstery finish adapted to the shared fabric palette. |
| [Modern Coffee Table 01](https://polyhaven.com/a/modern_coffee_table_01) | Amin | Local glTF coffee table with stone and wood PBR material. |
| [Potted Plant 02](https://polyhaven.com/a/potted_plant_02) | Rico Cilliers | Local glTF foliage, pot, and soil. |
| [Wood Floor](https://polyhaven.com/a/wood_floor) | Dimitrios Savva | Floor diffuse, OpenGL normal, and roughness maps; color and roughness are adjusted to a lighter, matte finish at runtime. |
| [Oak Veneer 01](https://polyhaven.com/a/oak_veneer_01) | Jenelle van Heerden | Oak/walnut furniture finish, scaled using meter-based geometry. Roughness is bounded to avoid plastic-looking reflections. |
| [Studio Small 09](https://polyhaven.com/a/studio_small_09) | Sergej Majboroda | 1K HDR environment, prefiltered locally for restrained indirect lighting and reflections. |

Downloaded variants: 1K textures and HDR; original glTF geometry. Original source URLs and source-provided MD5 checksums are in [download-manifest.json](download-manifest.json). The downloads were checked against those checksums. No remote asset URLs are requested by the application at runtime.

The sofa, bed, desk, dining table, wardrobe, bookshelf, lamp, appliance, kitchen/bath fixtures, fallback models, fabric weave, rug styling, and abstract artwork are original geometry/textures authored for this project. Source lives in `src/render/` and `src/styling.js`.

Three.js, its loaders, geometries, and OrbitControls use the MIT license included at `vendor/THREE-LICENSE.txt`. Font licenses are included under `vendor/fonts/`.

## Selection decisions

Poly Haven's available Sofa 01/02/03 models were reviewed and rejected for this collection because their ornate antique frames conflict with the contemporary direction. The sofa and bed are purpose-built instead: shaped upholstery, seams, layered bedding, tapered legs, and coordinated finishes. A small consistent imported collection was preferred over unrelated model styles.

## Runtime normalization and fallback

All loaded or custom furniture is measured with its authored transforms applied, centered on its horizontal bounds, placed on the floor, and independently scaled to the item's exact width, depth, and height. Item rotation and meter coordinates are then applied by the shared instance wrapper. Asset loading never changes the fit engine's dimensions.

The first scene renders immediately with complete custom furniture. Local glTF details replace those fallbacks once ready. An unavailable model retains its custom alternative and displays an honest asset-status message. Optional HDR or wood-map failures retain the procedural daylight/material setup. Shared asset CPU caches are bounded to the three imported model types; scene-owned geometry, materials, textures, shadow maps, and WebGL contexts are released on disposal.

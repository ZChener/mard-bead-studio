# MARD Bead Pattern Studio

A fully local, browser-only bead pattern generator. Open `index.html`, upload a photo, and the app automatically creates an original preview plus a MARD bead pattern with a 10x10 grid.

## Files

Development version:

```text
index.html
app.js
mardPalette.json
README.md
```

Deployment version:

```text
index-standalone.html
```

No installation is required. There is no backend, no npm, no Python, no API key, and no cloud service.

## UI Flow

### Initial Screen

Only the upload area is shown at first. No previews, parameters, statistics, or export controls are visible before an image is selected.

### After Upload

After selecting or dropping an image, the app automatically:

1. Loads the image.
2. Shows the original image preview.
3. Cartoonizes the image locally.
4. Converts it into a MARD bead pattern.
5. Shows the bead pattern with a 10x10 grid.
6. Reveals parameters, bead color legend, and export controls.

There is no extra generate button.

## Aspect Ratio

The original preview keeps the uploaded image aspect ratio. The bead pattern also keeps the same aspect ratio as the uploaded image.

The app does not crop, stretch, squeeze, or force images into a square. Canvases are scaled down only when needed for screen size or mobile stability.

## Layout

On mobile, the order is:

1. Upload image
2. Original preview
3. Bead pattern preview
4. Bead color/count legend
5. Parameters
6. Export buttons

On tablet and desktop, the original preview and bead workflow can sit side-by-side when there is enough width. The layout stacks automatically on narrower screens.

## Parameters

The parameter controls appear below the generated bead pattern and legend:

- Grid Width
- Grid Height
- Max Beads
- Max Colors
- Cartoon Strength
- Saturation
- Contrast
- Soft Edge

`Max Beads` automatically reduces oversized patterns while preserving the uploaded image aspect ratio.

## MARD Palette

`mardPalette.json` contains the full MARD v1 221-color palette. It is loaded internally for nearest RGB color matching only. The full palette is not shown in the UI.

Color matching uses:

- `hexToRgb()`
- `rgbDistance()`
- `findClosestMardColor()`

## 10x10 Grid

The final bead pattern includes a 10x10 grid overlay. Light lines mark every bead cell, and darker lines appear every 10 beads horizontally and vertically. The exported PNG and modal preview include the same aligned grid.

## Bead Color Legend

Below the bead pattern, the app shows all used MARD colors. Each legend row includes:

- color swatch
- MARD code
- HEX value
- bead count

Example:

```text
[A1 swatch] A1  #faf5cd  152 beads
```

## Modal Preview

Click or tap the generated bead pattern to open a preview modal. The modal image is generated from the same renderer as PNG export and includes:

- bead pattern
- 10x10 grid
- bead color/count legend below the pattern

On mobile or WeChat, use the modal image for long-press saving.

Instruction shown in the app:

```text
手机或微信中，请长按图片保存到相册。
```

## Export

- **Download PNG** exports the bead pattern with the 10x10 grid and a full color-count legend below the image.
- **CSV** exports bead counts in this format:

```csv
Code,Hex,Count
A1,#faf5cd,152
```

The same `renderExportCanvasWithLegend()` function is used for desktop PNG export, mobile modal preview, and click/tap preview generation.

## Mobile / WeChat Stability

To reduce mobile browser crashes or WeChat reloads, the app automatically limits processing size:

- Desktop longest side: up to 1000 px
- Mobile longest side: up to 512 px
- WeChat longest side: up to 384 px

On mobile, the default grid is `40 x 40`, and grid size is capped at `80 x 80`. The app shows this warning:

```text
手机端建议使用较小图片和较低网格尺寸，避免浏览器自动刷新。
```

Image processing is chunked with small pauses so the browser has time to update the UI instead of freezing.

## Deployment Version

Use `index-standalone.html` when sending through WeChat, uploading to GitHub Pages, uploading to Cloudflare Pages, or opening on mobile devices where extra files may not load reliably.

`index-standalone.html` contains:

- all CSS inside `<style>`
- all JavaScript inside `<script>`
- the full MARD palette embedded directly in JavaScript
- no `fetch()` calls
- no external file dependencies

## Run Locally

Development version:

1. Keep `index.html`, `app.js`, and `mardPalette.json` in the same folder.
2. Double-click `index.html`.

Standalone version:

1. Open or share `index-standalone.html` directly.
2. No other file is required.

Recommended browsers: iPhone Safari, Android Chrome, iPad browsers, WeChat browser, Chrome, Edge, Safari, or Firefox.

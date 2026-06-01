# MARD Bead Pattern Studio

A fully local, browser-only bead pattern generator. Open `index.html`, upload a photo, preview a soft cartoon version, convert it to a MARD bead-dot pattern, and export PNG or CSV.

## Files

```text
MARD-Bead-Studio/
├── index.html
├── app.js
├── mardPalette.json
└── README.md
```

No installation is required. There is no backend, no npm, no Python, no API key, and no cloud service.

## Desktop Usage

1. Double-click `index.html`.
2. Drag and drop an image into the upload card, or click **Upload Image**.
3. Review the original preview, cartoon preview, and generated bead pattern.
4. Adjust settings in the right column.
5. Export PNG or CSV from the export card.

On desktop, the app keeps a two-column layout: previews on the left, settings/statistics/export on the right.

## Tablet Usage

On tablet-width screens, the app uses a flexible layout and may stack sections vertically when space is tight. Controls remain large enough for touch, and previews stay within the screen width.

Recommended workflow:

1. Tap **Upload Image**.
2. Choose a photo from the photo library.
3. Pan previews with one finger.
4. Pinch inside a preview to zoom.
5. Adjust grid size or max beads if the pattern is too large.

## Mobile Usage

On phones, sections stack in this order:

1. Upload image
2. Original / Cartoon / Bead Pattern previews
3. Settings
4. Bead count statistics
5. Export buttons

Tap **Choose Photo / Upload Image** to select from your camera roll or photo library. Drag-and-drop remains available on desktop browsers but is not required on mobile.

Advanced controls are collapsed by default on mobile. Essential controls remain visible:

- Grid Width
- Grid Height
- Max Beads
- Max Colors

## Preview Controls

- Drag with mouse or finger to pan.
- Use mouse wheel to zoom on desktop.
- Pinch to zoom on touch devices.
- Tap **Reset Zoom** to return a preview to its original position.

Canvases scale visually to fit the screen while keeping their internal processing resolution.

## Performance

Large uploaded images are resized before cartoonization. On mobile, processing is limited to about 512 px on the longest side to reduce freezing. The app yields between processing steps so loading status messages can update.

## Automatic Bead Reduction

Set `Grid Width` and `Grid Height` for the desired pattern size. If the total bead count is higher than `Max Beads`, the app automatically scales the grid down while preserving the requested aspect ratio.

Example: a requested `160 x 160` grid has 25,600 beads. With `Max Beads = 6000`, the app reduces the grid to a smaller proportional size before mapping colors.

## Color Reduction

Before matching to the MARD palette, the app reduces colors locally so the pattern does not use too many bead colors. `Max Colors` limits the final set of MARD colors used in the bead image.

Color matching uses nearest RGB distance:

- `hexToRgb()`
- `rgbDistance()`
- `findClosestMardColor()`

## 10x10 Grid

The final bead pattern shows a 10x10 grid overlay. Light lines mark each bead cell, and stronger lines appear every 10 beads horizontally and vertically. The exported PNG includes the same aligned grid.

The cartoon preview also includes a 10x10 guide grid for composition, but the final bead pattern grid is the production grid.

## Export

- **Download PNG** exports the bead-dot pattern with the 10x10 grid and a color-count legend below the image.
- **CSV** exports bead counts in this format:

```csv
Code,Hex,Count
A1,#faf5cd,152
```

On mobile, if PNG download does not start automatically, the app opens the PNG in a new tab when possible. Long-press the opened image and choose save/share from your browser menu.

## MARD Palette

`mardPalette.json` contains the full MARD v1 221-color palette with:

- `brand`
- `code`
- `hex`
- `rgb`
- `group`

The app loads this file internally for color matching. For double-click local use, `index.html` also includes the same palette as a fallback because some browsers block `file://` JSON loading.

## Run Locally

1. Put the four files in the same folder.
2. Double-click `index.html`.
3. Use the app immediately in your browser.

Recommended browsers: Chrome, Edge, Safari, or Firefox.

## Deployment Version

The folder also includes `index-standalone.html` for sharing and deployment.

Use this file when sending through WeChat, uploading to GitHub Pages, uploading to Cloudflare Pages, or opening on mobile devices where extra local files may not load reliably.

`index-standalone.html` contains:

- all CSS inside `<style>`
- all JavaScript inside `<script>`
- the full MARD palette embedded directly in JavaScript
- no `fetch()` calls
- no external file dependencies

Development version:

```text
index.html
app.js
mardPalette.json
```

Deployment version:

```text
index-standalone.html
```

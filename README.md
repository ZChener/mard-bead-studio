# MARD Bead Pattern Studio

A fully local, browser-only bead pattern generator. Open `index.html`, upload a photo, and the app automatically creates an original preview plus a MARD bead pattern with a 10x10 grid and color-count legend.

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

Initial screen:

1. Only the upload area is visible.
2. No parameters, palette panel, statistics, or empty preview containers are shown.

After upload:

1. The original image appears automatically.
2. The app locally cartoonizes the image.
3. The bead pattern is generated automatically.
4. Parameters, color statistics, and export buttons are revealed.
5. Tap or click the bead pattern to open the full save preview.

There is no Generate button.

## Aspect Ratio

The app always preserves the uploaded image aspect ratio. It does not stretch, squeeze, crop, or force square output.

Example:

```text
Original image: 3000 x 2000
Ratio: 3:2
Grid width: 120 beads
Auto height: 80 beads
```

`Grid Width` is the main resolution control. `Auto Height` is calculated from the original image ratio and updates automatically.

## Bead Resolution

Desktop defaults:

- Grid width: 120 beads
- Maximum grid width: 200 beads
- Default max beads: 12000

Mobile and WeChat defaults:

- Grid width: 80 beads
- Maximum grid width: 120 beads
- Default max beads: 5000

Use `Max Beads` to keep the project practical. For example, try `1000`, `2000`, `5000`, or a larger desktop value when you want more detail.

## Parameters

Changing any of these controls automatically regenerates the bead pattern, statistics, and export image after a short debounce:

- Grid Width
- Max Beads
- Max Colors
- Cartoon Strength
- Saturation
- Contrast
- Soft Edge
- Show Grid

The debounce delay is about 480 ms, so the app waits until you stop adjusting a slider before regenerating.

## MARD Palette

`mardPalette.json` contains the full MARD v1 221-color palette. It is loaded internally for nearest RGB color matching only. The full palette is not displayed in the UI.

Color matching uses:

- `hexToRgb()`
- `rgbDistance()`
- `findClosestMardColor()`

## 10x10 Grid

The final bead pattern includes a bead-art grid:

- light lines for normal bead cells
- darker, stronger lines every 10 beads horizontally and vertically

The same aligned grid appears in:

- preview
- modal save image
- exported PNG

## Bead Color Statistics

Below the bead pattern, the app shows every used MARD color sorted by bead count. Each row includes:

- color swatch
- MARD code
- HEX value
- bead count

Example:

```text
[A1 swatch] A1  #faf5cd  152 beads
```

## Export And Mobile Save

`Download PNG` creates a dedicated export canvas. It does not export a screenshot of the visible preview.

The exported image includes:

1. bead pattern
2. 10x10 grid
3. color statistics legend below the pattern

The same `renderExportCanvasWithLegend()` function is used for desktop PNG export, mobile preview modal, and click/tap preview generation.

On desktop, the PNG downloads normally.

On mobile or WeChat, tap the bead pattern to open the full export image in a modal. The app shows this instruction:

```text
手机或微信中，请长按下方完整图片保存到相册。
```

Long-press the modal image to save it to the photo album if direct download is blocked.

CSV export uses this format:

```csv
Code,Hex,Count
A1,#faf5cd,152
```

## Mobile / WeChat Stability

To reduce mobile browser crashes or WeChat reloads, the app limits processing size before cartoonization:

- Desktop longest side: up to 1000 px
- Mobile longest side: up to 512 px
- WeChat longest side: up to 384 px

Processing is split into small async chunks so the browser can keep updating the UI. While processing, the app displays:

```text
正在生成，请稍候...
```

Mobile warning shown in the app:

```text
手机端建议使用较小图片和较低网格尺寸，避免浏览器自动刷新。
```

## Responsive Layout

Desktop:

```text
[ Original Preview ] [ Bead Pattern ]
Parameters and export controls below the bead pattern
```

Mobile:

```text
Upload
Original
Bead Pattern
Parameters
Statistics
Export
```

The interface uses flexible widths, `max-width: 100%`, and no horizontal scrolling.

## GitHub Pages Compatibility

All paths are relative. The development version works on GitHub Pages when these files are kept together:

```text
index.html
app.js
mardPalette.json
```

For sharing through WeChat or any situation where extra files may not load reliably, use `index-standalone.html`.

## Standalone Version

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

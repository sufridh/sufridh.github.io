# Geospatial Analysis — portfolio

Five interactive geospatial analyses plus one methodology write-up, sharing a single
design system and a single navigation shell. Every page is a self-contained HTML file
with its data embedded, so the whole site is static — no build step, no server code.

## Contents

| Page | File | Layout |
| --- | --- | --- |
| Portfolio home | `index.html` | scrolling |
| Jakarta Waste Infrastructure | `projects/jakarta-waste.html` | full-screen app |
| Methodology & Data Sources | `projects/jakarta-waste-methodology.html` | scrolling |
| Perubahan Tata Guna Lahan Jawa | `projects/perubahan-lahan-jawa.html` | scrolling |
| Populasi Pesisir Utara | `projects/pesisir-utara.html` | full-screen app |
| Rusunawa Nasional | `projects/rusunawa.html` | full-screen app |
| Gaza Food Security | `projects/gaza-food-security.html` | full-screen app |

## Shared assets

- **`assets/theme.css`** — design tokens (palette, radii, Plus Jakarta Sans), the fixed
  top navigation, and the homepage layout. Tokens are prefixed `--pf-` so they never
  collide with variables the dashboards already define.
- **`assets/shell.js`** — injects the top bar and the project switcher into each analysis
  page, and tells `theme.css` whether the page is a full-height `app` or a scrolling `page`.

## Publishing to GitHub Pages

1. Create a repository and copy this folder into its root.
2. Commit and push:

   ```bash
   git init
   git add .
   git commit -m "Geospatial analysis portfolio"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```

3. In the repository, open **Settings → Pages**, set *Source* to **Deploy from a branch**,
   pick `main` and the `/ (root)` folder, then save.
4. The site appears at `https://<username>.github.io/<repo>/` within a minute or two.

`.nojekyll` is included so GitHub serves every file as-is instead of running Jekyll over it.

Two pages are close to 3 MB because their geometry is embedded. That is under GitHub's
100 MB per-file limit and fine for Pages, but the first load on a slow connection takes a
moment. If you later want them lighter, the fix is to move the embedded GeoJSON into
separate `.json` files and fetch them — which does require serving over HTTP rather than
opening the file directly.

## Adding another analysis

1. Drop the HTML file into `projects/`.
2. Add an entry to the `PROJECTS` array at the top of `assets/shell.js`.
3. Before `</head>` in the new file, add:

   ```html
   <link rel="stylesheet" href="../assets/theme.css">
   <script defer src="../assets/shell.js" data-project="your-id" data-layout="app"></script>
   ```

   Use `data-layout="page"` instead if the page scrolls normally rather than filling
   the viewport.
4. Add a matching card to `index.html`.

## Sources

DKI Jakarta open data · BPS · WorldPop · Ministry of Environment and Forestry (KLHK)
land cover · Ditjen Dukcapil Kemendagri · Ministry of Public Works and Housing (PUPR) ·
IPC Acute Food Insecurity classifications. Basemaps © CARTO, © OpenStreetMap
contributors, Esri World Imagery.

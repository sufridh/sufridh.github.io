# Geospatial Dashboard - RTRW/RDTR + LULC + Kawasan Khusus

Static site, deployable as-is to GitHub Pages (e.g. `sufridh.github.io/botabek/`).
No build step - `index.html` loads MapLibre GL + pmtiles from CDN and reads
everything else via relative paths into `tiles/`.

```
botabek/
├── index.html                     Dashboard (vanilla JS, MapLibre GL + pmtiles via CDN)
├── tiles/
│   ├── rtrw/                      Vector pola ruang, pmtiles (RTRW/RDTR)
│   ├── kawasan_khusus/
│   │   └── kawasan_khusus.pmtiles Approximate footprints for 5 named developments
│   └── lulc_xyz/{z}/{x}/{y}.png   Static XYZ raster pyramid, z8-14 (LULC 2025)
├── geojson/
│   └── kawasan_khusus_template.geojson   Source for the pmtiles above - edit this
└── README.md
```

## LULC: static XYZ pyramid, not a dynamic COG server

GitHub Pages only serves static files, so the original titiler-backed COG
approach won't run there. Instead the raw GeoTIFF (`2025LULCEsri.tif`,
EPSG:32748, single-band paletted, Esri 10m Sentinel-2 land cover) is
pre-tiled once into a PNG XYZ pyramid:

```bash
gdalwarp -t_srs EPSG:3857 -r near -dstalpha 2025LULCEsri.tif lulc_3857.tif
gdal_translate -of vrt -expand rgba lulc_3857.tif temp.vrt
gdal2tiles.py -z 8-14 -r near --xyz -w none temp.vrt tiles/lulc_xyz
```

`-r near` (nearest-neighbor) is required throughout - this is categorical
class data, not continuous imagery, so any other resampling method would
blend class codes into invalid values. Output: ~2,500 tiles, ~13 MB total,
z8-14 (z14 ≈ native 10 m resolution near the equator here).

If you'd rather run a real dynamic tiler (titiler) somewhere else, the
raster source in `index.html` can be swapped back to a `{z}/{x}/{y}.png?url=...`
template pointed at that server.

## Kawasan Khusus: approximate footprints, not surveyed boundaries

None of the source RTRW/RDTR GeoPackages contain named private developments
(Meikarta, Jababeka, Kota Deltamas, BSD City, Gading Serpong) - RTRW/RDTR
maps zoning classification, not developer/brand names. The 5 polygons in
`kawasan_khusus.pmtiles` are square footprints sized to each development's
publicly reported land area and centered on its publicly reported location
(Wikipedia articles + developer sites - see the `sumber` property on each
feature, shown in the map popup). They are **not** digitized boundaries -
replace with real polygons (QGIS + satellite imagery, or a KML from the
developer) before treating this layer as authoritative.

## Two Bogor vintages, on purpose

`bogor_2024-2044.pmtiles` and `bogor_2016-2036.pmtiles` are the same
kabupaten at two different planning periods, kept as separate layers
(not merged) so you can toggle between them in the dashboard to see
what changed between the 2016 Perda and the 2024 RDTR. Field schemas
differ: 2024-2044 uses the GISTARU-standard `NAMOBJ` field, 2016-2036
uses `Pola_Ruang`/`Kode_Zona` instead. `index.html` handles both via a
`coalesce()` in the color expression.

## Rebuilding the RTRW/kawasan_khusus vector tiles

```bash
sudo apt-get install -y gdal-bin tippecanoe
tippecanoe -o tiles/kawasan_khusus/kawasan_khusus.pmtiles -Z6 -z14 \
  -l kawasan_khusus -f geojson/kawasan_khusus_template.geojson
```

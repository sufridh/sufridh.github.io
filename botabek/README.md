# Geospatial Dashboard - RTRW + LULC + Kawasan Khusus

Static site, deployable as-is to GitHub Pages (e.g. `sufridh.github.io/botabek/`).
No build step - `index.html` loads MapLibre GL + pmtiles from CDN and reads
everything else via relative paths into `tiles/`.

```
botabek/
├── index.html                     Dashboard (vanilla JS, MapLibre GL + pmtiles via CDN)
├── tiles/
│   ├── rtrw/                      Vector pola ruang, pmtiles (RTRW)
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

## Kawasan Khusus: digitized OSM boundaries + villa point data (update)

7 of the 9 development footprints have been replaced with real digitized
boundaries, built by dissolving (union) hundreds of OSM landuse parcels
pulled per development (`raw_<nama>.geojson` in the project's upload
history) into a single MultiPolygon per kawasan:

| Kawasan | Parcels dissolved | Union area (geometry) | `luas_ha_perkiraan` (kept, Wikipedia) |
|---|---|---|---|
| CitraRaya Tangerang | 217 | ~1,893 ha, 121 disjoint parts | 2,760 ha |
| Gading Serpong | 620 | ~3,048 ha, 82 parts | 1,500 ha |
| Kota Deltamas | 254 | ~7,868 ha, 24 parts | 3,200 ha |
| Kota Jababeka | 813 | ~16,252 ha, 65 parts | 5,600 ha |
| Meikarta (klaim luas proyek) | 261 | ~6,365 ha, 25 parts | 500 ha |
| Sentul City | 436 | ~3,061 ha, 228 parts | 3,150 ha |
| Summarecon Bekasi | 97 | ~2,011 ha, 31 parts | 240 ha |

**Important caveat:** the dissolved union area is 2-5x larger than the
publicly reported `luas_ha_perkiraan` for every single kawasan, and comes
out as dozens to hundreds of disjoint polygon fragments rather than one
contiguous shape. This strongly suggests the OSM landuse pull captured
parcels from the surrounding area (neighboring villages/kecamatan), not
just the development itself - it is real digitized OSM data, but not
necessarily a clean "this is the development's actual boundary" answer.
Treat the fill/outline you see on the map as "known OSM land-use activity
associated with this kawasan," not a surveyed property line. Per user
decision, `luas_ha_perkiraan` was deliberately left untouched (Wikipedia
figures) rather than recalculated from this geometry - see each feature's
`status_geometri` popup field for the per-kawasan numbers above.

**BSD City** and **Meikarta - Izin Lokasi resmi (RTRW-compliant)** still
have no source parcel data and remain the original schematic ellipse
footprints described below.

### Original ellipse-footprint method (still applies to the 2 unreplaced features)

None of the source RTRW GeoPackages contain named private developments
- RTRW maps zoning classification, not developer/brand names. The
remaining ellipse footprints are oriented along each development's main
access corridor (toll road / boulevard bearing) and sized to its publicly
reported land area, centered on real coordinates (Google Places) rather
than a Wikipedia-quoted lat/lon guess. See the `sumber` and `catatan`
properties on each feature (shown in the map popup) for citations.

### Villa points (Diva_Bogor_villa)

131 individual point features were added from `Diva_Bogor_villa__layer0_villa.gpkg`
- PBB tax-object records for private villas in Cisarua/Megamendung,
Kab. Bogor (Puncak area), rendered as small point markers rather than a
single dissolved polygon since each villa is its own record with its own
address/desa/kecamatan. `luas_ha_perkiraan` is left null for these (no
parcel-area data in the source).

Two extra features cover **Meikarta specifically** because they illustrate
the RTRW-pressure story directly: "Meikarta (klaim luas proyek)" is the
500 ha (some sources: 447 ha) Lippo Group marketed, and "Meikarta - Izin
Lokasi resmi (RTRW-compliant)" is the 84.3 ha Pemkab Bekasi actually
approved after Pemprov Jabar found ~363 ha of the claimed footprint sitting
inside land zoned Lahan Peruntukan Industri (LPI) - i.e. not residential
under Perda RTRW Kab. Bekasi No. 12/2011. That gap between marketed extent
and RTRW-compliant extent is one of the best-documented cases of private
land pushing against zoning policy in Bodetabek. Both polygons are
schematic (elliptical, not the real izin-lokasi shape) - the real 84.3 ha
parcel boundary would need to come from ATR/BPN Kab. Bekasi.

Also added, beyond the original 5, three more large private developments
inside the three kabupaten this dashboard already carries RTRW for: Sentul
City (3,150 ha, Kab. Bogor), CitraRaya Tangerang (2,760 ha, Kab. Tangerang)
and Summarecon Bekasi (240 ha, Kota Bekasi) - so each RTRW layer in the
sidebar now has at least one matching kawasan-khusus footprint to compare
against.

## Two Bogor vintages, on purpose

`bogor_2024-2044.pmtiles` and `bogor_2016-2036.pmtiles` are the same
kabupaten at two different planning periods, kept as separate layers
(not merged) so you can toggle between them in the dashboard to see
what changed between the 2016 Perda and the 2024 RTRW. Field schemas
differ: 2024-2044 uses the GISTARU-standard `NAMOBJ` field, 2016-2036
uses `Pola_Ruang`/`Kode_Zona` instead. `index.html` handles both via a
`coalesce()` in the color expression.

## Rebuilding the RTRW/kawasan_khusus vector tiles

```bash
sudo apt-get install -y gdal-bin tippecanoe
tippecanoe -o tiles/kawasan_khusus/kawasan_khusus.pmtiles -Z6 -z14 \
  -l kawasan_khusus -f geojson/kawasan_khusus_template.geojson
```

`kawasan_khusus_template.geojson` now mixes geometry types (Polygon/
MultiPolygon for the 9 development footprints, Point for the 131 villa
records) in one layer - `index.html` filters by `["geometry-type"]` to
route polygons to a fill+outline+label rendering and points to a small
circle marker, both sharing the same popup renderer.

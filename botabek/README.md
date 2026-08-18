# Geospatial Dashboard - RTRW/RDTR + LULC + Kawasan Khusus

```
geospatial-dashboard/
├── tiles/
│   ├── rtrw/
│   │   ├── bogor_2024-2044.pmtiles      RDTR terbaru (10.419 fitur, block-level)
│   │   ├── bogor_2016-2036.pmtiles      Perda RTRW lama (630 fitur, coarser)
│   │   ├── bekasi_2011-2031.pmtiles     Perda RTRW lama (23 fitur - sangat kasar)
│   │   └── tangerang_2020-2040.pmtiles  RDTR (2.735 fitur)
│   ├── lulc/
│   │   └── 2025LULCEsri_cog.tif         Cloud-Optimized GeoTIFF, Esri 10m LULC 2025
│   └── kawasan_khusus/
│       └── kawasan_khusus.pmtiles       PLACEHOLDER points, see caveat below
├── geojson/
│   └── kawasan_khusus_template.geojson  Source for the pmtiles above - edit this
├── frontend/
│   └── GeospatialDashboard.tsx          MapLibre GL React component, layer toggles
├── pipeline/
│   └── build_tiles.sh                   Reproducible GPKG/TIFF -> PMTiles/COG script
└── README.md                            This file
```

## Two Bogor vintages, on purpose

`bogor_2024-2044.pmtiles` and `bogor_2016-2036.pmtiles` are the same
kabupaten at two different planning periods, kept as separate layers
(not merged) so you can toggle between them in the dashboard to see
what changed between the 2016 Perda and the 2024 RDTR - useful for
before/after comparison, not just as a "latest" data source. Note the
field schemas differ: 2024-2044 uses the GISTARU-standard `NAMOBJ`
field, 2016-2036 uses `Pola_Ruang`/`Kode_Zona` instead. The frontend
component already handles both via a `coalesce()` in the color
expression.

## Kawasan Khusus caveat (repeat from before, still true)

None of the source RTRW/RDTR GeoPackages contain named private
developments (Meikarta, Jababeka, Kota Deltamas, BSD City, Gading
Serpong) - RTRW/RDTR maps zoning classification, not developer/brand
names. `kawasan_khusus_template.geojson` has 5 point placeholders at
public coordinates as a starting schema, not verified boundaries.
Replace with real digitized polygons (QGIS + satellite imagery, or a
KML from the developer) before treating this layer as authoritative.

## Running the pipeline again

```bash
sudo apt-get install -y gdal-bin tippecanoe
./pipeline/build_tiles.sh /path/to/source_gpkgs /path/to/output
```

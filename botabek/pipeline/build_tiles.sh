#!/usr/bin/env bash
# ---------------------------------------------------------------------
# build_tiles.sh
# Converts kabupaten RTRW/RDTR GeoPackages + the Esri LULC raster into
# web-ready tiles: PMTiles (vector) + COG (raster). Output layout
# matches what GeospatialDashboard.tsx (in ../frontend) expects:
#
#   tiles/rtrw/<name>.pmtiles
#   tiles/lulc/<name>_cog.tif
#   tiles/kawasan_khusus/kawasan_khusus.pmtiles
#
# Requires: gdal-bin, tippecanoe
#   sudo apt-get install -y gdal-bin tippecanoe
#
# Usage:
#   ./build_tiles.sh /path/to/input_dir /path/to/output_dir
#
# Naming convention for input GPKGs: this script pulls the source
# layer name for tippecanoe from the file's basename via a filter -
# rename inputs to <kode-wilayah>_KABUPATEN_<NAMA>-<periode>.gpkg
# (e.g. _3201_KABUPATEN_BOGOR-2024-2044.gpkg) to get that for free,
# or just edit the `layer=` line below for one-off files like the
# older Bogor 2016-2036 Perda, which doesn't follow that pattern.
# ---------------------------------------------------------------------
set -euo pipefail

IN_DIR="${1:?Usage: build_tiles.sh <input_dir> <output_dir>}"
OUT_DIR="${2:?Usage: build_tiles.sh <input_dir> <output_dir>}"
TMP_DIR="$(mktemp -d)"
mkdir -p "$OUT_DIR/rtrw" "$OUT_DIR/lulc" "$OUT_DIR/kawasan_khusus"

echo "== 1. RTRW/RDTR GeoPackages -> GeoJSON (WGS84, 2D) -> PMTiles =="
for f in "$IN_DIR"/*.gpkg; do
  base=$(basename "$f" .gpkg)

  # Try the standard _<kode>_KABUPATEN_<NAMA>-<periode> pattern first;
  # fall back to a slugified basename for one-off files.
  layer=$(echo "$base" | grep -oP '(?<=_)\d{4}_KABUPATEN_[A-Z]+' | tr '[:upper:]' '[:lower:]' || true)
  if [ -z "$layer" ]; then
    layer=$(echo "$base" | tr '[:upper:] -' '[:lower:]__')
  fi

  echo "  -> $base (layer: $layer)"
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 -dim XY "$TMP_DIR/$base.geojson" "$f"

  # -Z6 -z14: zoom 6 (province-scale) through 14 (block-level detail)
  # --drop-densest-as-needed / --extend-zooms-if-still-dropping keep
  # tile sizes sane on dense RDTR datasets without per-file tuning.
  tippecanoe -o "$OUT_DIR/rtrw/$base.pmtiles" \
    -l "$layer" \
    -Z6 -z14 \
    --drop-densest-as-needed \
    --extend-zooms-if-still-dropping \
    --coalesce-densest-as-needed \
    --simplification=4 \
    -f \
    "$TMP_DIR/$base.geojson"
done

echo "== 2. LULC raster -> Cloud-Optimized GeoTIFF =="
for f in "$IN_DIR"/*LULC*.tif; do
  base=$(basename "$f" .tif)
  gdal_translate "$f" "$OUT_DIR/lulc/${base}_cog.tif" \
    -of COG -co COMPRESS=DEFLATE -co BLOCKSIZE=512 -co RESAMPLING=NEAREST
done

echo "== 3. Kawasan khusus overlay (edit geojson/kawasan_khusus.geojson first!) =="
if [ -f "$IN_DIR/kawasan_khusus.geojson" ]; then
  tippecanoe -o "$OUT_DIR/kawasan_khusus/kawasan_khusus.pmtiles" \
    -l kawasan_khusus -Z4 -z16 -r1 -f \
    "$IN_DIR/kawasan_khusus.geojson"
else
  echo "  (skipped - no kawasan_khusus.geojson found in $IN_DIR;"
  echo "   see ../geojson/kawasan_khusus_template.geojson to get started)"
fi

rm -rf "$TMP_DIR"
echo "Done. Output in $OUT_DIR"

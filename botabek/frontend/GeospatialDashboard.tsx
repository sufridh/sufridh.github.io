/**
 * GeospatialDashboard.tsx
 * ------------------------------------------------------------------
 * MapLibre GL dashboard for RTRW/RDTR pola ruang + LULC + Kawasan
 * Khusus overlay, built to slot into the existing Next.js/TypeScript
 * frontend of the multi-city RDTR compliance/tile server system.
 *
 * Expects the sibling ../tiles folder (or wherever you host it) laid
 * out as produced by ../pipeline/build_tiles.sh:
 *   tiles/rtrw/bogor_2024-2044.pmtiles
 *   tiles/rtrw/bogor_2016-2036.pmtiles   <- earlier Perda, for comparison
 *   tiles/rtrw/bekasi_2011-2031.pmtiles
 *   tiles/rtrw/tangerang_2020-2040.pmtiles
 *   tiles/lulc/2025LULCEsri_cog.tif
 *   tiles/kawasan_khusus/kawasan_khusus.pmtiles
 *
 * Install:
 *   npm install maplibre-gl pmtiles
 *
 * Serving PMTiles:
 *   Single static files - no tile server needed. Host behind any
 *   static file host / CDN / S3 / your existing FastAPI static
 *   mount, and point PMTILES_BASE_URL below at that location.
 *
 * Serving the LULC raster:
 *   The COG here is meant for dynamic tiling (e.g. titiler) rather
 *   than a pre-cut XYZ pyramid:
 *     GET /cog/tiles/{z}/{x}/{y}.png?url=<path-to-cog>&colormap=...
 */

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------------------------------------------------------------------
// Config - swap these for your actual hosting locations
// ---------------------------------------------------------------------

const PMTILES_BASE_URL = "https://YOUR_CDN_OR_BUCKET/tiles";
const TITILER_BASE_URL = "https://YOUR_API_HOST/cog/tiles";
const LULC_COG_PATH = "s3://your-bucket/tiles/lulc/2025LULCEsri_cog.tif";

type KabupatenId = "bogor_2024" | "bogor_2016" | "bekasi" | "tangerang";

const KABUPATEN_CONFIG: Record<
  KabupatenId,
  { label: string; file: string; sourceLayer: string; center: [number, number]; zoom: number }
> = {
  bogor_2024: {
    label: "Kab. Bogor - RDTR 2024-2044 (terbaru)",
    file: "rtrw/bogor_2024-2044.pmtiles",
    sourceLayer: "3201_kabupaten_bogor",
    center: [106.8, -6.55],
    zoom: 10,
  },
  bogor_2016: {
    label: "Kab. Bogor - RTRW 2016-2036 (Perda lama)",
    file: "rtrw/bogor_2016-2036.pmtiles",
    sourceLayer: "3201_kabupaten_bogor_2016_2036",
    center: [106.8, -6.55],
    zoom: 10,
  },
  bekasi: {
    label: "Kab. Bekasi - RTRW 2011-2031",
    file: "rtrw/bekasi_2011-2031.pmtiles",
    sourceLayer: "3216_kabupaten_bekasi",
    center: [107.1, -6.2],
    zoom: 10,
  },
  tangerang: {
    label: "Kab. Tangerang - RDTR 2020-2040",
    file: "rtrw/tangerang_2020-2040.pmtiles",
    sourceLayer: "3603_kabupaten_tangerang",
    center: [106.55, -6.18],
    zoom: 10,
  },
};

// Pola ruang zone -> fill color. Field name differs between vintages:
// the 2024-2044 RDTR (and Bekasi/Tangerang) uses the GISTARU standard
// field NAMOBJ; the 2016-2036 Perda uses Pola_Ruang instead. The
// color expression below checks both fields so one style works for
// every layer, including when you toggle between the two Bogor
// vintages to compare what changed.
const ZONE_COLOR_MATCH: [string, string][] = [
  ["Permukiman Perkotaan", "#f4a261"],
  ["Permukiman Perdesaan", "#f7c59f"],
  ["Peruntukan Industri", "#9b5de5"],
  ["Hutan Lindung", "#1b4332"],
  ["Hutan Produksi", "#2d6a4f"],
  ["Hutan Konservasi", "#0b3d2e"],
  ["Perkebunan", "#40916c"],
  ["Tanaman Pangan", "#a7c957"],
  ["Lahan Kering", "#c3d941"],
  ["Lahan Basah", "#52b788"],
  ["Hortikultura", "#bfd200"],
  ["Perikanan", "#4cc9f0"],
  ["Peternakan", "#e9c46a"],
  ["Pariwisata", "#f72585"],
  ["Pertambangan", "#6f1d1b"],
  ["Hankam", "#495057"],
  ["Transportasi", "#adb5bd"],
  ["Pembangkitan Tenaga Listrik", "#ffb703"],
  ["Cagar Alam", "#264653"],
  ["Taman Nasional", "#2a9d8f"],
  ["Taman Wisata Alam", "#83c5be"],
  ["Danau", "#0077b6"],
  ["Waduk", "#0077b6"],
  ["Situ", "#00b4d8"],
  ["Badan Air", "#0096c7"],
  ["Sempadan", "#48cae4"],
  ["Jalur Hijau", "#80b918"],
];

function buildZoneColorExpression(): maplibregl.ExpressionSpecification {
  // Coalesce NAMOBJ (GISTARU-standard datasets) with Pola_Ruang (the
  // 2016-2036 Perda schema) so one expression works across vintages.
  const zoneField: any = ["coalesce", ["get", "NAMOBJ"], ["get", "Pola_Ruang"], ""];
  const expr: any[] = ["case"];
  for (const [needle, color] of ZONE_COLOR_MATCH) {
    expr.push(["in", needle, zoneField], color);
  }
  expr.push("#cccccc"); // fallback
  return expr as maplibregl.ExpressionSpecification;
}

export default function GeospatialDashboard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  const [activeKabupaten, setActiveKabupaten] = useState<KabupatenId>("bekasi");
  const [showRtrw, setShowRtrw] = useState(true);
  const [showLulc, setShowLulc] = useState(false);
  const [lulcOpacity, setLulcOpacity] = useState(0.7);
  const [showKawasanKhusus, setShowKawasanKhusus] = useState(true);
  const [rtrwOpacity, setRtrwOpacity] = useState(0.55);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    return () => maplibregl.removeProtocol("pmtiles");
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: ["https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"],
            tileSize: 256,
            attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
          },
        },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }],
      },
      center: KABUPATEN_CONFIG[activeKabupaten].center,
      zoom: KABUPATEN_CONFIG[activeKabupaten].zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => setupLayers(map, activeKabupaten));

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setupLayers(map: MLMap, kab: KabupatenId) {
    const cfg = KABUPATEN_CONFIG[kab];

    if (!map.getSource("rtrw")) {
      map.addSource("rtrw", { type: "vector", url: `pmtiles://${PMTILES_BASE_URL}/${cfg.file}` });
      map.addLayer({
        id: "rtrw-fill",
        type: "fill",
        source: "rtrw",
        "source-layer": cfg.sourceLayer,
        paint: { "fill-color": buildZoneColorExpression(), "fill-opacity": rtrwOpacity },
      });
      map.addLayer({
        id: "rtrw-outline",
        type: "line",
        source: "rtrw",
        "source-layer": cfg.sourceLayer,
        paint: { "line-color": "#333333", "line-width": 0.4, "line-opacity": 0.5 },
      });
      map.on("click", "rtrw-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const zoneName = f.properties?.NAMOBJ ?? f.properties?.Pola_Ruang ?? "-";
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${zoneName}</strong><br/>
             Kecamatan: ${f.properties?.WADMKC ?? "-"}<br/>
             Dasar hukum: ${f.properties?.NOTHPR ?? f.properties?.Penetapan ?? "-"}`
          )
          .addTo(map);
      });
    }

    if (!map.getSource("lulc")) {
      map.addSource("lulc", {
        type: "raster",
        tiles: [
          `${TITILER_BASE_URL}/{z}/{x}/{y}.png?url=${encodeURIComponent(LULC_COG_PATH)}&resampling=nearest`,
        ],
        tileSize: 256,
      });
      map.addLayer({
        id: "lulc-layer",
        type: "raster",
        source: "lulc",
        layout: { visibility: "none" },
        paint: { "raster-opacity": lulcOpacity },
      });
    }

    if (!map.getSource("kawasan-khusus")) {
      map.addSource("kawasan-khusus", {
        type: "vector",
        url: `pmtiles://${PMTILES_BASE_URL}/kawasan_khusus/kawasan_khusus.pmtiles`,
      });
      map.addLayer({
        id: "kawasan-khusus-point",
        type: "circle",
        source: "kawasan-khusus",
        "source-layer": "kawasan_khusus",
        paint: {
          "circle-radius": 7,
          "circle-color": "#e63946",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "kawasan-khusus-label",
        type: "symbol",
        source: "kawasan-khusus",
        "source-layer": "kawasan_khusus",
        layout: {
          "text-field": ["get", "nama"],
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: { "text-color": "#e63946", "text-halo-color": "#fff", "text-halo-width": 1.5 },
      });
      map.on("click", "kawasan-khusus-point", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${f.properties?.nama}</strong><br/>
             ${f.properties?.kategori}<br/>
             Pengembang: ${f.properties?.pengembang}<br/>
             <em style="color:#d90429">${f.properties?.status_geometri}</em>`
          )
          .addTo(map);
      });
    }
  }

  // Switch active kabupaten/vintage: swap the RTRW source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const cfg = KABUPATEN_CONFIG[activeKabupaten];

    if (map.getSource("rtrw")) {
      map.removeLayer("rtrw-outline");
      map.removeLayer("rtrw-fill");
      map.removeSource("rtrw");
    }
    map.addSource("rtrw", { type: "vector", url: `pmtiles://${PMTILES_BASE_URL}/${cfg.file}` });
    map.addLayer({
      id: "rtrw-fill",
      type: "fill",
      source: "rtrw",
      "source-layer": cfg.sourceLayer,
      paint: { "fill-color": buildZoneColorExpression(), "fill-opacity": rtrwOpacity },
    });
    map.addLayer({
      id: "rtrw-outline",
      type: "line",
      source: "rtrw",
      "source-layer": cfg.sourceLayer,
      paint: { "line-color": "#333333", "line-width": 0.4, "line-opacity": 0.5 },
    });
    map.flyTo({ center: cfg.center, zoom: cfg.zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKabupaten]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("rtrw-fill")) return;
    map.setLayoutProperty("rtrw-fill", "visibility", showRtrw ? "visible" : "none");
    map.setLayoutProperty("rtrw-outline", "visibility", showRtrw ? "visible" : "none");
    map.setPaintProperty("rtrw-fill", "fill-opacity", rtrwOpacity);
  }, [showRtrw, rtrwOpacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("lulc-layer")) return;
    map.setLayoutProperty("lulc-layer", "visibility", showLulc ? "visible" : "none");
    map.setPaintProperty("lulc-layer", "raster-opacity", lulcOpacity);
  }, [showLulc, lulcOpacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("kawasan-khusus-point")) return;
    const vis = showKawasanKhusus ? "visible" : "none";
    map.setLayoutProperty("kawasan-khusus-point", "visibility", vis);
    map.setLayoutProperty("kawasan-khusus-label", "visibility", vis);
  }, [showKawasanKhusus]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "#fff",
          borderRadius: 8,
          padding: "14px 16px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          width: 270,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Kabupaten / Versi RTRW</div>
        <select
          value={activeKabupaten}
          onChange={(e) => setActiveKabupaten(e.target.value as KabupatenId)}
          style={{ width: "100%", marginBottom: 14, padding: 4 }}
        >
          {Object.entries(KABUPATEN_CONFIG).map(([id, cfg]) => (
            <option key={id} value={id}>
              {cfg.label}
            </option>
          ))}
        </select>

        <div style={{ fontWeight: 600, marginBottom: 6 }}>Layer</div>

        <label style={{ display: "block", marginBottom: 4 }}>
          <input type="checkbox" checked={showRtrw} onChange={(e) => setShowRtrw(e.target.checked)} />{" "}
          RTRW / RDTR Pola Ruang
        </label>
        {showRtrw && (
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={rtrwOpacity}
            onChange={(e) => setRtrwOpacity(parseFloat(e.target.value))}
            style={{ width: "100%", marginBottom: 8 }}
          />
        )}

        <label style={{ display: "block", marginBottom: 4 }}>
          <input type="checkbox" checked={showLulc} onChange={(e) => setShowLulc(e.target.checked)} />{" "}
          Penggunaan Lahan (LULC 2025)
        </label>
        {showLulc && (
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={lulcOpacity}
            onChange={(e) => setLulcOpacity(parseFloat(e.target.value))}
            style={{ width: "100%", marginBottom: 8 }}
          />
        )}

        <label style={{ display: "block", marginBottom: 4 }}>
          <input
            type="checkbox"
            checked={showKawasanKhusus}
            onChange={(e) => setShowKawasanKhusus(e.target.checked)}
          />{" "}
          Kawasan Khusus (Meikarta, BSD, dll.)
        </label>
        <div style={{ fontSize: 11, color: "#d90429", marginTop: 6 }}>
          Batas kawasan khusus masih berupa titik placeholder - lihat catatan pipeline.
        </div>
      </div>
    </div>
  );
}

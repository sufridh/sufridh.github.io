import sys, os, time
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
import mercantile
from PIL import Image

def tile_raster(src_path, out_dir, zmin, zmax, tile_size=256):
    os.makedirs(out_dir, exist_ok=True)
    with rasterio.open(src_path) as ds:
        west, south, east, north = transform_bounds(ds.crs, 'EPSG:4326', *ds.bounds)
        total_written = 0
        total_skipped = 0
        t0 = time.time()
        for z in range(zmin, zmax + 1):
            tiles = list(mercantile.tiles(west, south, east, north, [z]))
            for t in tiles:
                l, b, r, top = mercantile.xy_bounds(t)
                win = from_bounds(l, b, r, top, transform=ds.transform)
                try:
                    data = ds.read(
                        window=win,
                        out_shape=(ds.count, tile_size, tile_size),
                        resampling=Resampling.nearest,
                        boundless=True,
                        fill_value=0
                    )
                except Exception as e:
                    continue
                alpha = data[3]
                if not np.any(alpha):
                    total_skipped += 1
                    continue
                arr = np.transpose(data, (1, 2, 0))
                img = Image.fromarray(arr, mode='RGBA')
                tdir = os.path.join(out_dir, str(z), str(t.x))
                os.makedirs(tdir, exist_ok=True)
                img.save(os.path.join(tdir, f'{t.y}.png'), optimize=True)
                total_written += 1
            print(f'z={z}: {len(tiles)} candidate tiles processed so far written={total_written} skipped={total_skipped} elapsed={time.time()-t0:.1f}s', flush=True)
    print(f'DONE written={total_written} skipped={total_skipped} total_time={time.time()-t0:.1f}s')

if __name__ == '__main__':
    src = sys.argv[1]
    out = sys.argv[2]
    zmin = int(sys.argv[3])
    zmax = int(sys.argv[4])
    tile_raster(src, out, zmin, zmax)

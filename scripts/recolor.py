import sys
import numpy as np
import rasterio
from rasterio.windows import Window

NEW_COLORS = {
    'Sawah': (168, 213, 245),
    'Hutan': (56, 145, 60),
    'Hutan Tanaman': (140, 198, 90),
    'Pertanian campuran': (222, 197, 96),
    'Permukiman': (198, 30, 30),
    'Tegalan': (255, 235, 0),
    'Perkebunan': (250, 185, 110),
    'Tambak': (105, 170, 250),
    'Lainnya': (128, 128, 128),
}

MAPPING = {
    (0, 92, 44): 'Hutan',
    (56, 145, 60): 'Hutan',
    (0, 90, 90): 'Hutan',
    (77, 150, 150): 'Hutan',
    (0, 110, 130): 'Hutan',
    (110, 175, 190): 'Hutan',
    (140, 198, 90): 'Hutan Tanaman',
    (230, 160, 160): 'Lainnya',
    (225, 190, 205): 'Lainnya',
    (255, 235, 0): 'Tegalan',
    (222, 197, 96): 'Pertanian campuran',
    (168, 213, 245): 'Sawah',
    (105, 170, 250): 'Tambak',
    (175, 175, 210): 'Permukiman',
    (250, 185, 110): 'Perkebunan',
    (198, 30, 30): 'Permukiman',
    (214, 0, 160): 'Permukiman',
    (240, 240, 210): 'Lainnya',
    (255, 0, 0): 'Lainnya',
    (0, 112, 255): 'Lainnya',
    (163, 216, 233): 'Lainnya',
    (190, 195, 140): 'Lainnya',
    (225, 225, 225): 'Lainnya',
    (128, 128, 128): 'Lainnya',
}

def recolor(src_path, dst_path, block_rows=2000):
    with rasterio.open(src_path) as ds:
        profile = ds.profile
        h, w = ds.height, ds.width
        total_unmatched = 0
        with rasterio.open(dst_path, 'w', **profile) as dst:
            for row0 in range(0, h, block_rows):
                nrows = min(block_rows, h - row0)
                win = Window(0, row0, w, nrows)
                data = ds.read(window=win)  # (4, nrows, w)
                r, g, b, a = data[0], data[1], data[2], data[3]
                out_r = np.zeros_like(r)
                out_g = np.zeros_like(g)
                out_b = np.zeros_like(b)
                matched = np.zeros(r.shape, dtype=bool)
                for (orig_r, orig_g, orig_b), new_class in MAPPING.items():
                    mask = (r == orig_r) & (g == orig_g) & (b == orig_b)
                    nr, ng, nb = NEW_COLORS[new_class]
                    out_r[mask] = nr
                    out_g[mask] = ng
                    out_b[mask] = nb
                    matched |= mask
                unmatched = (a > 0) & (~matched)
                total_unmatched += int(unmatched.sum())
                out = np.stack([out_r, out_g, out_b, a])
                dst.write(out, window=win)
        if total_unmatched:
            print(f'WARNING: {total_unmatched} opaque pixels did not match any known color')

if __name__ == '__main__':
    recolor(sys.argv[1], sys.argv[2])

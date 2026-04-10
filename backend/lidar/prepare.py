#!/usr/bin/env python3
"""
Preparazione dati LiDAR regionali per AlpineSnowMap.

Converte file DTM scaricati dai geoportali regionali in un Cloud Optimized
GeoTIFF (WGS84/EPSG:4326) pronto per lidar_service.py.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FONTI DATI GRATUITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PIEMONTE (DTM 5m o 1m):
  https://www.geoportale.piemonte.it/cms/
  Percorso: Dati → Download → DTM Piemonte
  Formato: GeoTIFF, CRS EPSG:32632 (UTM 32N)
  → Scarica in: backend/lidar/raw/piemonte/

VALLE D'AOSTA (DTM 2m):
  https://geoportale.regione.vda.it/
  Percorso: Download → Dati territoriali → DTM
  Formato: GeoTIFF, CRS EPSG:32632 (UTM 32N)
  → Scarica in: backend/lidar/raw/vda/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUISITI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pip install rasterio>=1.3 numpy

  (rasterio richiede GDAL):
    Ubuntu/Debian: sudo apt-get install libgdal-dev
    macOS:         brew install gdal
    Windows:       conda install -c conda-forge rasterio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Prepara Piemonte:
  python backend/lidar/prepare.py piemonte backend/lidar/raw/piemonte/

  # Prepara Valle d'Aosta:
  python backend/lidar/prepare.py vda backend/lidar/raw/vda/

  # Output:
  #   backend/lidar/piemonte.tif   (~2-8 GB, COG WGS84)
  #   backend/lidar/vda.tif        (~300-800 MB, COG WGS84)

  # Dopo la preparazione, avvia il backend normalmente.
  # lidar_service.py rileva automaticamente i file e abilita l'endpoint.
"""
import sys
import math
from pathlib import Path

try:
    import numpy as np
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import calculate_default_transform, reproject, Resampling
    from rasterio.crs import CRS
except ImportError:
    print("Errore: installa rasterio prima di eseguire questo script.")
    print("  pip install rasterio numpy")
    sys.exit(1)

TARGET_CRS = CRS.from_epsg(4326)   # WGS84 — richiesto da lidar_service.py
LIDAR_DIR  = Path(__file__).parent  # backend/lidar/


def find_tiffs(input_dir: Path) -> list[Path]:
    files = sorted(input_dir.glob("**/*.tif")) + sorted(input_dir.glob("**/*.TIF"))
    if not files:
        print(f"Nessun file .tif trovato in {input_dir}")
        sys.exit(1)
    print(f"Trovati {len(files)} file GeoTIFF in {input_dir}")
    return files


def merge_and_reproject(files: list[Path], output: Path) -> None:
    print("Apertura file sorgente...")
    sources = [rasterio.open(f) for f in files]

    print(f"Unione di {len(sources)} tile in un mosaico...")
    mosaic, mosaic_transform = merge(sources)
    src_crs = sources[0].crs
    src_nodata = sources[0].nodata

    print(f"  CRS sorgente:  {src_crs}")
    print(f"  Shape mosaic:  {mosaic.shape}  ({mosaic.shape[1]*mosaic.shape[2]/1e6:.0f} Mpixel)")

    print("Riproiezione in WGS84 (EPSG:4326)...")
    transform, width, height = calculate_default_transform(
        src_crs, TARGET_CRS,
        mosaic.shape[2], mosaic.shape[1],
        left=mosaic_transform.c,
        top=mosaic_transform.f,
        right=mosaic_transform.c + mosaic_transform.a * mosaic.shape[2],
        bottom=mosaic_transform.f + mosaic_transform.e * mosaic.shape[1],
    )

    reprojected = np.zeros((1, height, width), dtype=mosaic.dtype)

    reproject(
        source=mosaic,
        destination=reprojected,
        src_transform=mosaic_transform,
        src_crs=src_crs,
        dst_transform=transform,
        dst_crs=TARGET_CRS,
        resampling=Resampling.bilinear,
        src_nodata=src_nodata,
        dst_nodata=src_nodata,
    )

    print(f"Salvataggio Cloud Optimized GeoTIFF → {output}")
    with rasterio.open(
        output, "w",
        driver="GTiff",
        height=height, width=width,
        count=1,
        dtype=reprojected.dtype,
        crs=TARGET_CRS,
        transform=transform,
        nodata=src_nodata,
        tiled=True,
        blockxsize=512, blockysize=512,
        compress="deflate",
        predictor=2,
        interleave="band",
    ) as dst:
        dst.write(reprojected)

    for s in sources:
        s.close()

    size_gb = output.stat().st_size / 1e9
    print(f"Completato! {output.name}  ({size_gb:.2f} GB)")
    print()
    print("Passo successivo: avvia il backend — lidar_service.py rileverà")
    print(f"automaticamente il file e abiliterà il layer LiDAR per la provincia.")


def main():
    if len(sys.argv) < 3:
        print("Uso: python prepare.py <province_code> <input_dir>")
        print("  province_code: piemonte | vda")
        print("  input_dir:     cartella con i file .tif scaricati")
        sys.exit(1)

    code = sys.argv[1].lower()
    name_map = {"piemonte": "piemonte.tif", "vda": "vda.tif"}
    if code not in name_map:
        print(f"Codice non riconosciuto: {code}. Usa: piemonte | vda")
        sys.exit(1)

    input_dir = Path(sys.argv[2])
    if not input_dir.exists():
        print(f"Cartella non trovata: {input_dir}")
        sys.exit(1)

    output = LIDAR_DIR / name_map[code]
    files  = find_tiffs(input_dir)
    merge_and_reproject(files, output)


if __name__ == "__main__":
    main()

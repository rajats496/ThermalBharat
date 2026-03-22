"""
ThermalBharat  Google Earth Engine UHI + NDVI + Tree Cover Export Script
==========================================================================
Exports satellite data for 30 Indian cities:
   UHI   Yale YCEO (2003-2018)
   NDVI  Sentinel-2 recent cloud-free composite
   Tree Cover  Hansen Global Forest (2022)

CRITICAL NOTES (verified in GEE Code Editor):
  - UHI Dataset: "YALE/YCEO/UHI/UHI_yearly_pixel/v4"
  - UHI Filter: ee.Filter.eq('system:index', '2018')   STRING not int
  - filterDate() returns 0 results  DO NOT USE for UHI
  - UHI Band names are SWAPPED in dataset:
      DAYTIME data   -> select band named 'Nighttime'
      NIGHTTIME data -> select band named 'Daytime'
  - UHI value range: -1.5 to 7.5 (negative = cooler than rural)
  - GEE project: thermalbharat

USAGE:
  pip install earthengine-api geemap
  earthengine authenticate
  python gee_export.py          # Tier 1 (first 10 cities)
  Change EXPORT_TIER = 2        # Next 10 cities
  Change EXPORT_TIER = 3        # Last 10 cities
"""

import ee
import json
import os
import sys
from datetime import datetime, timedelta

# -----------------------------------------
# CONFIGURATION  Change tier to export in batches
# -----------------------------------------
EXPORT_TIER = 3       # 1 = cities 1-10, 2 = cities 11-20, 3 = cities 21-30
SCALE = 1000          # 1km resolution (manageable file size)
OUTPUT_DIR = os.path.join("public", "data", "gee")

# Set True to re-export ONLY the 7 coastal cities (Mumbai, Chennai, Kochi,
# Visakhapatnam, Bhubaneswar, Surat, Kolkata) using their tight land-only
# bounding boxes. Ignores EXPORT_TIER.
EXPORT_COASTAL_ONLY = False

YEARS = [
    '2003', '2004', '2005', '2006', '2007', '2008',
    '2009', '2010', '2011', '2012', '2013', '2014',
    '2015', '2016', '2017', '2018'
]

DATASET_UHI       = "YALE/YCEO/UHI/UHI_yearly_pixel/v4"
DATASET_SENTINEL2 = "COPERNICUS/S2_SR_HARMONIZED"
DATASET_HANSEN    = "UMD/hansen/global_forest_change_2022_v1_10"

# -----------------------------------------
# ALL 30 CITIES  Ordered in 3 tiers
# -----------------------------------------
CITIES = [
    # Tier 1
    {"name": "Delhi",          "lat": 28.6139, "lon": 77.2090},
    {"name": "Mumbai",         "lat": 19.0760, "lon": 72.8777},
    {"name": "Bangalore",      "lat": 12.9716, "lon": 77.5946},
    {"name": "Chennai",        "lat": 13.0827, "lon": 80.2707},
    {"name": "Hyderabad",      "lat": 17.3850, "lon": 78.4867},
    {"name": "Kolkata",        "lat": 22.5726, "lon": 88.3639},
    {"name": "Ahmedabad",      "lat": 23.0225, "lon": 72.5714},
    {"name": "Nagpur",         "lat": 21.1458, "lon": 79.0882},
    {"name": "Jaipur",         "lat": 26.9124, "lon": 75.7873},
    {"name": "Lucknow",        "lat": 26.8467, "lon": 80.9462},
    # Tier 2
    {"name": "Pune",           "lat": 18.5204, "lon": 73.8567},
    {"name": "Kanpur",         "lat": 26.4499, "lon": 80.3319},
    {"name": "Surat",          "lat": 21.1702, "lon": 72.8311},
    {"name": "Patna",          "lat": 25.5941, "lon": 85.1376},
    {"name": "Bhopal",         "lat": 23.2599, "lon": 77.4126},
    {"name": "Indore",         "lat": 22.7196, "lon": 75.8577},
    {"name": "Vadodara",       "lat": 22.3072, "lon": 73.1812},
    {"name": "Visakhapatnam",  "lat": 17.6868, "lon": 83.2185},
    {"name": "Bhubaneswar",    "lat": 20.2961, "lon": 85.8245},
    {"name": "Kochi",          "lat":  9.9312, "lon": 76.2673},
    # Tier 3
    {"name": "Rajkot",         "lat": 22.3039, "lon": 70.8022},
    {"name": "Ludhiana",       "lat": 30.9010, "lon": 75.8573},
    {"name": "Agra",           "lat": 27.1767, "lon": 78.0081},
    {"name": "Nashik",         "lat": 19.9975, "lon": 73.7898},
    {"name": "Faridabad",      "lat": 28.4089, "lon": 77.3178},
    {"name": "Meerut",         "lat": 28.9845, "lon": 77.7064},
    {"name": "Varanasi",       "lat": 25.3176, "lon": 82.9739},
    {"name": "Coimbatore",     "lat": 11.0168, "lon": 76.9558},
    {"name": "Madurai",        "lat":  9.9252, "lon": 78.1198},
    {"name": "Chandigarh",     "lat": 30.7333, "lon": 76.7794},
]

# -----------------------------------------
# HELPERS
# -----------------------------------------
def city_to_filename(city_name, suffix="uhi"):
    """e.g. ('Delhi','uhi') -> 'delhi_uhi.json'"""
    return city_name.lower().replace(" ", "_") + f"_{suffix}.json"


def _haversine_km(lat1, lon1, lat2, lon2):
    """Haversine distance between two points in km."""
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_tier_cities(tier):
    start = (tier - 1) * 10
    return CITIES[start:start + 10]


def authenticate():
    print("Initializing Google Earth Engine...")
    try:
        ee.Initialize(project='thermalbharat')
        print("GEE initialized (project: thermalbharat)")
    except Exception:
        try:
            ee.Authenticate()
            ee.Initialize(project='thermalbharat')
            print("GEE authenticated and initialized")
        except Exception as e:
            print(f"GEE initialization failed: {e}")
            print("\nTry running: earthengine authenticate")
            sys.exit(1)


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output directory: {OUTPUT_DIR}")


# -----------------------------------------
# Coastal city bounding boxes (hand-tuned to land only)
# Each box is [lon_min, lat_min, lon_max, lat_max]
# Clipped so the Arabian Sea / Bay of Bengal is excluded.
# -----------------------------------------
COASTAL_BBOX = {
    # Mumbai: Arabian Sea to the WEST
    # Extended east to 73.20 to include Thane, Navi Mumbai
    "Mumbai":        [72.75, 18.85, 73.20, 19.35],

    # Kochi: backwaters + Arabian Sea on west/south
    "Kochi":         [76.15,  9.85, 76.45, 10.15],

    # Chennai: Bay of Bengal on EAST
    # Expanded west to 79.95 (Tambaram, Chromepet)
    "Chennai":       [79.95, 12.75, 80.35, 13.35],

    # Visakhapatnam: Bay of Bengal on EAST
    "Visakhapatnam": [83.10, 17.55, 83.45, 17.85],

    # Bhubaneswar: Bay of Bengal ~80 km east
    "Bhubaneswar":   [85.68, 20.17, 85.97, 20.43],

    # Surat: Gulf of Khambhat on WEST
    "Surat":         [72.77, 21.06, 73.05, 21.32],

    # Kolkata: Sundarbans/Bay on east
    "Kolkata":       [88.20, 22.42, 88.55, 22.73],
}


def make_bbox(city_name, lat, lon, delta=0.25):
    """
    Return an ee.Geometry.Rectangle for the city.
    Coastal cities use hand-tuned boxes to exclude ocean pixels.
    All other cities use the standard +/-delta square.
    """
    if city_name in COASTAL_BBOX:
        lon_min, lat_min, lon_max, lat_max = COASTAL_BBOX[city_name]
        print(f"    Using coastal bbox for {city_name}: "
              f"[{lon_min},{lat_min} -> {lon_max},{lat_max}]")
        return ee.Geometry.Rectangle([lon_min, lat_min, lon_max, lat_max])
    return ee.Geometry.Rectangle(
        [lon - delta, lat - delta, lon + delta, lat + delta]
    )


def get_land_mask():
    """Hansen datamask: 1 = land, 2 = water. Keep only land pixels."""
    return ee.Image(DATASET_HANSEN).select('datamask').eq(1)


# -----------------------------------------
# PART 3A  UHI Export
# -----------------------------------------
def export_city_uhi(city):
    """
    Export UHI data for one city for all 16 years.

    IMPORTANT band swap (confirmed dataset quirk):
       Daytime SUHI value  -> select band 'Nighttime'
       Nighttime SUHI value -> select band 'Daytime'
    """
    city_name = city["name"]
    lat, lon  = city["lat"], city["lon"]
    bbox = make_bbox(city_name, lat, lon)

    pixels_dict = {}
    stats = {}

    for year in YEARS:
        collection = ee.ImageCollection(DATASET_UHI).filter(
            ee.Filter.eq('system:index', year)
        )
        image = collection.first()

        if image is None:
            print(f"  No UHI image for {city_name} year {year}")
            continue

        # Band swap: 'Nighttime' = daytime data; 'Daytime' = nighttime data
        day_band   = image.select('Nighttime')
        night_band = image.select('Daytime')

        # Apply land mask to exclude ocean/water pixels
        land_mask = get_land_mask()
        combined = day_band.rename('day').addBands(
            night_band.rename('night')
        )
        combined = combined.updateMask(land_mask)

        day_samples = combined.sample(
            region=bbox, scale=SCALE, geometries=True
        )

        try:
            features = day_samples.getInfo()["features"]
        except Exception as samp_err:
            print(f"  UHI sampling failed {city_name} {year}: {samp_err}")
            continue

        day_vals, night_vals = [], []

        for feat in features:
            props  = feat["properties"]
            coords = feat["geometry"]["coordinates"]
            px_lon, px_lat = coords[0], coords[1]
            day_val   = props.get("day")
            night_val = props.get("night")
            if day_val is None or night_val is None:
                continue

            px_lat_r = round(px_lat, 4)
            px_lon_r = round(px_lon, 4)
            key = f"{px_lat_r}_{px_lon_r}"

            if key not in pixels_dict:
                pixels_dict[key] = {
                    "lat": px_lat_r, "lon": px_lon_r,
                    "day": {}, "night": {}
                }

            pixels_dict[key]["day"][year]   = round(float(day_val),   3)
            pixels_dict[key]["night"][year] = round(float(night_val), 3)

            day_vals.append(float(day_val))
            night_vals.append(float(night_val))

        if day_vals:
            stats[year] = {
                "day_mean":   round(sum(day_vals) / len(day_vals), 3),
                "day_max":    round(max(day_vals), 3),
                "day_min":    round(min(day_vals), 3),
                "night_mean": round(
                    sum(night_vals) / len(night_vals), 3
                ) if night_vals else None,
                "night_max":  round(
                    max(night_vals), 3
                ) if night_vals else None,
                "night_min":  round(
                    min(night_vals), 3
                ) if night_vals else None,
            }

        print(f"    UHI year {year}: {len(day_vals)} pixels")

    pixels_list = list(pixels_dict.values())
    return {
        "city":        city_name,
        "lat":         lat,
        "lon":         lon,
        "exportDate":  datetime.utcnow().strftime("%Y-%m-%d"),
        "totalPixels": len(pixels_list),
        "years":       YEARS,
        "pixels":      pixels_list,
        "stats":       stats,
    }


# -----------------------------------------
# PART 4A  Sentinel-2 NDVI Export
# -----------------------------------------
def export_city_ndvi(city):
    """
    Export Sentinel-2 NDVI for the most recent cloud-free 60-day composite.
    NDVI = (B8 - B4) / (B8 + B4)
    Values: -0.1 to 0.9 (concrete to dense forest)

    FILTERS APPLIED:
    1. Hansen land mask   - removes ocean/water at GEE level
    2. Water pixel filter - removes NDVI <= 0.05 pixels

    NOTE: MODIS urban mask intentionally NOT applied.
    It was too aggressive — reduced Lucknow from 3080 to 283 pixels.
    Water filter alone is sufficient for clean data.
    """
    city_name = city["name"]
    lat, lon  = city["lat"], city["lon"]
    bbox = make_bbox(city_name, lat, lon)

    # Date range: last 60 days from today
    end_date   = datetime.utcnow()
    start_date = end_date - timedelta(days=60)
    end_str    = end_date.strftime("%Y-%m-%d")
    start_str  = start_date.strftime("%Y-%m-%d")

    # Cloud-masked Sentinel-2 composite
    s2 = (
        ee.ImageCollection(DATASET_SENTINEL2)
        .filterBounds(bbox)
        .filterDate(start_str, end_str)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        .map(lambda img: img.normalizedDifference(
            ['B8', 'B4']).rename('ndvi'))
        .median()
    )

    # Apply Hansen land mask — removes ocean/sea/river pixels at GEE level
    land_mask = get_land_mask()
    s2 = s2.updateMask(land_mask)

    samples = s2.sample(region=bbox, scale=SCALE, geometries=True)

    try:
        features = samples.getInfo()["features"]
    except Exception as e:
        raise RuntimeError(f"NDVI sampling failed: {e}")

    pixels = []
    water_count = 0

    for feat in features:
        ndvi_val = feat["properties"].get("ndvi")
        coords   = feat["geometry"]["coordinates"]
        if ndvi_val is None:
            continue

        # Water/ocean safety filter
        # NDVI <= 0.05 = water, ocean, or bare concrete
        if float(ndvi_val) <= 0.05:
            water_count += 1
            continue

        px_lat, px_lon = coords[1], coords[0]

        pixels.append({
            "lat":  round(px_lat, 4),
            "lon":  round(px_lon, 4),
            "ndvi": round(float(ndvi_val), 4),
        })

    print(f"    NDVI: {len(pixels)} pixels ({start_str} -> {end_str})")
    if water_count:
        print(
            f"    Filtered out {water_count} "
            f"water/low-NDVI pixels (NDVI <= 0.05)"
        )

    return {
        "city":   city_name,
        "date":   end_str,
        "pixels": pixels,
    }


# -----------------------------------------
# PART 4A  Hansen Tree Cover Export
# -----------------------------------------
def export_city_treecover(city):
    """
    Export Hansen Global Forest Change tree cover percent.
    Band 'treecover2000': 0-100 (% canopy cover at 30m).
    """
    city_name = city["name"]
    lat, lon  = city["lat"], city["lon"]
    bbox = make_bbox(city_name, lat, lon)

    # Apply land mask so ocean cells return no value and are skipped
    land_mask = get_land_mask()
    hansen = (
        ee.Image(DATASET_HANSEN)
        .select("treecover2000")
        .updateMask(land_mask)
    )
    samples = hansen.sample(region=bbox, scale=SCALE, geometries=True)

    try:
        features = samples.getInfo()["features"]
    except Exception as e:
        raise RuntimeError(f"Tree cover sampling failed: {e}")

    pixels = []
    for feat in features:
        tc_val = feat["properties"].get("treecover2000")
        coords = feat["geometry"]["coordinates"]
        if tc_val is None:
            continue
        pixels.append({
            "lat":       round(coords[1], 4),
            "lon":       round(coords[0], 4),
            "treecover": int(round(float(tc_val))),
        })

    print(f"    Tree Cover: {len(pixels)} pixels")

    return {
        "city":   city_name,
        "year":   2022,
        "pixels": pixels,
    }


# -----------------------------------------
# Save helpers
# -----------------------------------------
def save_json(city_name, data, suffix):
    filename = city_to_filename(city_name, suffix)
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    size_kb = os.path.getsize(filepath) // 1024
    print(f"  Saved: {filename} ({size_kb} KB)")
    return filepath


def save_cities_index(
    exported_cities_uhi,
    exported_cities_ndvi,
    exported_cities_tc
):
    """Update cities_index.json preserving existing entries."""
    index_path = os.path.join(OUTPUT_DIR, "cities_index.json")

    existing = {}
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            try:
                old = json.load(f)
                existing = {
                    c["name"]: c for c in old.get("cities", [])
                }
            except json.JSONDecodeError:
                pass

    for city in CITIES:
        name = city["name"]
        prev = existing.get(name, {})
        entry = {
            "name":          name,
            "file":          city_to_filename(name, "uhi"),
            "ndviFile":      city_to_filename(name, "ndvi"),
            "treecoverFile": city_to_filename(name, "treecover"),
            "lat":           city["lat"],
            "lon":           city["lon"],
            "available": (
                prev.get("available", False) or
                (name in exported_cities_uhi)
            ),
            "ndviAvailable": (
                prev.get("ndviAvailable", False) or
                (name in exported_cities_ndvi)
            ),
            "tcAvailable": (
                prev.get("tcAvailable", False) or
                (name in exported_cities_tc)
            ),
        }
        existing[name] = entry

    cities_list = [
        existing[c["name"]] for c in CITIES
        if c["name"] in existing
    ]
    available_count = sum(
        1 for c in cities_list if c["available"]
    )
    ndvi_count = sum(
        1 for c in cities_list if c.get("ndviAvailable")
    )
    tc_count = sum(
        1 for c in cities_list if c.get("tcAvailable")
    )

    index = {
        "generated":       datetime.utcnow().strftime("%Y-%m-%d"),
        "totalCities":     len(cities_list),
        "availableCities": available_count,
        "ndviAvailable":   ndvi_count,
        "tcAvailable":     tc_count,
        "cities":          cities_list,
    }

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(
        f"\ncities_index.json  "
        f"UHI:{available_count} "
        f"NDVI:{ndvi_count} "
        f"TC:{tc_count} / {len(cities_list)}"
    )
    return index_path


def _already_exported(suffix):
    """Return city names that already have a JSON file on disk."""
    result = []
    for city in CITIES:
        fp = os.path.join(
            OUTPUT_DIR,
            city_to_filename(city["name"], suffix)
        )
        if os.path.exists(fp):
            result.append(city["name"])
    return result


# -----------------------------------------
# MAIN
# -----------------------------------------
def main():
    # City selection
    if EXPORT_COASTAL_ONLY:
        COASTAL_NAMES = list(COASTAL_BBOX.keys())
        tier_cities = [
            c for c in CITIES if c["name"] in COASTAL_NAMES
        ]
        mode_label = f"Coastal-Only ({', '.join(COASTAL_NAMES)})"
    else:
        if EXPORT_TIER not in (1, 2, 3):
            print(
                f"Invalid EXPORT_TIER={EXPORT_TIER}. "
                f"Must be 1, 2, or 3."
            )
            sys.exit(1)
        tier_cities = get_tier_cities(EXPORT_TIER)
        mode_label  = f"Tier {EXPORT_TIER}"

    print("=" * 60)
    print(f"  ThermalBharat GEE Export  -- {mode_label}")
    print("  Exporting: UHI + NDVI + Tree Cover")
    print("=" * 60)

    authenticate()
    ensure_output_dir()

    total = len(tier_cities)

    succeeded_uhi,  failed_uhi  = [], []
    succeeded_ndvi, failed_ndvi = [], []
    succeeded_tc,   failed_tc   = [], []

    for i, city in enumerate(tier_cities, start=1):
        city_name = city["name"]
        print(f"\n{'--'*25}")
        print(f"[{i}/{total}] Exporting {city_name}...")
        print(f"{'--'*25}")

        # 1. UHI export
        try:
            data = export_city_uhi(city)
            save_json(city_name, data, "uhi")
            succeeded_uhi.append(city_name)
            print(
                f"UHI done "
                f"({data['totalPixels']} pixels, "
                f"{len(YEARS)} years)"
            )
        except Exception as err:
            failed_uhi.append(city_name)
            print(f"UHI failed: {err}")

        # 2. NDVI export
        try:
            ndvi_data = export_city_ndvi(city)
            save_json(city_name, ndvi_data, "ndvi")
            succeeded_ndvi.append(city_name)
            print(f"NDVI done ({len(ndvi_data['pixels'])} pixels)")
        except Exception as err:
            failed_ndvi.append(city_name)
            print(f"NDVI failed: {err}")

        # 3. Tree Cover export
        try:
            tc_data = export_city_treecover(city)
            save_json(city_name, tc_data, "treecover")
            succeeded_tc.append(city_name)
            print(
                f"Tree Cover done "
                f"({len(tc_data['pixels'])} pixels)"
            )
        except Exception as err:
            failed_tc.append(city_name)
            print(f"Tree Cover failed: {err}")

    # Update index preserving all previous exports
    all_uhi  = set(succeeded_uhi  + _already_exported("uhi"))
    all_ndvi = set(succeeded_ndvi + _already_exported("ndvi"))
    all_tc   = set(succeeded_tc   + _already_exported("treecover"))
    save_cities_index(all_uhi, all_ndvi, all_tc)

    print("\n" + "=" * 60)
    print(f"  Tier {EXPORT_TIER} complete")
    print(
        f"  UHI:       {len(succeeded_uhi)}/{total} ok  "
        f"{len(failed_uhi)} failed"
    )
    print(
        f"  NDVI:      {len(succeeded_ndvi)}/{total} ok  "
        f"{len(failed_ndvi)} failed"
    )
    print(
        f"  TreeCover: {len(succeeded_tc)}/{total} ok  "
        f"{len(failed_tc)} failed"
    )
    if failed_uhi + failed_ndvi + failed_tc:
        all_failed = set(
            failed_uhi + failed_ndvi + failed_tc
        )
        print(f"\n  Failed cities: {', '.join(all_failed)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
import os
import json

OUTPUT_DIR = os.path.join("public", "data", "gee")
index_path = os.path.join(OUTPUT_DIR, "cities_index.json")

# All 30 cities
ALL_CITIES = [
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

def city_to_filename(name, suffix):
    return name.lower().replace(" ", "_") + f"_{suffix}.json"

cities_list = []
fixed = 0

for city in ALL_CITIES:
    name = city["name"]
    
    uhi_file = os.path.join(OUTPUT_DIR,
        city_to_filename(name, "uhi"))
    ndvi_file = os.path.join(OUTPUT_DIR,
        city_to_filename(name, "ndvi"))
    tc_file = os.path.join(OUTPUT_DIR,
        city_to_filename(name, "treecover"))

    uhi_exists  = os.path.exists(uhi_file)
    ndvi_exists = os.path.exists(ndvi_file)
    tc_exists   = os.path.exists(tc_file)

    if uhi_exists:
        fixed += 1

    cities_list.append({
        "name":          name,
        "file":          city_to_filename(name, "uhi"),
        "ndviFile":      city_to_filename(name, "ndvi"),
        "treecoverFile": city_to_filename(name, "treecover"),
        "lat":           city["lat"],
        "lon":           city["lon"],
        "available":       uhi_exists,
        "ndviAvailable":   ndvi_exists,
        "tcAvailable":     tc_exists,
    })
    
    print(f"{name}: UHI={uhi_exists} "
          f"NDVI={ndvi_exists} "
          f"TC={tc_exists}")

index = {
    "generated":       "2026-03-14",
    "totalCities":     30,
    "availableCities": fixed,
    "cities":          cities_list,
}

with open(index_path, "w") as f:
    json.dump(index, f, indent=2)

print(f"\nFixed {fixed}/30 cities!")
print("cities_index.json updated!")

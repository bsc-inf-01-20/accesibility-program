export const AMENITY_TYPES = {
    MARKET: {key: 'market', label: "Market", queryTag: 'amenity=marketplace'},
    CLINIC: {key: 'clinic', label: "Clinic", queryTag: 'amenity=clinic'},
    HOSPITAL: {key: 'hospital', label: "Hospital", queryTag: 'amenity=hospital'},
};

export const OVERPASS_INSTANCES = [
    'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

export const OSRM_URL = "http://localhost:5000/route/v1/walking";
export const INITIAL_BATCH_SIZE = 5;
export const BATCH_DELAY_MS = 1000;
export const CACHE_TTL_MS = 3600000; // 1 hour
export const SEARCH_RADIUS = 10000; //10km
export const SEARCH_RADIUS_1 = 30000; //30km
export const SEARCH_RADIUS_2 = 40000; //40km

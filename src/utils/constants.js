// utils/constants.js
export const AMENITY_TYPES = {
  MARKET: {
    key: 'market',  // Must have 'key'
    label: 'Market', // Must have 'label'
    queryTag: 'grocery_or_supermarket',
    keyword: 'market'
  },
  HOSPITAL: {
    key: 'hospital',
    label: 'Hospital',
    queryTag: 'hospital',
    keyword: 'hospital'
  }
  // ... other types
};
export const OVERPASS_INSTANCES = [
    'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

export const OSRM_URL = "http://localhost:5000";
export const INITIAL_BATCH_SIZE = 5;
export const BATCH_DELAY_MS = 1000;
export const CACHE_TTL_MS = 3600000; // 1 hour
export const SEARCH_RADIUS = 10000; //10km
export const EXTENDED_RADIUS_1 = 30000; // 30km
export const EXTENDED_RADIUS_2 = 40000; // 40km

export const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoiZmFyZ28yMTkiLCJhIjoiY205Y25xajJxMHJlbzJpc2M4bjhhdm9hZCJ9.xhoZP4Gr0_3yo6N9EBnD_w";



import { CACHE_TTL_MS } from "./constants";

export const placeCache = new Map();

// Cache key for Overpass API queries
export const getOverpassCacheKey = (lat, lon, radius, type) =>
    `${lat.toFixed(6)}_${lon.toFixed(6)}_${radius}_${type}`;

// Cache key for OSRM distance calculations
export const getOSRMCacheKey = (schoolCoords, placeCoords) =>
    `${schoolCoords[0].toFixed(6)}|${schoolCoords[1].toFixed(6)}_${placeCoords[0].toFixed(6)}|${placeCoords[1].toFixed(6)}`;

export const cleanupCache = () => {
    const now = Date.now();
    for (const [key, { timestamp }] of placeCache.entries()) {
        if (now - timestamp > CACHE_TTL_MS) placeCache.delete(key);
    }
};
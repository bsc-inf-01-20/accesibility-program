import { CACHE_TTL_MS } from "./constants";

export const placeCache = new Map();
export const getCacheKey = (lat, lon, radius, type) =>
    `${lat.toFixed(4)}_${lon.toFixed(4)}_${radius}_${type}`;

export const cleanupCache = () => {
    const now = Date.now();
    for (const [key, {timestamp}] of placeCache.entries()) {
        if (now - timestamp > CACHE_TTL_MS) placeCache.delete(key);
    }
};
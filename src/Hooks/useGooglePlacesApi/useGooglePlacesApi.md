
This React hook provides an interface for fetching nearby amenities (like markets, clinics, etc.) using a Google Places API proxy. It is built to integrate with school locations and supports both general amenities and Malawi-specific market handling.

### Features

- Calls Google Places API (via proxy) using coordinates
- Handles custom logic for Malawi markets
- Supports amenity-type configuration
- Parses and filters location results
- Tracks loading and error states

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/places/search` | Fetch general amenities via Google Places |
| `/api/places/malawi-markets` | Custom logic for Malawi markets |

### Parameters

### `processSchool(school, amenityType)`

Fetches nearby amenities for a given school.

- `school`: Must contain `geometry.coordinates` as `[lng, lat]`
- `amenityType`: A key defined in `AMENITY_TYPES` or a fallback query string





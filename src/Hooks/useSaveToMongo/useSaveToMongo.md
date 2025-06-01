

### Overview  
A React hook for bulk saving school amenity routes to MongoDB with geospatial data support. Handles transformation, validation, and batch processing of route documents.

### Features

**Bulk Processing**
- Processes 50 documents per batch
- Tracks progress (processed/total/lastSaved)
- Maintains success/failure records
- Uses `/api/routes/bulk` endpoint

**Data Handling**
- Normalizes coordinate formats:
  - Converts `[lng,lat]` arrays → `{lat,lng}` objects
  - Defaults to `{ lat: 0, lng: 0 }` for invalid data
- Extracts administrative hierarchy
- Standardizes field names

**Validation**
- Requires:
  - `schoolId` (string)
  - `placeId` (string)
  - `distance` (number)
- Sets defaults for missing fields

### API Reference

#### Parameters
| Name     | Type       | Required | Description          |
|----------|------------|----------|----------------------|
| `results`| `object[]` | Yes      | Array of route documents |


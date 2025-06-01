
### Overview
A custom React hook for initializing and managing Leaflet maps with school and amenity markers. Designed for applications requiring geographic visualization of school locations and nearby amenities with routing information.

### Features
- **Map Initialization**:
  - Sets up Leaflet map with Mapbox tiles
  - Centers map on school coordinates
  - Handles map cleanup on unmount

- **Marker Management**:
  - Custom icons for schools (🏫) and amenities (🏥/🏪)
  - Interactive popups with location information
  - Automatic coordinate conversion (LngLat ↔ LatLng)

- **Route Visualization**:
  - Displays GeoJSON route data as blue polyline
  - Automatically fits map bounds to include all features
  - Handles both point and route data

### API Reference

#### Parameters
| Parameter       | Type               | Description |
|-----------------|--------------------|-------------|
| `containerRef`  | `React.RefObject`  | Reference to DOM element for map container |
| `results`       | `Array`            | Array of result objects containing location data |


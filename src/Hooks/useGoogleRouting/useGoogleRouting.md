
### Overview
A custom React hook for calculating optimal routes using Google Directions API. Designed for applications requiring distance/duration calculations between geographic points with flexible transportation modes.

### Features
- **Route Calculation**:
  - Supports multiple travel modes (walking, driving, etc.)
  - Handles both single and batch routing requests
  - Provides detailed route information including:
    - Distance in kilometers
    - Duration in seconds and formatted text
    - Step-by-step directions
    - Overview polyline for mapping

- **Flexible Input Handling**:
  - Accepts coordinates in multiple formats
  - Optional amenity type parameter
  - Automatic validation of input locations

- **Performance Optimization**:
  - Concurrent request limiting (3 parallel requests)
  - Progress tracking during batch operations
  - Comprehensive error handling

### API Reference

### Returned Object
| Property            | Type                              | Description |
|---------------------|-----------------------------------|-------------|
| `findClosestPlace`  | `function`                       | Calculates route to nearest destination |
| `findClosestPlaces` | `function`                       | Batch processes multiple origins |
| `loading`          | `boolean`                        | True during API requests |
| `error`            | `string \| null`                 | Last error message |
| `progress`         | `{current: number, total: number, percentage: number}` | Batch progress |
| `reset`            | `function`                       | Clears error and progress state |


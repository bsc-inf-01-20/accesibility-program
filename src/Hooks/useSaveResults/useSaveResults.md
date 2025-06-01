
### Overview
A custom React hook for bulk saving school amenity routing results to both DHIS2 and MongoDB. Handles complex data transformation, batch processing, and error handling for large datasets.

### Features
- **Dual Storage**:
  - Saves to DHIS2 events (with tracker API)
  - Parallel save to MongoDB (via separate hook)
  
- **Batch Processing**:
  - Processes records in configurable batches (default: 10)
  - Tracks progress with detailed metrics
  - Handles existing record updates

- **Data Integrity**:
  - Validates required fields
  - Calculates priority based on distance
  - Maintains consistent data formatting

- **Error Handling**:
  - Comprehensive logging
  - Detailed failure tracking
  - Job status monitoring

### API Reference

### Parameters
| Parameter          | Type     | Description |
|--------------------|----------|-------------|
| `results`         | `Array`  | Array of routing result objects |
| `selectedAmenity` | `Object` | Selected amenity type with label |

### Returned Object
| Property    | Type       | Description |
|-------------|------------|-------------|
| `saveBulk`  | `function` | Main save function |
| `saving`    | `boolean`  | Save in progress |
| `error`     | `string`   | Last error message |
| `progress`  | `object`   | Save progress metrics |
| `cancel`    | `function` | Cancel operation |


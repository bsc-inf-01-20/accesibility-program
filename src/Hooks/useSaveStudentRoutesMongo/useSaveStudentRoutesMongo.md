
### Overview  
A custom React hook for bulk saving student route data to a MongoDB database via a REST API. Handles batch processing, data validation, and progress tracking.

### Features

**Bulk Processing**
- Processes student routes in configurable batches (default: 50)
- Tracks progress with processed/total counts  
- Maintains success/failure records for each document

**Data Validation** 
- Validates required student and school IDs  
- Normalizes coordinate formats with fallback values  
- Type-safe conversion of all fields  
- Default value handling for missing data  

**Error Handling**  
- Individual document validation errors don't fail entire batch  
- Detailed error reporting for failed documents  
- Timeout protection for API requests (30s)  

#### API Reference

#### Parameters

| Parameter | Type       | Required Fields     | Description                     |
|-----------|------------|---------------------|---------------------------------|
| `results` | `object[]` | `studentId`, `schoolId` | Array of student route objects |




### Overview  
A custom React hook for bulk saving teacher route data to a MongoDB database via a REST API. Handles batch processing of teacher travel routes with validation and progress tracking.

### Features

**Bulk Processing**
- Processes teacher routes in configurable batches (default: 50)
- Tracks progress with processed/total counts  
- Maintains success/failure records for each document
- Uses dedicated teacher-routes API endpoint

**Data Validation**  
- Validates required teacher and school IDs  
- Normalizes coordinate formats with fallback values:
  - Teacher coordinates default to `[0, 0]` if invalid
  - School coordinates default to Malawi center point (`[35.3068, -15.3935]`) if invalid
- Type-safe conversion of all fields
- Default value handling for missing data
- Academic year auto-generation (current year to next year format)

**Teacher-Specific Features**
- Handles teacher-specific fields:
  - `teacherCode`
  - `specialization`
- Maintains all standard route fields:
  - Travel mode (default: 'walking')
  - Distance (3 decimal precision)
  - Duration (integer seconds)

**Error Handling**  
- Individual document validation errors don't fail entire batch  
- Detailed error reporting for failed documents  
- API timeout protection (30s)
- Clear error state management

### API Reference

#### Parameters

| Parameter | Type       | Required Fields     | Description                     |
|-----------|------------|---------------------|---------------------------------|
| `results` | `object[]` | `teacherId`, `schoolId` | Array of teacher route objects |


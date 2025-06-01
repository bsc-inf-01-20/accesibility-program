

### Overview
A custom React hook for creating student records in DHIS2 as Tracked Entity Instances (TEIs) with program enrollments. Handles student registration with all required attributes and coordinates.

### Features
- **Student Registration**:
  - Creates TEIs with core demographic attributes
  - Automatically enrolls students in specified program
  - Creates initial program stage event
  - Handles both array and text coordinate formats

- **Data Validation**:
  - Trims string values
  - Filters empty attributes
  - Validates mutation responses

- **Error Handling**:
  - Extracts meaningful error messages from conflicts
  - Provides clear success/failure states

### API Reference

### Parameters
| Parameter       | Type     | Required Fields           | Description |
|-----------------|----------|---------------------------|-------------|
| `studentData`  | `object` | `firstName`, `lastName`, `schoolId` | Student information |



### Overview
A custom React hook for managing student data in DHIS2. Designed specifically for SEMIS applications requiring student data management with geographic coordinates. Handles fetching and transforming tracked entity instances (students) from selected schools.

### Features
- **Student Data Fetching**:
  - Fetches student TEIs from specified organization units
  - Extracts and transforms student attributes (name, gender, birth date, etc.)
  - Handles both geometry-based and attribute-based coordinates

- **Data Transformation**:
  - Converts raw TEI data into structured student objects
  - Combines first/last name attributes into displayName
  - Normalizes coordinate data from multiple sources

- **State Management**:
  - Maintains local student data cache
  - Provides loading and error states
  - Supports local updates without refetching

### API Reference

### Returned Object
| Property            | Type                              | Description |
|---------------------|-----------------------------------|-------------|
| `students`          | `Student[]`                      | Array of formatted student objects |
| `loading`           | `boolean`                        | True when data is being fetched |
| `error`             | `Error \| null`                  | Contains error details if fetching fails |
| `programId`         | `string`                         | Current program ID being queried |
| `queryData`         | `object`                         | Raw query response from DHIS2 |

### Methods
| Method               | Parameters                       | Description |
|----------------------|----------------------------------|-------------|
| `fetchStudents`      | `(selectedSchools, program?)`    | Fetches students from selected schools |
| `setProgramId`       | `(programId: string)`            | Updates the program ID for queries |
| `refreshStudent`     | `(updatedStudent: Student)`      | Updates a single student in local state |
| `addNewStudent`      | `(newStudent: Student)`          | Adds a new student to local state |


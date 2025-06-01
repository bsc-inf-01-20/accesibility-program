
### Overview
A custom React hook for creating teacher records in DHIS2 as Tracked Entity Instances (TEIs) with program enrollments. Handles teacher registration with all required attributes and coordinates.

### Features

**Teacher Registration**
- Creates TEIs with core demographic attributes
- Automatically enrolls teachers in specified program
- Creates initial program stage event
- Handles both array and text coordinate formats

**Data Validation**
- Trims string values
- Filters empty attributes
- Validates mutation responses

**Error Handling**
- Extracts meaningful error messages from conflicts
- Provides clear success/failure states



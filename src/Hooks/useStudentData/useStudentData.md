

### Overview  
A custom React hook for fetching student data from DHIS2's tracker API. Handles data fetching, automatic refresh on orgUnit change, and provides refresh capabilities.

### Features

**Data Fetching**
- Uses DHIS2's `tracker/events` endpoint
- Automatically fetches when orgUnitId changes
- Supports manual refresh triggers
- Tracks refresh counts for change detection
- Implements lazy loading

**Field Selection**
- Fetches minimal required fields:
  - Event ID
  - Data values (dataElement + value pairs)
- Uses specific program ID (`fQ1OejfABCD`)
- Skips paging for complete dataset

**State Management**
- Tracks loading state
- Captures and formats error messages
- Returns empty array as default student data
- Maintains refresh counter for change tracking

### API Reference

#### Parameters

| Parameter | Type   | Required | Description                     |
|-----------|--------|----------|---------------------------------|
| `orgUnitId` | string | Yes      | Organization unit ID to filter students |

#### Return Values

| Property         | Type      | Description |
|------------------|-----------|-------------|
| `students`       | array     | Array of student events with data values |
| `loading`        | boolean   | True during data fetching |
| `error`          | string    | Error message if request fails |
| `refreshStudents`| function  | Manual refresh trigger |
| `refreshCount`   | number    | Counter tracking refreshes |


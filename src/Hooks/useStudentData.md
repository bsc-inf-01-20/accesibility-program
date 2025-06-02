

### Overview  
A React hook for fetching and managing student event data from DHIS2 tracker. Provides real-time data loading with refresh capabilities and organization unit tracking.

### Features

#### Data Fetching
- **Tracker API Integration**: Uses DHIS2 `/tracker/events` endpoint
- **Optimized Fields**: Requests only event IDs and data values
- **Program Specific**: Targets program ID `fQ1OejfABCD`
- **Lazy Loading**: Only fetches when orgUnitId is available

#### State Management
- **Auto-Refresh**: Automatically refetches when orgUnitId changes
- **Manual Refresh**: Exposes `refreshStudents` function
- **Progress Tracking**: Maintains `refreshCount` for dependent components

#### Error Handling
- Simplified error message extraction
- Loading state indicator

### API Reference

#### Parameters
| Parameter | Type     | Required | Default | Description |
|-----------|----------|----------|---------|-------------|
| `orgUnitId` | string  | Yes      | -       | Organization unit ID to filter events |

#### Return Value
```ts
{
  students: Array<{
    event: string,
    dataValues: Array<{
      dataElement: string,
      value: string
    }>
  }>,
  loading: boolean,
  error: string | null,
  refreshStudents: () => void,
  refreshCount: number
}
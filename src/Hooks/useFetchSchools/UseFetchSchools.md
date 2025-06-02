

### Overview
A custom React hook for managing DHIS2 organization unit hierarchy and school selection. Designed specifically for SEMIS applications requiring school selection with geographic data.

### Features
- **Hierarchical Data Fetching**:
  - Automatically loads org units by level (1-5)
  - Maintains parent-child relationships
  - Supports drilling down through ministry → province → district → etc.

- **School Management**:
  - Fetches all schools (level 5 org units)
  - Auto-selects all schools by default
  - Extracts and stores geographic coordinates

- **State Management**:
  - Tracks complete org unit tree
  - Manages selected hierarchy levels
  - Handles school filtering and selection
  - Provides loading/error states

### API Reference

#### Returned Object
| Property            | Type                              | Description |
|---------------------|-----------------------------------|-------------|
| `selectedLevels`    | `Record<number, string>`         | Mapping of level numbers to org unit IDs |
| `selectedLevelNames` | `Record<number, string>`        | Mapping of level numbers to org unit names |
| `allUnits`          | `OrganisationUnit[]`            | Complete list of fetched org units |
| `selectedSchools`   | `School[]`                      | Currently selected schools with coordinate data |
| `filteredSchools`   | `School[]`                      | All schools under current hierarchy |
| `loading`           | `boolean`                       | Combined loading state |
| `error`             | `Error \| null`                 | Current error state |
| `handleSelectLevel` | `(level: number, id: string) => void` | Updates selected level and fetches children |
| `fetchOrgUnits`     | `(level: number, parentId?: string) => void` | Direct org unit fetcher |
| `setSelectedSchools` | `React.Dispatch<React.SetStateAction<School[]>>` | Manual school selection setter |


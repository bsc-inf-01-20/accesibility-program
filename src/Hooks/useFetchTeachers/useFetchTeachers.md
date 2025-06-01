### useFetchTeachers

A custom React hook for fetching and managing teacher data in client-side state.

#### Capabilities:
- Fetches teachers from DHIS2 EMIS instance based on selected org units and program
- Maintains local cache of teacher data
- Provides state management for:
  - Loading states
  - Error handling
  - Program ID context

#### Local State Helpers (for use after external operations):
- `addNewTeacher()` - Adds a teacher to local state (after creation elsewhere)
- `refreshTeacher()` - Updates a teacher in local state (after update elsewhere)

Note: Does not directly perform create/update/delete DHIS2 operations - those should be handled separately then the local state updated using these helpers.
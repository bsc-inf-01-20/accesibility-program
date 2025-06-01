import React from 'react';
import { 
  InputField, 
  Button, 
  Menu, 
  MenuItem, 
  NoticeBox, 
  CircularLoader,
  Card 
} from '@dhis2/ui';

/**
 * SchoolSelector
 *
 * A searchable dropdown component for selecting schools with loading and error states.
 * Combines a search input with a dropdown menu that displays matching schools.
 *
 * @component
 * @example
 * return (
 *   <SchoolSelector
 *     schools={[
 *       { id: '1', name: 'Mzimba Secondary' },
 *       { id: '2', name: 'Lilongwe Academy' }
 *     ]}
 *     loading={false}
 *     error={null}
 *     searchTerm=""
 *     isDropdownOpen={true}
 *     onSearchChange={(term) => console.log('Search:', term)}
 *     onDropdownToggle={(open) => console.log('Dropdown:', open)}
 *     onSelectSchool={(school) => console.log('Selected:', school)}
 *   />
 * )
 *
 * @param {Object} props
 * @param {Array<Object>} [props.schools=[]] - Array of school objects to display
 * @param {string} props.schools[].id - Unique identifier for the school
 * @param {string} props.schools[].name - School name (fallback to displayName if not available)
 * @param {string} props.schools[].displayName - Alternative school name display
 * @param {boolean} props.loading - Whether schools are currently loading
 * @param {Object|null} props.error - Error object if loading failed
 * @param {string} props.searchTerm - Current search query
 * @param {boolean} props.isDropdownOpen - Whether the dropdown menu is visible
 * @param {Function} props.onSearchChange - Callback when search term changes
 * @param {Function} props.onDropdownToggle - Callback when dropdown visibility should change
 * @param {Function} props.onSelectSchool - Callback when a school is selected
 */
export const SchoolSelector = ({ 
  schools = [], 
  loading, 
  error, 
  searchTerm, 
  isDropdownOpen,
  onSearchChange, 
  onDropdownToggle,
  onSelectSchool 
}) => {
  return (
    <Card className="selection-card">
      <div className="school-selection-container">
        <div className="search-input-container">
          <InputField
            label="Search and select your school"
            placeholder="Type school name..."
            value={searchTerm}
            onChange={({ value }) => {
              onSearchChange(value);
              onDropdownToggle(true);
            }}
            onFocus={() => onDropdownToggle(true)}
            className="uniform-input"
          />
          <Button 
            className="dropdown-toggle"
            onClick={() => onDropdownToggle(!isDropdownOpen)}
            primary
          >
            {isDropdownOpen ? '▲' : '▼'}
          </Button>
        </div>
        
        {isDropdownOpen && (
          <div className="school-dropdown">
            {loading ? (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <CircularLoader small />
                <p>Loading schools...</p>
              </div>
            ) : error ? (
              <NoticeBox error title="Loading Error">
                {error.message || 'Failed to load schools'}
              </NoticeBox>
            ) : schools.length > 0 ? (
              <Menu>
                {schools.map(school => (
                  <MenuItem
                    key={school.id}
                    label={school.name || school.displayName}
                    onClick={() => onSelectSchool(school)}
                  />
                ))}
              </Menu>
            ) : (
              <NoticeBox>
                No schools match "{searchTerm}"
              </NoticeBox>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
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
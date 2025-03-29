import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  Menu, 
  MenuItem, 
  Button,
  CircularLoader,
  Help
} from '@dhis2/ui';
import './SchoolSelector.css';

export const SchoolSelector = ({ 
  selectedLevels = {},
  currentLevelUnits = [],
  loading = false,
  error = null,
  handleSelectLevel = () => console.error('handleSelectLevel not provided'),
  clearSelection = () => {}
}) => {
  const [expandedLevels, setExpandedLevels] = useState({});

  // Organize units by level and parent
  const { unitsByLevel, childUnitsMap } = useMemo(() => {
    const result = { unitsByLevel: {}, childUnitsMap: {} };

    currentLevelUnits.forEach(unit => {
      if (!unit) return;

      // Group by level
      if (!result.unitsByLevel[unit.level]) {
        result.unitsByLevel[unit.level] = [];
      }
      result.unitsByLevel[unit.level].push(unit);

      // Map children to parents
      if (unit.parent?.id) {
        result.childUnitsMap[unit.parent.id] = [
          ...(result.childUnitsMap[unit.parent.id] || []),
          unit
        ];
      }
    });

    return result;
  }, [currentLevelUnits]);

  // Toggle expansion
  const toggleLevel = (level) => {
    setExpandedLevels(prev => ({ ...prev, [level]: !prev[level] }));
  };

  // Handle selection
  const handleSelect = (level, id) => {
    handleSelectLevel(level, id);
    if (level < 4) toggleLevel(id);
  };

  return (
    <div className="school-selector">
      {[2, 3, 4].map(level => (
        <div key={level} className="level-container">
          <h4>Level {level}</h4>
          
          {loading ? (
            <CircularLoader small />
          ) : error ? (
            <Help error>Load failed</Help>
          ) : (
            <Menu>
              {(unitsByLevel[level] || []).map(unit => (
                <React.Fragment key={unit.id}>
                  <MenuItem
                    label={unit.displayName}
                    active={selectedLevels[level] === unit.id}
                    onClick={() => handleSelect(level, unit.id)}
                    icon={
                      level < 4 && (childUnitsMap[unit.id]?.length > 0) ? 
                      (expandedLevels[unit.id] ? '▼' : '▶') : null
                    }
                  />
                  
                  {level < 4 && expandedLevels[unit.id] && (
                    <div className="child-units">
                      {(childUnitsMap[unit.id] || []).map(child => (
                        <MenuItem
                          key={child.id}
                          label={child.displayName}
                          active={selectedLevels[level+1] === child.id}
                          onClick={() => handleSelect(level+1, child.id)}
                          inset
                        />
                      ))}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </Menu>
          )}

          {selectedLevels[level] && (
            <Button 
              small 
              destructive 
              onClick={() => clearSelection(level)}
            >
              Clear
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

SchoolSelector.propTypes = {
  selectedLevels: PropTypes.object.isRequired,
  currentLevelUnits: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.object,
  handleSelectLevel: PropTypes.func.isRequired,
  clearSelection: PropTypes.func.isRequired
};
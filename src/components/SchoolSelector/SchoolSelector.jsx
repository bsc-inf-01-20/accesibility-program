import React, { useState, useEffect, useMemo } from 'react';
import './SchoolSelector.css';

export function SchoolSelector({ 
  selectedLevels,
  allUnits = [],
  loading,
  error,
  handleSelectLevel,
  fetchOrgUnits
}) {
  const [expandedItems, setExpandedItems] = useState({});
  const [isOpen, setIsOpen] = useState(false);

  // Toggle dropdown visibility
  const toggleDropdown = (e) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  // Safe hierarchy building
  const hierarchy = useMemo(() => {
    const getChildren = (parentId, level) => 
      (allUnits || []).filter(u => 
        u?.level === level && 
        u.parent?.id === parentId
      );

    try {
      return getChildren(selectedLevels[1], 2).map(division => ({
        ...division,
        districts: getChildren(division?.id, 3).map(district => ({
          ...district,
          zones: getChildren(district?.id, 4).map(zone => ({
            ...zone,
            schools: getChildren(zone?.id, 5)
          }))
        }))
      }));
    } catch (error) {
      console.error("Hierarchy building failed:", error);
      return [];
    }
  }, [allUnits, selectedLevels]);

  // Auto-expand logic
  useEffect(() => {
    const newExpanded = {...expandedItems};
    let changed = false;

    // Auto-expand parents when children exist
    const levelsToCheck = [
      { level: 2, childLevel: 3 },
      { level: 3, childLevel: 4 },
      { level: 4, childLevel: 5 }
    ];

    levelsToCheck.forEach(({ level, childLevel }) => {
      const parentId = selectedLevels[level];
      if (parentId && (allUnits || []).some(u => 
        u.level === childLevel && 
        u.parent?.id === parentId
      )) {
        if (!newExpanded[parentId]) {
          newExpanded[parentId] = true;
          changed = true;
        }
      }
    });

    if (changed) setExpandedItems(newExpanded);
  }, [allUnits, selectedLevels]);

  const handleSelect = (level, id, e) => {
    e.stopPropagation();
    
    // Handle school selection (level 5)
    if (level === 5) {
      setIsOpen(false);
      return handleSelectLevel(level, id);
    }

    // Toggle expansion for non-school levels
    const shouldExpand = !expandedItems[id];
    setExpandedItems(prev => ({ ...prev, [id]: shouldExpand }));

    // Fetch next level if needed
    if (shouldExpand && level < 5) {
      handleSelectLevel(level, id);
    }
  };

  const getSelectedText = () => {
    const getDisplayName = (level) => 
      (allUnits || []).find(u => u.id === selectedLevels[level])?.displayName;

    return getDisplayName(5) || 
           getDisplayName(4) || 
           getDisplayName(3) || 
           getDisplayName(2) || 
           'Select division';
  };

  const renderTree = (items, level) => (items || []).map(item => (
    <div key={item.id}>
      <div 
        className={`dropdown-item level-${level} ${selectedLevels[level] === item.id ? 'selected' : ''}`}
        onClick={(e) => handleSelect(level, item.id, e)}
      >
        <span className="expand-arrow">
          {(item.districts?.length || item.zones?.length || item.schools?.length) ? 
            (expandedItems[item.id] ? '▼' : '▶') : ' '}
        </span>
        {item.displayName}
      </div>
      
      {expandedItems[item.id] && (
        <div className="dropdown-children">
          {item.districts?.length > 0 && renderTree(item.districts, 3)}
          {item.zones?.length > 0 && renderTree(item.zones, 4)}
          {item.schools?.length > 0 && renderTree(item.schools, 5)}
        </div>
      )}
    </div>
  ));

  return (
    <div className="school-selector-container">
      <div className="selector-header" onClick={toggleDropdown}>
        {getSelectedText()}
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          {loading && <div className="dropdown-loading">Loading data...</div>}
          {error && (
            <div className="dropdown-error">
              {error}
              <button 
                onClick={() => fetchOrgUnits(2, "U7ahfMlCl7k")} 
                className="refresh-button"
              >
                Retry
              </button>
            </div>
          )}
          
          {!loading && !error && (hierarchy || []).length === 0 && (
            <div className="dropdown-empty">
              No data found
              <button 
                onClick={() => fetchOrgUnits(2, "U7ahfMlCl7k")} 
                className="refresh-button"
              >
                Refresh
              </button>
            </div>
          )}

          {renderTree(hierarchy, 2)}
        </div>
      )}
    </div>
  );
}
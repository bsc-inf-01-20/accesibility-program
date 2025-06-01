import React, { useState, useEffect, useMemo } from 'react';
import './SchoolSelector.css';

/**
 * @typedef {Object} OrgUnit
 * @property {string} id - Unique identifier for the org unit.
 * @property {string} displayName - Display name of the org unit.
 * @property {number} level - Hierarchical level (2=Division, 3=District, 4=Zone, 5=School).
 * @property {{ id: string }} [parent] - Parent org unit reference.
 * @property {Object} [geometry] - Optional GeoJSON geometry for spatial data.
 */

/**
 * Dropdown selector component for hierarchical school selection (Division → District → Zone → School).
 *
 * @component
 * @param {Object} props
 * @param {Object} props.selectedLevels - Mapping of selected org unit IDs by level (e.g. { 2: 'divId', 3: 'distId', ... }).
 * @param {OrgUnit[]} props.allUnits - List of all organization units available.
 * @param {boolean} props.loading - Whether the org units are currently loading.
 * @param {string} [props.error] - Error message if loading failed.
 * @param {(level: number, id: string) => void} props.handleSelectLevel - Callback when a level is selected.
 * @param {(level: number, rootId: string) => void} props.fetchOrgUnits - Callback to fetch org units.
 * @param {(schools: { id: string, name: string, geometry: any }[]) => void} props.setSelectedSchools - Callback to set selected schools.
 */
export function SchoolSelector({
  selectedLevels,
  allUnits = [],
  loading,
  error,
  handleSelectLevel,
  fetchOrgUnits,
  setSelectedSchools
}) {
  const [expandedItems, setExpandedItems] = useState({});
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Toggles the dropdown menu open or closed.
   * @param {React.MouseEvent} e
   */
  const toggleDropdown = (e) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  /**
   * Memoized org unit hierarchy based on selected division.
   */
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

  /**
   * Auto-expand next levels if children exist.
   */
  useEffect(() => {
    const newExpanded = { ...expandedItems };
    let changed = false;

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

  /**
   * Handles the selection of an org unit.
   * @param {number} level - The level being selected.
   * @param {string} id - The ID of the selected org unit.
   * @param {React.MouseEvent} e
   */
  const handleSelect = (level, id, e) => {
    e.stopPropagation();

    if (level === 5) {
      const selected = allUnits.find(u => u.id === id);
      setSelectedSchools([{
        id,
        name: selected?.displayName,
        geometry: selected?.geometry
      }]);
      setIsOpen(false);
    } else {
      setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
    }

    handleSelectLevel(level, id);
  };

  /**
   * Gets the current selection label for the dropdown.
   * @returns {string}
   */
  const getSelectedText = () => {
    const getDisplayName = (level) =>
      (allUnits || []).find(u => u.id === selectedLevels[level])?.displayName;

    return getDisplayName(5) ||
      getDisplayName(4) ||
      getDisplayName(3) ||
      getDisplayName(2) ||
      'Select division';
  };

  /**
   * Renders the recursive tree view of org units.
   * @param {OrgUnit[]} items - List of org units to render.
   * @param {number} level - Current level.
   * @returns {JSX.Element[]}
   */
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

import React from 'react';
import { Button } from '@dhis2/ui';

/**
 * SchoolBanner
 *
 * A banner component that displays the currently selected school
 * with an option to change/reset the selection.
 *
 * @component
 * @example
 * return (
 *   <SchoolBanner
 *     school={{ displayName: "Mzimba Secondary School" }}
 *     onResetSchool={() => console.log('School selection reset')}
 *   />
 * )
 *
 * @param {Object} props
 * @param {Object} props.school - The currently selected school object
 * @param {string} props.school.displayName - The display name of the school
 * @param {Function} props.onResetSchool - Callback when the change school button is clicked
 */
export const SchoolBanner = ({ school, onResetSchool }) => (
  <div className="school-banner">
    <div className="school-banner-content">
      <div className="school-info">
        <span className="school-label">Selected School:</span>
        <span className="school-name">{school.displayName}</span>
      </div>
      <Button 
        onClick={onResetSchool}
        className="change-school-button"
      >
        Change School
      </Button>
    </div>
  </div>
);
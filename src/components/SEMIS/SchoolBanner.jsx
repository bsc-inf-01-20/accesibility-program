import React from 'react';
import { Button } from '@dhis2/ui';

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
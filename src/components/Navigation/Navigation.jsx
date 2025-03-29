import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '@dhis2/ui';
import './Navigation.css'; // Using your existing CSS file

export const Navigation = () => {
  return (
    <nav className="navigation-container">
      <div className="nav-brand">
        <h2>DHIS2 Geo Tools</h2>
      </div>
      
      <div className="nav-links">
        <Button 
          component={NavLink}
          to="/"
          className={({ isActive }) => 
            `nav-button ${isActive ? 'active' : ''}`
          }
        >
          Place Finder
        </Button>
        
        <Button 
          component={NavLink}
          to="/schools"
          className={({ isActive }) => 
            `nav-button ${isActive ? 'active' : ''}`
          }
        >
          School Finder
        </Button>
      </div>
    </nav>
  );
};
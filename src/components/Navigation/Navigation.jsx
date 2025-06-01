import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navigation.css';

/**
 * Navigation
 *
 * A collapsible sidebar navigation component for the Accessibility Program dashboard.
 * Includes links to major sections like proximity analysis, registration, and settings.
 *
 * @component
 * @example
 * return (
 *   <Navigation collapsed={false} onCollapseToggle={() => console.log("Toggle")} />
 * )
 *
 * @param {Object} props
 * @param {boolean} props.collapsed - Determines if the sidebar is collapsed.
 * @param {() => void} props.onCollapseToggle - Callback function for toggling collapse state.
 */
export const Navigation = ({ collapsed, onCollapseToggle }) => {
  const menuItems = [
    { 
      path: "/", 
      label: "Proximity Analyzer", 
      icon: "📍", 
      title: "School proximity analysis dashboard"
    },
    { 
      path: "/registration", 
      label: "Registration", 
      icon: "📝", 
      title: "Student registration portal"
    },
    { 
      path: "/StudentDistanceCalculator", 
      label: "Student Routes", 
      icon: "🚶", 
      title: "Calculate student travel distances"
    },
    { 
      path: "/TeacherDistanceCalculator", 
      label: "Teacher Routes", 
      icon: "🚗", 
      title: "Calculate teacher travel distances"
    },
    { 
      path: "/settings", 
      label: "Settings", 
      icon: "⚙️",
      title: "Application settings"
    }
  ];

  return (
    <nav 
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        {!collapsed && <h1 className="sidebar-title">Accessibility Program</h1>}
        <button 
          onClick={onCollapseToggle}
          className="collapse-btn"
          aria-expanded={!collapsed}
          aria-controls="menu-items"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
      
      <ul id="menu-items" className="menu-items">
        {menuItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) => 
                `menu-item ${isActive ? 'active' : ''}`
              }
              title={item.title}
              end
            >
              <span className="menu-item-icon" aria-hidden="true">{item.icon}</span>
              {!collapsed && (
                <span className="menu-item-label">
                  {item.label}
                  {item.path === "/StudentDistanceCalculator" && (
                    <span className="badge"></span>
                  )}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

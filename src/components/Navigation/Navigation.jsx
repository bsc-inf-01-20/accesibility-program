import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navigation.css';

export const Navigation = ({ collapsed, onCollapseToggle }) => {
  const menuItems = [
    { path: "/", label: "Place Finder", icon: "📍" },
    { path: "/schools", label: "School Finder", icon: "🏫" },
    { path: "/reports", label: "Reports", icon: "📊" },
    { path: "/settings", label: "Settings", icon: "⚙️" }
  ];

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <h3>DHIS2-Accesibility</h3>}
        <button 
          onClick={onCollapseToggle}
          className="collapse-btn"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '☰' : '☰'}
        </button>
      </div>
      
      <div className="menu-items">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `menu-item ${isActive ? 'active' : ''}`
            }
            title={collapsed ? item.label : ''} // Tooltip when collapsed
          >
            <span className="menu-item-icon">{item.icon}</span>
            {!collapsed && <span className="menu-item-label">{item.label}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation/Navigation';
import ClosestPlaceFinder from './pages/ClosestPlaceFinder';
import SEMISRegistration from './pages/SEMISRegistration'; // Updated import
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import styles from './App.module.css';

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile !== isMobile) {
        setCollapsed(mobile);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  const sidebarWidth = collapsed ? '60px' : '240px';

  return (
    <Router>
      <div className={styles.appContainer}>
        <Navigation 
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed(!collapsed)}
        />
        
        <main 
          className={styles.mainContent} 
          style={{ 
            marginLeft: sidebarWidth,
            transition: 'margin-left 0.3s ease'
          }}
        >
          <div className={styles.contentWrapper}>
            <Routes>
              <Route path="/" element={<ClosestPlaceFinder />} />
              <Route path="/registration" element={<SEMISRegistration />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider } from '@dhis2/app-runtime';
import { Navigation } from './components/Navigation/Navigation';
import ClosestPlaceFinder from './pages/ClosestPlaceFinder';
import SEMISRegistration from './pages/SEMISRegistration';
import StudentDistanceCalculator from './pages/StudentDistanceCalculator';
import Settings from './pages/Settings';
import styles from './App.module.css';
import TeacherDistanceCalculator from './pages/TeacherDistanceCalculator';

const dhis2Config = {
  baseUrl: 'https://project.ccdev.org/emis',
  apiVersion: 40
};

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
    <DataProvider config={dhis2Config}>
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
                <Route path="/settings" element={<Settings />} />
                <Route path="/StudentDistanceCalculator" element={<StudentDistanceCalculator />} />
                <Route path="/TeacherDistanceCalculator" element={<TeacherDistanceCalculator />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </DataProvider>
  );
};

export default App;
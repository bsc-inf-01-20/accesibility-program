import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation/Navigation';
import ClosestPlaceFinder from './pages/ClosestPlaceFinder';
import SchoolsFinder from './pages/SchoolsFinder';
import styles from './App.module.css';

const App = () => {
  return (
    <Router>
      <div className={styles.container}>
        <Navigation />
        <Routes>
          <Route path="/" element={<ClosestPlaceFinder />} />
          <Route path="/schools" element={<SchoolsFinder />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
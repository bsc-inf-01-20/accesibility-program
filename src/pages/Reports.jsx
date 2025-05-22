 import React from 'react';
import SummarySection from '../reportUi/dashboard/SummarySection';
import DistanceChart from '../reportUi/dashboard/DistanceChart';
import Filters from '../reportUi/dashboard/Filters';
import AmenityTable from '../reportUi/dashboard/AmenityTable';
import './Reports.css'
// import React, { useEffect, useState } from "react";
// import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
// import { Card, CardContent } from "@/components/ui/card";
// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
// import axios from "axios";

import './Reports.css'; // Import the external CSS

const Reports = () => {
  return (
    <div className='reports-container'>
      <h1 className='dashboard-title'>Route Analytic Dashboard</h1>
      <SummarySection />
      <div className='dashboard-grid'>
        <DistanceChart />
        <Filters />
      </div>
      <AmenityTable />
    </div>
  );
};

export default Reports;

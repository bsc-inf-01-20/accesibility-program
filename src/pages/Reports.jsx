import React from 'react';
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";

const Reports = () => {
  return (
    <div className="page-container">
      <h1>Reports</h1>
      <p>const Dashboard = () ={'>'} 
  const [schoolLocations, setSchoolLocations] = useState([]);
  const [pupilResidences, setPupilResidences] = useState([]);
  const [teacherResidences, setTeacherResidences] = useState([]);
  const [transportData, setTransportData] = useState([]);
  const [analyticsData, setAnalyticsData] = useState([]); 

  useEffect(() ={'>'} {
    // Replace these with actual DHIS2 API endpoints or mock data for now
    fetchData("/api/schools", setSchoolLocations)}
    fetchData("/api/pupils", setPupilResidences);
    fetchData("/api/teachers", setTeacherResidences);
    fetchData("/api/transport", setTransportData);
    fetchData("/api/analytics", setAnalyticsData);
  {'}'}, []); 

  const fetchData = async (url, setter) ={'>'} 
    try 
      const res = await axios.get(url);
      setter(res.data);
    {'}'} catch (error) {
      console.error("Error fetching ", url)};
    {'}'}
  {'}'};

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold">DHIS2 Public Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">GIS Overview</h2>
            <MapContainer center={[-13.9626, 33.7741]} zoom={12} className="h-96 w-full rounded-2xl">
              <TileLayer
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {[...schoolLocations, ...pupilResidences, ...teacherResidences].map((loc, idx) => (
                <Marker key={idx} position={[loc.lat, loc.lng]}>
                  <Popup>{loc.name}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">Transportation Routes</h2>
            <ul className="list-disc ml-5">
              {transportData.map((route, idx) => (
                <li key={idx}>{route.routeName} - {route.status}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <h2 className="text-xl font-semibold mb-4">Analytics: Pupils vs Teachers</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData}>
              <XAxis dataKey="location" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="pupils" fill="#8884d8" />
              <Bar dataKey="teachers" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
{'}'};

export default Dashboard;
</p>
    </div>
  );
};

export default Reports ;

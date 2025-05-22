import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '../ui/card';
import './dashboard.css'; // Import external CSS

const data = [
  { range: '0–500m', routes: 2 },
  { range: '501m–1km', routes: 6 },
  { range: '1.1km–2km', routes: 4 },
  { range: '2.1km–5km', routes: 2 },
  { range: '3.1km–10km', routes: 1 },
  { range: '10km–20km', routes: 1 },
  { range: '20km+', routes: 1 },
];

export default function DistanceChart() {
  return (
    <Card className="distance-chart-card">
      <CardContent>
        <h2 className="distance-chart-title">Distance Distribution</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="routes" fill="#0f766e" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { Card, CardContent } from '../ui/card';
import './dashboard.css'; // Import external stylesheet

const summaryData = [
  { label: 'Total Routes', value: '12' },
  { label: 'Total Distance', value: '78,2 km' },
  { label: 'Average Distance', value: '6,5 km' },
  { label: 'Schools with Hospitals Nearby', value: '5' },
];

export default function SummarySection() {
  return (
    <div className="summary-grid">
      {summaryData.map((item) => (
        <Card key={item.label} className="summary-card">
          <CardContent>
            <div className="summary-label">{item.label}</div>
            <div className="summary-value">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import React from 'react';
import { Card, CardContent } from '../ui/card';
import './dashboard.css'; // Import external CSS

const amenities = [
  { name: 'Hospital', routes: 5, percent: '42%' },
  { name: 'Market', routes: 4, percent: '33%' },
];

export default function AmenityTable() {
  return (
    <Card>
      <CardContent>
        <h2 className="amenity-heading">Amenity Accessibility</h2>
        <table className="amenity-table">
          <thead>
            <tr className="table-row-header">
              <th className="table-cell">Amenity</th>
              <th className="table-cell">Routes</th>
              <th className="table-cell">Percentage</th>
            </tr>
          </thead>
          <tbody>
            {amenities.map((a) => (
              <tr key={a.name} className="table-row-body">
                <td className="table-cell">{a.name}</td>
                <td className="table-cell">{a.routes}</td>
                <td className="table-cell">{a.percent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

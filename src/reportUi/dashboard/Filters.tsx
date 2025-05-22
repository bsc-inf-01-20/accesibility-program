import React from 'react';
import { Card, CardContent } from '../ui/card';
import './dashboard.css'; // Link to external CSS file

export default function Filters() {
  return (
    <Card>
      <CardContent>
        <h2 className="filters-heading">Filters</h2>
        <div className="filters-group">
          <div>
            <label className="filters-label">Amenity Type</label>
            <select className="filters-select">
              <option>All</option>
              <option>Hospital</option>
              <option>Market</option>
            </select>
          </div>
          <div>
            <label className="filters-label">Max Distance</label>
            <select className="filters-select">
              <option>20 km</option>
              <option>10 km</option>
              <option>5 km</option>
            </select>
          </div>
          <div>
            <label className="filters-label">Travel Mode</label>
            <select className="filters-select">
              <option>All</option>
              <option>Walking</option>
              <option>Driving</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import React, { useMemo } from 'react';
import { Modal, ModalTitle, ModalContent, ModalActions, Button } from '@dhis2/ui';
import { Map, Source, Layer, Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = "pk.eyJ1IjoiZmFyZ28yMTkiLCJhIjoiY205Y25xajJxMHJlbzJpc2M4bjhhdm9hZCJ9.xhoZP4Gr0_3yo6N9EBnD_w";

const decodePolyline = (encoded) => {
  if (!encoded) return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;
  
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat * 1e-5, lng * 1e-5]);
  }
  
  return points;
};

export const MapboxRouteViewer = ({ result, onClose }) => {
  // Safely get coordinates from different possible locations in result object
  const startCoords = result?.route?.startLocation || 
                     result?.rawData?.schoolCoords && {
                       lng: result.rawData.schoolCoords[0],
                       lat: result.rawData.schoolCoords[1]
                     };

  const endCoords = result?.route?.endLocation || 
                   result?.rawData?.placeCoords && {
                     lng: result.rawData.placeCoords[0],
                     lat: result.rawData.placeCoords[1]
                   };

  const routeGeoJSON = useMemo(() => {
    if (!result?.route?.polyline) {
      // Fallback to straight line if no polyline
      if (!startCoords || !endCoords) return null;
      return {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [startCoords.lng, startCoords.lat],
            [endCoords.lng, endCoords.lat]
          ]
        }
      };
    }

    const coordinates = decodePolyline(result.route.polyline);
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map(coord => [coord[1], coord[0]]) // [lng, lat]
      }
    };
  }, [result, startCoords, endCoords]);

  if (!result || !startCoords || !endCoords) {
    return (
      <Modal open large onClose={onClose}>
        <ModalTitle>Route Information</ModalTitle>
        <ModalContent>
          <div style={{ padding: '16px', color: 'red' }}>
            Could not display map: Missing required coordinates
          </div>
        </ModalContent>
        <ModalActions>
          <Button onClick={onClose}>Close</Button>
        </ModalActions>
      </Modal>
    );
  }

  return (
    <Modal open large onClose={onClose}>
      <ModalTitle>
        Route from {result.school} to {result.place}
      </ModalTitle>
      <ModalContent>
        <div style={{ height: '500px', width: '100%', borderRadius: '4px', overflow: 'hidden' }}>
          <Map
            initialViewState={{
              longitude: startCoords.lng,
              latitude: startCoords.lat,
              zoom: 13
            }}
            mapStyle="mapbox://styles/mapbox/streets-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            <Marker longitude={startCoords.lng} latitude={startCoords.lat}>
              <div style={{ 
                background: '#2C6693',
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid white'
              }} />
            </Marker>

            <Marker longitude={endCoords.lng} latitude={endCoords.lat}>
              <div style={{ 
                background: '#E04A32',
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid white'
              }} />
            </Marker>

            {routeGeoJSON && (
              <Source id="route" type="geojson" data={routeGeoJSON}>
                <Layer
                  id="route"
                  type="line"
                  paint={{
                    'line-color': '#3b82f6',
                    'line-width': 4,
                    'line-opacity': 0.7
                  }}
                />
              </Source>
            )}
          </Map>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div><strong>Distance:</strong> {result.distance} km</div>
          <div><strong>Time:</strong> {result.time}</div>
        </div>
      </ModalContent>
      <ModalActions>
        <Button onClick={onClose}>Close</Button>
      </ModalActions>
    </Modal>
  );
};
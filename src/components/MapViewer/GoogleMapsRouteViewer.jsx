import React from 'react';
import { Modal, ModalTitle, ModalContent, ModalActions, Button } from '@dhis2/ui';
import { GoogleMap, Polyline, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '4px',
  overflow: 'hidden'
};

// Same decode function you've been using
const decodePolyline = (encoded) => {
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

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  
  return points;
};

const GoogleMapsRouteViewer = ({ result, onClose }) => {
  const [map, setMap] = React.useState(null);
  const [path, setPath] = React.useState([]);

  React.useEffect(() => {
    if (result?.route?.polyline) {
      setPath(decodePolyline(result.route.polyline));
    }
  }, [result]);

  if (!result || !result.route) return null;

  return (
    <Modal open large onClose={onClose}>
      <ModalTitle>
        Route from {result.school} to {result.place}
      </ModalTitle>
      <ModalContent>
        <div style={containerStyle}>
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={{
              lat: result.route.startLocation.lat,
              lng: result.route.startLocation.lng
            }}
            zoom={14}
            onLoad={map => setMap(map)}
          >
            <Polyline
              path={path}
              options={{
                strokeColor: "#3b82f6",
                strokeOpacity: 0.7,
                strokeWeight: 5
              }}
            />
            <Marker 
              position={{
                lat: result.route.startLocation.lat,
                lng: result.route.startLocation.lng
              }}
              label={result.school}
            />
            <Marker 
              position={{
                lat: result.route.endLocation.lat,
                lng: result.route.endLocation.lng
              }}
              label={result.place}
            />
          </GoogleMap>
        </div>
        <div style={{ marginTop: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
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

export default GoogleMapsRouteViewer;
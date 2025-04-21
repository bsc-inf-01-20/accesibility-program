import React, { useRef, useEffect, useState } from 'react';
import { Button, Modal, ModalTitle, ModalContent, ModalActions } from '@dhis2/ui';
import useLeafletMap from '../../Hooks/useLeafletMap';
import './MapViewer.css';

export const MapViewer = ({ result, onClose }) => {
  const mapContainerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useLeafletMap(mapContainerRef, isReady ? [result] : []);

  if (!result) return null;

  return (
    <Modal open large onClose={onClose}>
      <ModalTitle>
        Route from {result.school} to {result.place}
      </ModalTitle>
      <ModalContent>
        <div
          ref={mapContainerRef}
          className="map-container"
        />
        <div className="route-details">
          <div><strong>School:</strong> {result.school}</div>
          <div><strong>Amenity:</strong> {result.place}</div>
          <div><strong>Distance:</strong> {result.distance} km</div>
          <div><strong>Travel time:</strong> {result.time}</div>
        </div>
      </ModalContent>
      <ModalActions>
        <Button onClick={onClose}>Close</Button>
      </ModalActions>
    </Modal>
  );
};
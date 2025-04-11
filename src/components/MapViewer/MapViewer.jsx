import React, { useRef, useEffect, useState } from 'react';
import { Button, Modal, ModalTitle, ModalContent, ModalActions } from '@dhis2/ui';
import useLeafletMap from '../../Hooks/useLeafletMap';
import './MapViewer.css';

export const MapViewer = ({ result, onClose, allResults }) => {
  const mapContainerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const resultsToUse = allResults || (result ? [result] : []);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useLeafletMap(mapContainerRef, isReady ? resultsToUse : []);

  if (!result && !allResults) return null;

  return (
    <Modal open large onClose={onClose}>
      <ModalTitle>
        {allResults
          ? 'All Schools and Amenities'
          : `Route from ${result.school} to ${result.place}`}
      </ModalTitle>
      <ModalContent>
        <div
          ref={mapContainerRef}
          style={{
            height: '500px',
            width: '100%',
            borderRadius: '4px',
            zIndex: 0,
          }}
        />
        {!allResults && (
          <div style={{ marginTop: '16px' }}>
            <strong>Distance:</strong> {result.distance} km<br />
            <strong>Travel time:</strong> {result.time}
          </div>
        )}
      </ModalContent>
      <ModalActions>
        <Button onClick={onClose}>Close</Button>
      </ModalActions>
    </Modal>
  );
};
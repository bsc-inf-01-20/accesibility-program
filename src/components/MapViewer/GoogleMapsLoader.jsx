import React, { useEffect, useState } from 'react';
import { AlertBar, Button } from '@dhis2/ui';

const GoogleMapsLoader = ({ children, onLoad }) => {
  const [status, setStatus] = useState('loading');
  const [retryCount, setRetryCount] = useState(0);

  const loadGoogleMaps = () => {
    // Remove any existing script
    const oldScript = document.getElementById('google-maps-script');
    if (oldScript) document.head.removeChild(oldScript);

    // Create new script
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBEQn6cZ10o8NEwd2ImErozWwCWF1miysA&loading=async&libraries=places,marker&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setStatus('error');

    // Global callback
    window.initGoogleMaps = async () => {
      try {
        // Dynamically import directions library after core maps loads
        await google.maps.importLibrary("routes");
        await google.maps.importLibrary("geometry");
        setStatus('ready');
        onLoad?.();
      } catch (err) {
        console.error('Failed to load additional libraries:', err);
        setStatus('error');
      } finally {
        delete window.initGoogleMaps;
      }
    };

    document.head.appendChild(script);
  };

  useEffect(() => {
    if (window.google?.maps?.importLibrary) {
      // If Google Maps is already loaded but we need to check libraries
      const checkLibraries = async () => {
        try {
          await Promise.all([
            google.maps.importLibrary("maps"),
            google.maps.importLibrary("routes"),
            google.maps.importLibrary("marker"),
            google.maps.importLibrary("geometry")
          ]);
          setStatus('ready');
          onLoad?.();
        } catch (err) {
          console.error('Missing required libraries:', err);
          setStatus('error');
        }
      };
      checkLibraries();
      return;
    }

    loadGoogleMaps();

    return () => {
      const script = document.getElementById('google-maps-script');
      if (script) document.head.removeChild(script);
      delete window.initGoogleMaps;
    };
  }, [retryCount, onLoad]);

  if (status === 'error') {
    return (
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <AlertBar critical>
          Failed to load Google Maps. Please check your connection.
        </AlertBar>
        <Button 
          onClick={() => {
            setStatus('loading');
            setRetryCount(prev => prev + 1);
          }}
          style={{ marginTop: '16px' }}
        >
          Retry Loading Map
        </Button>
      </div>
    );
  }

  if (status === 'loading') {
    return <div style={{ padding: '16px', textAlign: 'center' }}>Loading map...</div>;
  }

  return children;
};

export default GoogleMapsLoader;
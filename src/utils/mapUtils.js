import L from 'leaflet';

/**
 * Decodes a polyline string into an array of latitude/longitude coordinates
 * @param {string} encoded - The encoded polyline string
 * @returns {Array<[number, number]>} Array of [lat, lng] tuples
 */
export const decodePolyline = (encoded) => {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  
  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    
    // Latitude decoding
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0;
    result = 0;
    
    // Longitude decoding
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    
    coordinates.push([lat * 1e-5, lng * 1e-5]);
  }
  
  return coordinates;
};

/**
 * Configures Leaflet's default marker icons to work with module bundlers
 * Fixes the common issue where marker icons don't load properly in webpack/vite
 */
export const setupLeafletIcons = () => {
  try {
    // Get URLs for the marker icons using import.meta.url
    const markerIcon2x = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href;
    const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
    const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

    // Remove the default icon URL detection
    delete L.Icon.Default.prototype._getIconUrl;

    // Configure the default icon options
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
      iconSize: [25, 41],        // Size of the icon
      iconAnchor: [12, 41],      // Point of the icon which will correspond to marker's location
      popupAnchor: [1, -34],     // Point from which the popup should open relative to the iconAnchor
      tooltipAnchor: [16, -28],  // Point from which tooltips should open
      shadowSize: [41, 41]       // Size of the shadow image
    });
  } catch (error) {
    console.error('Failed to setup Leaflet icons:', error);
    throw new Error('Leaflet icon setup failed. Please ensure leaflet package is properly installed.');
  }
};

/**
 * Helper function to create a Leaflet marker with consistent styling
 * @param {L.Map} map - Leaflet map instance
 * @param {[number, number]} position - [lat, lng] coordinates
 * @param {string} title - Marker title
 * @param {string} popupContent - HTML content for the popup
 * @returns {L.Marker} Configured Leaflet marker
 */
export const createMarker = (position, title, popupContent) => {
  return L.marker(position, {
    title: title,
    icon: new L.Icon.Default() // Uses the configured default icon
  }).bindPopup(popupContent);
};
const { VALID_TRAVEL_MODES } = require('../config/constants');

exports.validateCoordinates = (lat, lng) => {
  return lat && lng && !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
};

exports.sanitizeInput = (input) => {
  return input.toString().replace(/[^\w\s-]/g, '');
};

exports.validateDirectionsResponse = (data) => {
  if (!data.routes?.[0]?.legs?.[0]) {
    throw new Error('Invalid route structure from Google API');
  }
  if (!data.routes[0].overview_polyline?.points) {
    throw new Error('Missing overview polyline data');
  }
};

exports.validateTravelMode = (mode) => {
  if (!VALID_TRAVEL_MODES.includes(mode)) {
    throw new Error(`Invalid travel mode. Valid modes are: ${VALID_TRAVEL_MODES.join(', ')}`);
  }
};
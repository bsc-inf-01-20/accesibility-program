const GoogleMapsService = require('../services/googleMapsService');
const { 
  validateCoordinates, 
  sanitizeInput 
} = require('../services/validationService');
const { DEFAULT_RADIUS } = require('../config/constants');

exports.search = async (req, res) => {
  try {
    const { lat, lng, type, query, radius = DEFAULT_RADIUS } = req.query;

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        received: { lat, lng }
      });
    }

    const data = await GoogleMapsService.searchPlaces({
      type: type && sanitizeInput(type),
      query: query && sanitizeInput(query),
      location: `${lat},${lng}`,
      radius
    });

    if (data.status !== 'OK') {
      return res.status(400).json({
        error: data.error_message || 'Google Places API error',
        status: data.status
      });
    }

    res.json({
      status: 'OK',
      results: (data.results || []).map(place => ({
        id: place.place_id,
        name: place.name,
        location: place.geometry?.location,
        address: place.vicinity,
        types: place.types,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total
      }))
    });

  } catch (err) {
    console.error('Places Search Error:', err);
    res.status(500).json({
      error: 'Failed to search places',
      details: err.message
    });
  }
};
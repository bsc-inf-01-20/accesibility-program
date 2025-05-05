const GoogleMapsService = require('../services/googleMapsService');
const { 
  validateCoordinates,
  validateDirectionsResponse,
  validateTravelMode
} = require('../services/validationService');

exports.getDirections = async (req, res) => {
  try {
    const { origin, destination, mode = 'walking' } = req.query;

    // Validate inputs
    validateTravelMode(mode);
    
    const [originLat, originLng] = origin.split(',');
    const [destLat, destLng] = destination.split(',');
    
    if (!validateCoordinates(originLat, originLng) || !validateCoordinates(destLat, destLng)) {
      return res.status(400).json({ error: 'Invalid coordinates format' });
    }

    const data = await GoogleMapsService.getDirections({
      origin,
      destination,
      mode
    });

    validateDirectionsResponse(data);

    const route = data.routes[0];
    const leg = route.legs[0];

    res.json({
      status: 'OK',
      routes: [{
        summary: route.summary,
        legs: [{
          distance: leg.distance,
          duration: leg.duration,
          start_address: leg.start_address,
          end_address: leg.end_address,
          steps: leg.steps.map(step => ({
            travel_mode: step.travel_mode,
            distance: step.distance,
            duration: step.duration,
            instructions: step.html_instructions.replace(/<[^>]*>/g, '')
          }))
        }],
        overview_polyline: route.overview_polyline,
        bounds: route.bounds,
        warnings: route.warnings || []
      }]
    });

  } catch (err) {
    console.error('Directions API Error:', err);
    const status = err.message.includes('Invalid') ? 400 : 500;
    res.status(status).json({
      error: err.message.includes('Invalid') ? err.message : 'Failed to calculate directions',
      details: status === 500 ? err.message : undefined
    });
  }
};
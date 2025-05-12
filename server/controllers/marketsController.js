const GoogleMapsService = require('../services/googleMapsService');
const { validateCoordinates } = require('../services/validationService');
const { MARKET_SEARCH_ATTEMPTS, DEFAULT_RADIUS } = require('../config/constants');

exports.search = async (req, res) => {
  try {
    const { lat, lng, radius = DEFAULT_RADIUS } = req.query;

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        received: { lat, lng }
      });
    }

    const allResults = [];
    const seenPlaceIds = new Set();

    for (const attempt of MARKET_SEARCH_ATTEMPTS) {
      try {
        const data = await GoogleMapsService.searchPlaces({
          ...attempt,
          location: `${lat},${lng}`,
          radius
        });

        if (data.results?.length > 0) {
          data.results.forEach(place => {
            if (!seenPlaceIds.has(place.place_id)) {
              seenPlaceIds.add(place.place_id);
              allResults.push(place);
            }
          });
        }
      } catch (err) {
        console.warn('Market search attempt failed:', attempt, err.message);
      }
    }

    if (allResults.length > 0) {
      const marketResults = allResults.filter(place => {
        const name = place.name.toLowerCase();
        const types = place.types || [];
        return (
          name.includes('market') ||
          types.some(t => t.includes('market')) ||
          name.includes('bazaar') ||
          (types.includes('shopping_mall') && name.includes('market'))
        );
      });

      if (marketResults.length > 0) {
        return res.json({
          status: 'OK',
          results: marketResults.map(place => ({
            id: place.place_id,
            name: place.name,
            location: place.geometry?.location,
            address: place.vicinity,
            types: place.types,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total
          }))
        });
      }
    }

    res.status(404).json({
      status: 'ZERO_RESULTS',
      message: 'No markets found after multiple search attempts',
      attempts: MARKET_SEARCH_ATTEMPTS.length
    });

  } catch (err) {
    console.error('Malawi Markets Error:', err);
    res.status(500).json({
      error: 'Failed to search markets',
      details: err.message
    });
  }
};
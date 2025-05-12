const express = require('express');
const axios = require('axios');
const https = require('https');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// ======================
// Middleware Setup
// ======================
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later'
});

const directionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500,
  message: 'Too many directions requests, please try again later'
});

app.use('/api/', apiLimiter);
app.use('/api/directions', directionsLimiter);

// Constants
const MAX_RADIUS = 50000; // 50km
const DEFAULT_RADIUS = 5000;
const API_TIMEOUT = 20000; // 20 seconds
const ipv4Agent = new https.Agent({ family: 4 }); // Force IPv4

// Helper Functions
const validateCoordinates = (lat, lng) => {
  return lat && lng && !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
};

const sanitizeInput = (input) => {
  return input.toString().replace(/[^\w\s-]/g, '');
};

const validateDirectionsResponse = (data) => {
  if (!data.routes?.[0]?.legs?.[0]) {
    throw new Error('Invalid route structure from Google API');
  }
  if (!data.routes[0].overview_polyline?.points) {
    throw new Error('Missing overview polyline data');
  }
};

// API Routes

// Unified Places Search
app.get('/api/places/search', async (req, res) => {
  try {
    const { lat, lng, type, query, radius = DEFAULT_RADIUS } = req.query;

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        received: { lat, lng }
      });
    }

    let googleUrl, params;

    if (query) {
      googleUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
      params = {
        query: sanitizeInput(query),
        location: `${lat},${lng}`,
        radius: Math.min(Number(radius), MAX_RADIUS),
        key: process.env.GOOGLE_MAPS_API_KEY
      };
    } else if (type) {
      googleUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
      params = {
        type: sanitizeInput(type),
        location: `${lat},${lng}`,
        radius: Math.min(Number(radius), MAX_RADIUS),
        key: process.env.GOOGLE_MAPS_API_KEY
      };
    } else {
      return res.status(400).json({ 
        error: 'Either type or query parameter is required' 
      });
    }

    const response = await axios.get(googleUrl, {
      params,
      timeout: API_TIMEOUT,
      httpsAgent: ipv4Agent
    });

    if (response.data.status !== 'OK') {
      return res.status(400).json({
        error: response.data.error_message || 'Google Places API error',
        status: response.data.status
      });
    }

    const transformed = {
      status: 'OK',
      results: (response.data.results || []).map(place => ({
        id: place.place_id,
        name: place.name,
        location: place.geometry?.location,
        address: place.vicinity,
        types: place.types,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total
      }))
    };

    res.json(transformed);

  } catch (err) {
    console.error('Places Search Error:', err);
    res.status(500).json({
      error: 'Failed to search places',
      details: err.message
    });
  }
});

// Malawi Markets Search
app.get('/api/places/malawi-markets', async (req, res) => {
  try {
    const { lat, lng, radius = 10000 } = req.query;

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        received: { lat, lng }
      });
    }

    const searchAttempts = [
      { query: 'local market OR flea market OR bazaar' },
      { query: 'central market OR big market OR main market' },
      { type: 'shopping_mall' },
      { type: 'grocery_or_supermarket', keyword: 'market' },
      { query: 'market' }
    ];

    const allResults = [];
    const seenPlaceIds = new Set();

    for (const attempt of searchAttempts) {
      try {
        const googleUrl = attempt.type
          ? 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
          : 'https://maps.googleapis.com/maps/api/place/textsearch/json';

        const response = await axios.get(googleUrl, {
          params: {
            ...attempt,
            location: `${lat},${lng}`,
            radius: Math.min(Number(radius), MAX_RADIUS),
            key: process.env.GOOGLE_MAPS_API_KEY
          },
          timeout: API_TIMEOUT,
          httpsAgent: ipv4Agent
        });

        if (response.data.results?.length > 0) {
          response.data.results.forEach(place => {
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
      attempts: searchAttempts.length
    });

  } catch (err) {
    console.error('Malawi Markets Error:', err);
    res.status(500).json({
      error: 'Failed to search markets',
      details: err.message
    });
  }
});

// Enhanced Directions API
app.get('/api/directions', async (req, res) => {
  try {
    const { origin, destination, mode = 'walking' } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        error: 'Missing origin/destination',
        example: '/api/directions?origin=lat,lng&destination=lat,lng'
      });
    }

    const validModes = ['walking', 'driving', 'bicycling', 'transit'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: 'Invalid travel mode',
        validModes
      });
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin,
        destination,
        mode,
        alternatives: false,
        key: process.env.GOOGLE_MAPS_API_KEY
      },
      timeout: 20000,
      httpsAgent: ipv4Agent
    });

    // Enhanced validation
    if (response.data.status !== 'OK') {
      return res.status(400).json({
        error: 'Directions request failed',
        status: response.data.status,
        error_message: response.data.error_message
      });
    }

    if (!response.data.routes?.[0]?.legs?.[0]) {
      return res.status(400).json({
        error: 'No valid route found between locations',
        status: 'ZERO_RESULTS',
        origin,
        destination,
        mode
      });
    }

    const route = response.data.routes[0];
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
    res.status(500).json({
      error: 'Failed to calculate directions',
      details: err.message
    });
  }
});

// ======================
// Start Server
// ======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Allowed origins: ${process.env.ALLOWED_ORIGINS || 'All'}`);
  console.log(`🗺️ Google Maps API key: ${process.env.GOOGLE_MAPS_API_KEY ? 'Configured' : 'Missing!'}`);
});
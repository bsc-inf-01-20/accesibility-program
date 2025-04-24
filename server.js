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

// Rate limiting (1000 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', apiLimiter);

// ======================
// Constants
// ======================
const MAX_RADIUS = 50000; // 50km
const DEFAULT_RADIUS = 5000;
const API_TIMEOUT = 20000; // 20 seconds
const ipv4Agent = new https.Agent({ family: 4 }); // Force IPv4

// ======================
// Helper Functions
// ======================
const validateCoordinates = (lat, lng) => {
  return lat && lng && !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
};

const sanitizeInput = (input) => {
  return input.toString().replace(/[^\w\s-]/g, '');
};

// ======================
// API Routes
// ======================

// Unified Places Search
app.get('/api/places/search', async (req, res) => {
  try {
    const { lat, lng, type, query, radius = DEFAULT_RADIUS } = req.query;

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
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
      return res.status(400).json({ error: 'Either type or query parameter is required' });
    }

    const response = await axios.get(googleUrl, {
      params,
      timeout: API_TIMEOUT,
      httpsAgent: ipv4Agent
    });

    handleGoogleResponse(response, res);
  } catch (err) {
    handleApiError(err, res, 'Places Search Error');
  }
});

// Malawi Markets Search
// Malawi Markets Search - Focused on local and big markets
app.get('/api/places/malawi-markets', async (req, res) => {
  try {
    const { lat, lng, radius = 10000 } = req.query;

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Specific search attempts focused on markets
    const searchAttempts = [
      { query: 'local market OR flea market OR bazaar' },  // Local markets
      { query: 'central market OR big market OR main market' },  // Big markets
      { type: 'shopping_mall' },  // Sometimes big markets are classified as malls
      { type: 'grocery_or_supermarket', keyword: 'market' },  // Fallback
      { query: 'market' }  // Final broad search
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
          // Deduplicate results and add to collection
          response.data.results.forEach(place => {
            if (!seenPlaceIds.has(place.place_id)) {
              seenPlaceIds.add(place.place_id);
              allResults.push(place);
            }
          });
        }
      } catch (err) {
        console.warn(`Search attempt failed:`, attempt);
      }
    }

    if (allResults.length > 0) {
      // Filter to ensure we're only getting market-like places
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

      return handleGoogleResponse({
        data: {
          status: 'OK',
          results: marketResults
        }
      }, res);
    }

    return res.status(404).json({
      status: 'ZERO_RESULTS',
      message: 'No markets found after multiple search attempts'
    });
  } catch (err) {
    handleApiError(err, res, 'Malawi Markets Error');
  }
});
// Directions API Proxy
app.get('/api/directions', async (req, res) => {
  try {
    const { origin, destination, mode = 'walking' } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        error: 'Missing origin/destination',
        example: '/api/directions?origin=-15.397721,35.314147&destination=-15.396523,35.3095214'
      });
    }

    const validModes = ['walking', 'driving', 'bicycling', 'transit'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: 'Invalid travel mode',
        validModes,
        received: mode
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
      timeout: API_TIMEOUT,
      httpsAgent: ipv4Agent
    });

    if (response.data.status === 'OK') {
      res.json(response.data);
    } else {
      res.status(400).json({
        error: response.data.error_message || 'Directions request failed',
        status: response.data.status
      });
    }
  } catch (err) {
    handleApiError(err, res, 'Directions API Error');
  }
});

// ======================
// Helpers
// ======================
const handleGoogleResponse = (response, res) => {
  if (response.data.status !== 'OK') {
    return res.status(400).json({
      error: response.data.error_message || 'Google API error',
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
};

const handleApiError = (err, res, context) => {
  console.error(`${context}:`, err);

  if (err.response) {
    return res.status(502).json({
      error: err.response.data.error_message || 'Bad gateway to Google API',
      details: err.response.data
    });
  } else if (err.request) {
    return res.status(504).json({
      error: 'Timeout communicating with Google API'
    });
  } else {
    return res.status(500).json({
      error: 'Internal server error processing request'
    });
  }
};

// ======================
// Start Server
// ======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`🌍 Allowed origins: ${process.env.ALLOWED_ORIGINS || 'All'}`);
});

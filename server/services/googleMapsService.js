const axios = require('axios');
const https = require('https');
const { MAX_RADIUS, API_TIMEOUT } = require('../config/constants');

const ipv4Agent = new https.Agent({ family: 4 });

class GoogleMapsService {
  static async searchPlaces({ type, query, location, radius }) {
    const endpoint = query 
      ? 'textsearch' 
      : 'nearbysearch';
    
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/${endpoint}/json`,
      {
        params: {
          ...(query && { query }),
          ...(type && { type }),
          location,
          radius: Math.min(Number(radius), MAX_RADIUS),
          key: process.env.GOOGLE_MAPS_API_KEY
        },
        timeout: API_TIMEOUT,
        httpsAgent: ipv4Agent
      }
    );
    
    return response.data;
  }

  static async getDirections({ origin, destination, mode }) {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/directions/json',
      {
        params: {
          origin,
          destination,
          mode,
          alternatives: false,
          key: process.env.GOOGLE_MAPS_API_KEY
        },
        timeout: API_TIMEOUT,
        httpsAgent: ipv4Agent
      }
    );
    
    return response.data;
  }
}

module.exports = GoogleMapsService;
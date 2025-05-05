module.exports = {
    MAX_RADIUS: 50000, // 50km
    DEFAULT_RADIUS: 5000,
    API_TIMEOUT: 20000, // 20 seconds
    VALID_TRAVEL_MODES: ['walking', 'driving', 'bicycling', 'transit'],
    MARKET_SEARCH_ATTEMPTS: [
      { query: 'local market OR flea market OR bazaar' },
      { query: 'central market OR big market OR main market' },
      { type: 'shopping_mall' },
      { type: 'grocery_or_supermarket', keyword: 'market' },
      { query: 'market' }
    ]
  };
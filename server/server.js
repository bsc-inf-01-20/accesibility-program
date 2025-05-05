require('dotenv').config();
const express = require('express');
const app = express();
const apiRoutes = require('./routes/apiRoutes');
const middleware = require('./config/middleware');

// Initialize middleware
middleware(app);

// API Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Allowed origins: ${process.env.ALLOWED_ORIGINS || 'All'}`);
  console.log(`🗺️ Google Maps API key: ${process.env.GOOGLE_MAPS_API_KEY ? 'Configured' : 'Missing!'}`);
});
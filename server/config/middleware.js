const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const express = require('express');

module.exports = (app) => {
  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
  }));
  app.use(express.json());
  app.use(morgan('dev'));
};
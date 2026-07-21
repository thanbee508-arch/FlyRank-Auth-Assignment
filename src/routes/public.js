const express = require('express');

const publicRouter = express.Router();

publicRouter.get('/info', (req, res) => {
  res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

module.exports = { publicRouter };

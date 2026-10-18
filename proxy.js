const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for all origins (for development)
app.use(cors());

// Mock API endpoint that forwards to the mock server
app.get('/auth/register', (req, res) => {
  // Forward to mock API server
  fetch('http://localhost:3000/auth/register', {
  // fetch('https://tap-pay-production.up.railway.app/api/v1/', {
    method: req.method,
    headers: req.headers,
    body: undefined
  })
    .then(response => response.json())
    .then(data => res.json(data))
    .catch(error => {
      console.error('API call failed:', error);
      res.status(502).json({ error: 'Upstream API unavailable' });
    });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
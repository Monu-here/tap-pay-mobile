const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for all origins (for development)
app.use(cors());

// Auth routes
app.post('/auth/login', (req, res) => {
  // Simulate login success
  res.json({
    success: true,
    message: 'Login successful',
    token: 'fake-jwt-token'
  });
});

app.post('/auth/register', (req, res) => {
  // Simulate register success
  res.json({
    success: true,
    message: 'Registration successful',
    userId: '12345',
    token: 'fake-jwt-token-registered'
  });
});

// Other API routes (optional)
app.get('/api/v1/users', (req, res) => {
  res.json([{ id: 1, name: 'Test User' }]);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});
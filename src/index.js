require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./utils/db');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to Database
connectDB();

// Simple route for testing
app.get('/', (req, res) => {
  res.send('Event Evaluation System API is running...');
});

// API Routes
const analysisRoutes = require('./api/routes/analysisRoutes');
app.use('/api/analysis', analysisRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

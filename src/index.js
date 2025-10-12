require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./utils/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for certificate downloads
app.use('/uploads', express.static('src/uploads'));

// Connect to Database
connectDB();

// Simple route for testing
app.get('/', (req, res) => {
  res.send('Event Evaluation System API is running...');
});

// API Routes
const analysisRoutes = require('./api/routes/analysisRoutes');
const eventRoutes = require('./api/routes/eventRoutes');
const certificateRoutes = require('./api/routes/certificateRoutes');

app.use('/api/analysis', analysisRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/certificates', certificateRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

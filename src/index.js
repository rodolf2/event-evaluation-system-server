require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const passport = require('passport');
const connectDB = require('./utils/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Configure Passport
require('./config/passport');

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
const authRoutes = require('./api/routes/authRoutes');
const protectedRoutes = require('./api/routes/protectedRoutes');
const userRoutes = require('./api/routes/userRoutes');
const reminderRoutes = require('./api/routes/reminderRoutes');

app.use('/api/analysis', analysisRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reminders', reminderRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

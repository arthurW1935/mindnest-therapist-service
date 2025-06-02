const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const cron = require('node-cron');

// Load environment variables
dotenv.config();

// Import routes
const therapistRoutes = require('./routes/therapistRoutes');
const profileRoutes = require('./routes/profileRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const clientRoutes = require('./routes/clientRoutes');

// Import middleware
const { errorHandler, requestLogger } = require('./middleware/errorHandler');

// Import database
const { initializeDatabase } = require('./config/database');

// Import scheduled tasks
const { cleanupExpiredAvailability } = require('./utils/scheduledTasks');

const app = express();
const PORT = process.env.PORT || 3003;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Therapist Service is healthy',
    timestamp: new Date().toISOString(),
    service: 'therapist-service',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/therapists', therapistRoutes);
app.use('/api/therapist-profile', profileRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/clients', clientRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Schedule cleanup tasks
if (process.env.NODE_ENV !== 'test') {
  // Clean up expired availability slots every hour
  cron.schedule('0 * * * *', () => {
    console.log('🔄 Running scheduled cleanup tasks...');
    cleanupExpiredAvailability();
  });
  
  console.log('📅 Scheduled tasks initialized');
}

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database connection and create tables
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Therapist Service running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start Therapist Service:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
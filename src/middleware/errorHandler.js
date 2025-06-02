const errorHandler = (error, req, res, next) => {
    let statusCode = error.statusCode || 500;
    let message = error.message || 'Internal server error';
  
    // Log error details
    console.error('🚨 Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  
    // Handle specific error types
    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation error';
    } else if (error.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid data format';
    } else if (error.message.includes('duplicate key')) {
      statusCode = 409;
      message = 'Duplicate entry';
    } else if (error.message.includes('foreign key')) {
      statusCode = 400;
      message = 'Invalid reference';
    } else if (error.message.includes('therapist not found')) {
      statusCode = 404;
      message = 'Therapist not found';
    } else if (error.message.includes('client not found')) {
      statusCode = 404;
      message = 'Client not found';
    } else if (error.message.includes('availability slot not found')) {
      statusCode = 404;
      message = 'Availability slot not found';
    }
  
    // Don't expose sensitive error details in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
      message = 'Something went wrong';
    }
  
    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  };
  
  // Request logging middleware
  const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`📝 ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
  };
  
  module.exports = {
    errorHandler,
    requestLogger
  };
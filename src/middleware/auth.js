const jwt = require('jsonwebtoken');

// JWT verification middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Add user data to request
    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    } else {
      console.error('Token verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication error'
      });
    }
  }
};

// Role-based authorization middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      console.error('Role verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

// Therapist-only access
const requireTherapist = requireRole(['psychiatrist']);

// User-only access
const requireUser = requireRole(['user']);

// Any authenticated user
const requireAuth = requireRole(['user', 'psychiatrist','admin']);

// Therapist self-access only (therapist can only access their own data)
const requireTherapistSelfAccess = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Must be a therapist
    if (req.user.role !== 'psychiatrist' || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Therapist or Admin access required'
      });
    }

    const requestedTherapistId = parseInt(req.params.therapistId || req.params.id || '');
    const authenticatedUserId = req.user.sub;

    // Allow access if no specific therapist ID is requested (for general endpoints)
    if (!requestedTherapistId) {
      return next();
    }

    // Check if the requested therapist ID matches the authenticated user
    // This will be validated against the therapist's auth_user_id in the controller
    req.requestedTherapistId = requestedTherapistId;
    
    next();
  } catch (error) {
    console.error('Therapist self-access verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization error'
    });
  }
};

// Client access control (user can access their own data or therapist can access client data)
const requireClientAccess = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const requestedUserId = parseInt(req.params.userId || req.params.clientId || '');
    const authenticatedUserId = req.user.sub;

    // Therapists can access any client data (will be validated in controller)
    if (req.user.role === 'psychiatrist') {
      return next();
    }

    // Users can only access their own data
    if (req.user.role === 'user') {
      if (requestedUserId && requestedUserId !== authenticatedUserId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only access your own data'
        });
      }
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  } catch (error) {
    console.error('Client access verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization error'
    });
  }
};

// Admin-only access
const requireAdmin = requireRole(['admin']);

module.exports = {
  verifyToken,
  requireRole,
  requireTherapist,
  requireUser,
  requireAuth,
  requireTherapistSelfAccess,
  requireClientAccess,
  requireAdmin
};
# MindNest Therapist Service

A comprehensive microservice for managing mental health professionals on the MindNest platform. This service handles therapist profiles, availability management, client relationships, and session coordination.

## 🚀 Features

- **Therapist Management**: Complete therapist profile and verification system
- **Profile Management**: Detailed therapist profiles with specializations and approaches
- **Availability System**: Template-based and manual availability slot management
- **Client Relationships**: Therapist-client relationship tracking and management
- **Session Booking**: Integration with booking service for appointment scheduling
- **Review System**: Client reviews and ratings for therapists
- **Verification System**: Admin-controlled therapist verification workflow
- **Search & Discovery**: Advanced therapist search with filtering capabilities
- **Security**: JWT-based authentication with role-based access control
- **Scheduled Tasks**: Automated cleanup of expired availability slots
- **PostgreSQL Integration**: Robust relational database with optimized queries

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager
- MindNest Auth Service running (for JWT verification)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mindnest-therapist-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3003
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=mindnest_therapists
   DB_USER=mindnest_user
   DB_PASSWORD=mindnest_password

   # JWT Configuration (must match Auth Service)
   JWT_SECRET=your_super_secret_jwt_key_here

   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:3000,https://mindnest-frontend.vercel.app

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # Optional: Production Database URL
   # DATABASE_URL=postgresql://username:password@host:port/database
   ```

4. **Database Setup**
   - Create a PostgreSQL database named `mindnest_therapists`
   - The service will automatically create all required tables on startup

5. **Start the service**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

## 🏗️ Architecture

```
mindnest-therapist-service/
├── src/
│   ├── config/
│   │   └── database.js           # PostgreSQL connection and table initialization
│   ├── controllers/
│   │   ├── therapistController.js # Therapist management logic
│   │   ├── profileController.js   # Profile management logic
│   │   ├── availabilityController.js # Availability management
│   │   └── clientController.js    # Client relationship management
│   ├── middleware/
│   │   ├── auth.js               # JWT verification and role-based access
│   │   ├── validation.js         # Request validation schemas
│   │   └── errorHandler.js       # Global error handling
│   ├── models/
│   │   ├── Therapist.js          # Therapist data model
│   │   ├── TherapistProfile.js   # Profile data model
│   │   └── Availability.js       # Availability data model
│   ├── routes/
│   │   ├── therapistRoutes.js    # Therapist API routes
│   │   ├── profileRoutes.js      # Profile API routes
│   │   ├── availabilityRoutes.js # Availability API routes
│   │   └── clientRoutes.js       # Client relationship routes
│   ├── utils/
│   │   └── scheduledTasks.js     # Automated cleanup tasks
│   └── server.js                 # Express server setup
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Health Check

#### `GET /health`
Check service health status.

**Response:**
```json
{
  "success": true,
  "message": "Therapist Service is healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "therapist-service",
  "version": "1.0.0"
}
```

### Therapist Management

#### `POST /api/therapists/create`
Create a new therapist (called by Auth Service).

**Request Body:**
```json
{
  "auth_user_id": 123,
  "email": "therapist@mindnest.com",
  "verification_status": "pending"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Therapist created successfully",
  "data": {
    "therapist": {
      "id": 1,
      "auth_user_id": 123,
      "email": "therapist@mindnest.com",
      "is_active": true,
      "is_verified": false,
      "verification_status": "pending",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### `GET /api/therapists/me`
Get current therapist information (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "therapist": {
      "id": 1,
      "auth_user_id": 123,
      "email": "therapist@mindnest.com",
      "first_name": "Dr. Jane",
      "last_name": "Smith",
      "title": "Licensed Clinical Psychologist",
      "bio": "Experienced therapist specializing in anxiety and depression...",
      "years_experience": 8,
      "session_rate": 150.00,
      "currency": "USD",
      "average_rating": 4.8,
      "review_count": 45,
      "profile_completion": 85,
      "specializations": ["Anxiety", "Depression", "PTSD"],
      "approaches": ["CBT", "EMDR", "Mindfulness"],
      "is_verified": true,
      "verification_status": "verified"
    }
  }
}
```

#### `GET /api/therapists/search`
Search for therapists (public endpoint).

**Query Parameters:**
- `specializations`: Array of specialization names
- `approaches`: Array of therapy approach names
- `languages`: Array of spoken languages
- `min_rating`: Minimum rating (1-5)
- `max_rate`: Maximum session rate
- `verified_only`: Boolean (true/false)
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "therapists": [
      {
        "id": 1,
        "first_name": "Dr. Jane",
        "last_name": "Smith",
        "title": "Licensed Clinical Psychologist",
        "bio": "Experienced therapist...",
        "years_experience": 8,
        "session_rate": 150.00,
        "currency": "USD",
        "average_rating": 4.8,
        "review_count": 45,
        "profile_picture_url": "https://example.com/avatar.jpg",
        "specializations": ["Anxiety", "Depression"],
        "approaches": ["CBT", "EMDR"]
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

#### `GET /api/therapists/public/:id`
Get public therapist profile (for users browsing).

#### `PUT /api/therapists/:id/verification`
Update therapist verification status (admin only).

**Request Body:**
```json
{
  "verification_status": "verified",
  "verification_notes": "All documents verified successfully"
}
```

### Profile Management

#### `GET /api/therapist-profile/me`
Get current therapist's profile (requires authentication).

#### `PUT /api/therapist-profile/me`
Update current therapist's profile.

**Request Body:**
```json
{
  "first_name": "Dr. Jane",
  "last_name": "Smith",
  "title": "Licensed Clinical Psychologist",
  "bio": "Experienced therapist specializing in anxiety and depression...",
  "years_experience": 8,
  "education": ["Ph.D. Clinical Psychology", "M.A. Counseling"],
  "certifications": ["Licensed Clinical Psychologist", "EMDR Certified"],
  "languages_spoken": ["English", "Spanish"],
  "phone": "+1-555-0123",
  "license_number": "PSY12345",
  "license_state": "California",
  "session_rate": 150.00,
  "currency": "USD",
  "timezone": "America/Los_Angeles"
}
```

#### `GET /api/therapist-profile/me/completion`
Get profile completion percentage.

#### `POST /api/therapist-profile/me/specializations`
Update therapist specializations.

**Request Body:**
```json
{
  "specializations": [
    {
      "name": "Anxiety",
      "proficiency_level": "expert"
    },
    {
      "name": "Depression",
      "proficiency_level": "proficient"
    }
  ]
}
```

#### `POST /api/therapist-profile/me/approaches`
Update therapy approaches.

**Request Body:**
```json
{
  "approaches": ["CBT", "EMDR", "Mindfulness", "Psychodynamic"]
}
```

### Availability Management

#### `GET /api/availability/templates`
Get availability templates (therapist only).

#### `POST /api/availability/templates`
Create availability template.

**Request Body:**
```json
{
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "17:00",
  "session_duration": 60,
  "break_between_sessions": 15
}
```

#### `POST /api/availability/generate`
Generate availability slots from templates.

**Request Body:**
```json
{
  "template_id": 1,
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

#### `GET /api/availability/search`
Search available slots (public endpoint).

**Query Parameters:**
- `therapist_id`: Therapist ID
- `start_date`: Start date (YYYY-MM-DD)
- `end_date`: End date (YYYY-MM-DD)
- `session_type`: Session type (individual, group, etc.)

#### `GET /api/availability/calendar`
Get therapist's calendar view (therapist only).

### Client Management

#### `GET /api/clients/me`
Get therapist's clients (therapist only).

#### `POST /api/clients/relationship`
Create client relationship.

**Request Body:**
```json
{
  "user_id": 456,
  "session_rate": 150.00,
  "currency": "USD",
  "notes": "New client referral from Dr. Johnson"
}
```

#### `GET /api/clients/:userId`
Get specific client details (therapist only).

#### `GET /api/clients/sessions/upcoming`
Get upcoming sessions (authenticated users).

#### `POST /api/clients/sessions/book`
Book a session.

**Request Body:**
```json
{
  "therapist_id": 1,
  "availability_slot_id": 123,
  "session_type": "individual",
  "notes": "First session - anxiety treatment"
}
```

### Reviews & Ratings

#### `POST /api/clients/:therapistId/review`
Create therapist review.

**Request Body:**
```json
{
  "rating": 5,
  "review_text": "Excellent therapist, very helpful with my anxiety.",
  "is_anonymous": false
}
```

#### `GET /api/clients/:therapistId/reviews`
Get therapist reviews (public endpoint).

## 🔒 Data Models

### Therapist Model
```sql
CREATE TABLE therapists (
  id SERIAL PRIMARY KEY,
  auth_user_id INTEGER UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verification_status VARCHAR(20) DEFAULT 'pending',
  verification_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Therapist Profile Model
```sql
CREATE TABLE therapist_profiles (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  title VARCHAR(100),
  bio TEXT,
  years_experience INTEGER,
  education TEXT[],
  certifications TEXT[],
  languages_spoken TEXT[] DEFAULT ARRAY['English'],
  phone VARCHAR(20),
  license_number VARCHAR(100),
  license_state VARCHAR(50),
  profile_picture_url VARCHAR(500),
  session_rate DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(therapist_id)
);
```

### Availability Model
```sql
CREATE TABLE availability_templates (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_duration INTEGER DEFAULT 60,
  break_between_sessions INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE availability_slots (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  start_datetime TIMESTAMP NOT NULL,
  end_datetime TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  session_type VARCHAR(20) DEFAULT 'individual',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔐 Authentication & Authorization

### JWT Token Verification
- All protected endpoints require valid JWT tokens
- Tokens are verified against the Auth Service secret
- Automatic token expiration handling

### Role-Based Access Control
- **Public Routes**: Search, public profiles, reviews
- **Therapist Routes**: Profile management, availability, client management
- **Admin Routes**: Verification management, statistics
- **User Routes**: Session booking, reviews

### Access Control Levels
- `requireAuth`: Any authenticated user
- `requireTherapist`: Therapist role only
- `requireAdmin`: Admin role only
- `requireTherapistSelfAccess`: Therapist can only access own data
- `requireClientAccess`: User can access own data, therapist can access client data

## 🔧 Validation Rules

### Profile Validation
- **Names**: 1-100 characters
- **Bio**: Maximum 2000 characters
- **Years Experience**: 0-50 years
- **Session Rate**: Positive decimal
- **Phone**: Valid phone format
- **License**: Valid license format

### Availability Validation
- **Day of Week**: 0-6 (Sunday-Saturday)
- **Time Format**: HH:MM (24-hour)
- **Session Duration**: 15-240 minutes
- **Break Time**: 0-60 minutes

### Review Validation
- **Rating**: 1-5 stars
- **Review Text**: 10-1000 characters
- **Anonymous**: Boolean flag

## 🚀 Key Features

### Therapist Verification System
- Multi-stage verification workflow
- Admin-controlled approval process
- Document verification tracking
- Verification status management

### Advanced Search & Filtering
- Specialization-based filtering
- Therapy approach filtering
- Language filtering
- Rating and price filtering
- Geographic filtering (future)

### Availability Management
- Template-based scheduling
- Manual slot creation
- Bulk slot generation
- Conflict detection
- Automatic cleanup

### Client Relationship Tracking
- Therapist-client relationships
- Session history
- Progress tracking
- Notes and documentation

## 📊 Monitoring & Maintenance

### Health Monitoring
- Built-in health check endpoint
- Database connection monitoring
- Service status reporting

### Scheduled Tasks
- Automatic cleanup of expired availability slots
- Database maintenance tasks
- Performance optimization

### Error Handling
- Comprehensive error logging
- Graceful error responses
- Request validation
- Database error handling


## 🔄 Version History

- **v1.0.0**: Initial release with core therapist features
  - Therapist profile management
  - Availability system
  - Client relationship tracking
  - Review and rating system
  - Verification workflow
  - Advanced search capabilities
  - PostgreSQL integration
  - JWT authentication
  - Role-based access control 
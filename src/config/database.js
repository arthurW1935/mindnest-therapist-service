const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'mindnest_user',
  password: process.env.DB_PASSWORD || 'mindnest_password',
  database: process.env.DB_NAME || 'mindnest_therapists',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('🔌 Database connection established');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Initialize database tables
const initializeDatabase = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Therapists table (basic info synced from auth service)
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapists (
        id SERIAL PRIMARY KEY,
        auth_user_id INTEGER UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        verification_status VARCHAR(20) DEFAULT 'pending',
        verification_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Therapist profiles table (detailed therapist information)
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapist_profiles (
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
      )
    `);

    // Specializations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS specializations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        category VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Therapist specializations (many-to-many relationship)
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapist_specializations (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
        specialization_id INTEGER REFERENCES specializations(id) ON DELETE CASCADE,
        proficiency_level VARCHAR(20) DEFAULT 'proficient',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(therapist_id, specialization_id)
      )
    `);

    // Therapy approaches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapy_approaches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        category VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Therapist approaches (many-to-many relationship)
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapist_approaches (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
        approach_id INTEGER REFERENCES therapy_approaches(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(therapist_id, approach_id)
      )
    `);

    // Availability templates (recurring availability)
    await client.query(`
      CREATE TABLE IF NOT EXISTS availability_templates (
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
      )
    `);

    // Specific availability slots (generated from templates or manual)
    await client.query(`
      CREATE TABLE IF NOT EXISTS availability_slots (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
        start_datetime TIMESTAMP NOT NULL,
        end_datetime TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'available',
        session_type VARCHAR(20) DEFAULT 'individual',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Therapist-client relationships
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapist_clients (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        relationship_status VARCHAR(20) DEFAULT 'active',
        started_date DATE DEFAULT CURRENT_DATE,
        ended_date DATE,
        notes TEXT,
        session_rate DECIMAL(10,2),
        currency VARCHAR(3) DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(therapist_id, user_id)
      )
    `);

    // Session bookings (will be extended in booking service)
    await client.query(`
      CREATE TABLE IF NOT EXISTS session_bookings (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        availability_slot_id INTEGER REFERENCES availability_slots(id) ON DELETE CASCADE,
        session_type VARCHAR(20) DEFAULT 'individual',
        status VARCHAR(20) DEFAULT 'scheduled',
        session_rate DECIMAL(10,2),
        currency VARCHAR(3) DEFAULT 'USD',
        notes TEXT,
        reminder_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Therapist reviews and ratings
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapist_reviews (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT,
        is_anonymous BOOLEAN DEFAULT false,
        is_verified BOOLEAN DEFAULT false,
        is_public BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(therapist_id, user_id)
      )
    `);

    // Activity logs for therapists
    await client.query(`
      CREATE TABLE IF NOT EXISTS therapist_activities (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        activity_description TEXT,
        metadata JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_therapists_auth_user_id ON therapists(auth_user_id);
      CREATE INDEX IF NOT EXISTS idx_therapists_email ON therapists(email);
      CREATE INDEX IF NOT EXISTS idx_therapist_profiles_therapist_id ON therapist_profiles(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_specializations_therapist_id ON therapist_specializations(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_approaches_therapist_id ON therapist_approaches(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_availability_slots_therapist_id ON availability_slots(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_availability_slots_datetime ON availability_slots(start_datetime, end_datetime);
      CREATE INDEX IF NOT EXISTS idx_availability_slots_status ON availability_slots(status);
      CREATE INDEX IF NOT EXISTS idx_therapist_clients_therapist_id ON therapist_clients(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_clients_user_id ON therapist_clients(user_id);
      CREATE INDEX IF NOT EXISTS idx_session_bookings_therapist_id ON session_bookings(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_session_bookings_user_id ON session_bookings(user_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_reviews_therapist_id ON therapist_reviews(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_activities_therapist_id ON therapist_activities(therapist_id);
    `);

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create triggers for updated_at
    const tables = [
      'therapists', 'therapist_profiles', 'availability_templates', 
      'availability_slots', 'therapist_clients', 'session_bookings', 'therapist_reviews'
    ];
    
    for (const table of tables) {
      await client.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // Insert default specializations
    await client.query(`
      INSERT INTO specializations (name, description, category) VALUES
      ('Anxiety Disorders', 'Treatment of various anxiety disorders including GAD, panic disorder, and phobias', 'anxiety'),
      ('Depression', 'Treatment of major depressive disorder and other mood disorders', 'mood'),
      ('Trauma & PTSD', 'Specialized treatment for trauma and post-traumatic stress disorder', 'trauma'),
      ('Relationship Counseling', 'Couples and family therapy for relationship issues', 'relationships'),
      ('Addiction & Substance Abuse', 'Treatment for various forms of addiction and substance abuse', 'addiction'),
      ('Eating Disorders', 'Specialized treatment for anorexia, bulimia, and other eating disorders', 'eating'),
      ('ADHD', 'Treatment and support for attention deficit hyperactivity disorder', 'neurodevelopmental'),
      ('Bipolar Disorder', 'Specialized care for bipolar and other mood disorders', 'mood'),
      ('OCD', 'Treatment for obsessive-compulsive disorder and related conditions', 'anxiety'),
      ('Grief & Loss', 'Support for those dealing with grief, loss, and bereavement', 'grief'),
      ('Stress Management', 'Techniques and strategies for managing stress and burnout', 'stress'),
      ('Self-Esteem', 'Building confidence and addressing self-worth issues', 'self-development')
      ON CONFLICT (name) DO NOTHING
    `);

    // Insert default therapy approaches
    await client.query(`
      INSERT INTO therapy_approaches (name, description, category) VALUES
      ('Cognitive Behavioral Therapy (CBT)', 'Evidence-based approach focusing on thoughts, feelings, and behaviors', 'cognitive'),
      ('Dialectical Behavior Therapy (DBT)', 'Skills-based approach for emotional regulation and distress tolerance', 'behavioral'),
      ('Psychodynamic Therapy', 'Insight-oriented approach exploring unconscious patterns', 'psychodynamic'),
      ('Humanistic Therapy', 'Person-centered approach emphasizing self-acceptance and growth', 'humanistic'),
      ('EMDR', 'Eye Movement Desensitization and Reprocessing for trauma treatment', 'trauma'),
      ('Acceptance and Commitment Therapy (ACT)', 'Mindfulness-based approach for psychological flexibility', 'mindfulness'),
      ('Solution-Focused Brief Therapy', 'Goal-oriented approach focusing on solutions rather than problems', 'brief'),
      ('Family Systems Therapy', 'Approach viewing individuals within their family and social systems', 'systemic'),
      ('Mindfulness-Based Therapy', 'Integration of mindfulness practices with therapeutic techniques', 'mindfulness'),
      ('Narrative Therapy', 'Approach helping people re-author their life stories', 'narrative')
      ON CONFLICT (name) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Database query function
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Query error', { text, duration, error });
    throw error;
  }
};

// Get a client from the pool
const getClient = async () => {
  return await pool.connect();
};

// Close all connections
const closePool = async () => {
  await pool.end();
  console.log('🔌 Database connection pool closed');
};

module.exports = {
  pool,
  testConnection,
  initializeDatabase,
  query,
  getClient,
  closePool
};
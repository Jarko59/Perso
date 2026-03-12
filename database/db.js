const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// PostgreSQL connection pool
// For production, use DB_URL or individual params
const pool = new Pool({
  user:     process.env.DB_USER     || 'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'cyberlearn',
  password: process.env.DB_PASSWORD || 'postgres',
  port:     parseInt(process.env.DB_PORT || '5432'),
});

// Helper for queries (returns result.rows for convenience)
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  // const duration = Date.now() - start;
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
};

// Initialize DB schema
const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('📦 PostgreSQL connected successfully');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(30) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(10) DEFAULT 'user',
        avatar TEXT,
        xp INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        icon VARCHAR(10),
        color VARCHAR(20)
      )
    `);

    // 3. Courses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        title VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        difficulty VARCHAR(20) DEFAULT 'beginner',
        xp_reward INTEGER DEFAULT 100,
        duration_min INTEGER DEFAULT 30,
        icon VARCHAR(10),
        banner_color VARCHAR(20),
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Modules (Lessons) table
    await client.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        xp_reward INTEGER DEFAULT 10,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. User Progress table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
        completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, module_id)
      )
    `);

    // 6. Quiz Questions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_option CHAR(1) NOT NULL,
        explanation TEXT
      )
    `);

    // 7. Quiz Results table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        passed BOOLEAN NOT NULL,
        taken_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Bookmarks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
      )
    `);

    console.log('✅ Base de données PostgreSQL initialisée avec succès');
  } catch (err) {
    console.error('❌ Erreur initialisation PostgreSQL:', err.message);
    // process.exit(1); 
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  pool,
  query,
  initDB
};

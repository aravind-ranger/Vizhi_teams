import pool from '../db/index';

const migrate = async () => {
  try {
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_code VARCHAR(20) UNIQUE');
    console.log('Migration successful: task_code added');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();

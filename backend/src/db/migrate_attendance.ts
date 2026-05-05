import pool from '../db/index';

const migrate = async () => {
  try {
    // Add work_location to attendance
    await pool.query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_location VARCHAR(50)');
    
    // Add availability_status to users
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS availability_status VARCHAR(50) DEFAULT \'available\'');
    
    console.log('Migration successful: work_location and availability_status added');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();

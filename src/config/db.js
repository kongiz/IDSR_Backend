const { Pool } = require("pg");
const env      = require("./env");

const pool = new Pool({
  host:     env.DB_HOST,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port:     parseInt(env.DB_PORT),
  max:      10,
});

pool.query("SELECT NOW()")
  .then(res => {
    console.log("PostgreSQL Connected:", res.rows[0]);
  })
  .catch(err => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

module.exports = pool;
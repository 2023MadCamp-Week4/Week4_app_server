const mysql = require("mysql2");

const pool = mysql.createPool({
  uri: process.env.DATABASE_URI,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;

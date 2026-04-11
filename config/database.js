const mysql = require("mysql2");
require("dotenv").config();

// Membuat pool koneksi agar lebih efisien daripada koneksi tunggal
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Menggunakan versi promise agar bisa pakai async/await di controller nanti
const db = pool.promise();

module.exports = db;

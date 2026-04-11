const db = require("./config/database");

async function testConnection() {
  try {
    // Melakukan query sederhana untuk cek koneksi
    const [rows] = await db.execute('SELECT "Koneksi Berhasil!" AS message');
    console.log("✅ DATABASE TERHUBUNG:", rows[0].message);

    // Cek apakah database 'coffee_shop' ada
    const [dbCheck] = await db.execute("SELECT DATABASE() AS current_db");
    console.log("📂 Database yang digunakan:", dbCheck[0].current_db);

    process.exit(0); // Keluar jika berhasil
  } catch (error) {
    console.error("❌ KONEKSI GAGAL:", error.message);
    process.exit(1); // Keluar dengan error
  }
}

testConnection();

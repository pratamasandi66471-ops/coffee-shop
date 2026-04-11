const db = require("../config/database");

class Product {
  static async getAll() {
    try {
      const [rows] = await db.execute(
        "SELECT id, name, description, price, image FROM products ORDER BY name"
      );
      return rows;
    } catch (error) {
      throw new Error(`Gagal mengambil produk: ${error.message}`);
    }
  }

  static async getById(id) {
    try {
      const [rows] = await db.execute(
        "SELECT id, name, description, price, image FROM products WHERE id = ?",
        [id]
      );
      return rows[0];
    } catch (error) {
      throw new Error(`Produk tidak ditemukan: ${error.message}`);
    }
  }

  static async create({ name, description, price, image }) {
    try {
      const [result] = await db.execute(
        "INSERT INTO products (name, description, price, image) VALUES (?, ?, ?, ?)",
        [name, description, price, image]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(`Gagal menambahkan produk: ${error.message}`);
    }
  }
}

module.exports = Product;


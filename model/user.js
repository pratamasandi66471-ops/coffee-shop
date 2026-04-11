const db = require("../config/database");

class User {
  static async create(name, email, hashedPassword) {
    try {
      const [result] = await db.execute(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')",
        [name, email, hashedPassword]
      );
      return result.insertId;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Email sudah terdaftar');
      }
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const [rows] = await db.execute(
        "SELECT id, name, email, password, role FROM users WHERE email = ?",
        [email]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;


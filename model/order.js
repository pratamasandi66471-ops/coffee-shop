const db = require("../config/database");

class Order {
  static async create(userId, totalPrice, items) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        "INSERT INTO orders (user_id, total_price) VALUES (?, ?)",
        [userId, totalPrice],
      );
      const orderId = result.insertId;

      for (let item of items) {
        await connection.execute(
          "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
          [orderId, item.product_id, item.quantity, item.price],
        );
      }

      await connection.commit();
      return orderId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = Order;

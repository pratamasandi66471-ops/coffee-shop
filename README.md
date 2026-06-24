# ☕ Coffee Shop Web App

A web-based coffee shop application built using **Node.js**, **Express.js**, **EJS**, and **MySQL**. This project allows users to browse products, add items to cart, and place orders, while admins can manage products and orders.

---

## 🚀 Features

### 👤 User

* Register & Login
* Browse menu
* View product details
* Add to cart
* Checkout & order

### 🛠️ Admin

* Add / manage products
* View orders

---

## 🧱 Tech Stack

* **Backend:** Node.js, Express.js
* **Frontend:** EJS (Embedded JavaScript Templates)
* **Database:** MySQL
* **Other:** Multer (file upload), Middleware auth & security

---

## 📁 Project Structure

```
coffee-shop/
│
├── config/         # Database & config files
├── controllers/    # Logic for handling requests
├── middleware/     # Auth, upload, security
├── model/          # Database models
├── public/         # Static files (CSS, JS, images)
├── routes/         # Route definitions
├── services/       # Business logic
├── views/          # EJS templates
├── app.js          # Main app entry point
└── package.json
```

---

## ⚙️ Installation & Setup

### 1. Clone repository

```bash
git clone https://github.com/pratamasandi66471-ops/coffee-shop.git
cd coffee-shop
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Buat file `.env` di root project:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=coffee_shop
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_secret_key
```

---

### 4. Run application

```bash
npm start
```

Buka di browser:

```
http://localhost:3000
```

---

## 🧪 Testing Database

Gunakan file berikut untuk test koneksi:

```bash
node test-db.js
```

---

## 📌 Notes

* Folder `node_modules/` tidak disertakan di repo
* File `.env` tidak di-upload demi keamanan
* Pastikan MySQL sudah berjalan sebelum menjalankan app

---

## 🔥 Future Improvements

* Payment gateway integration (Midtrans/Xendit)
* Better UI/UX
* API versioning
* Deployment (Railway / Render)

---

## 👨‍💻 Author

Developed by **Pratama Sandi**

---

## ⭐ Support

Jika project ini membantu, jangan lupa kasih ⭐ di repository!

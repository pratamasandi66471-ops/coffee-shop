const Product = require("../model/product");

function parsePrice(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
}

function sanitizeImageName(filename) {
  const value = String(filename || "").trim();
  if (!value) return null;

  // Hanya izinkan nama file sederhana untuk mencegah path traversal.
  if (!/^[a-zA-Z0-9._\-() ]+\.(jpg|jpeg|png|webp)$/i.test(value)) {
    return null;
  }

  if (value.includes("/") || value.includes("\\")) {
    return null;
  }

  return value;
}

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.getAll();
    res.render("menu", {
      products,
      successMessage: req.query.status === "created" ? "Menu baru berhasil ditambahkan." : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error mengambil data produk");
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.getById(req.params.id);
    if (!product) {
      return res.status(404).send("Produk tidak ditemukan");
    }
    res.json(product);
  } catch (error) {
    res.status(500).send("Terjadi kesalahan pada server");
  }
};

exports.getCreateProductPage = (req, res) => {
  res.render("admin-product-create", {
    formData: {
      name: "",
      description: "",
      price: "",
      image: "",
    },
    errorMessage: null,
    successMessage: null,
  });
};

exports.createProduct = async (req, res) => {
 const wantsJson = req.headers.accept?.includes("application/json");

  console.log("createProduct request body:", req.body);
  console.log("createProduct request file:", req.file);
  console.log("🔥 CONTROLLER BARU AKTIF 🔥");

  const rawName = String(req.body?.name || "");
  const rawDescription = String(req.body?.description || "");
  const rawPrice = String(req.body?.price || "");
  const fileName = req.file?.filename;

  const name = rawName.trim();
  const description = rawDescription.trim();
  const price = parsePrice(rawPrice);
  const image = fileName || null;

  const formData = {
    name,
    description,
    price: rawPrice,
    image: image ?? "",
  };

  if (!name || !description || !price || !image) {
    const validationError = [];
    if (!name) validationError.push("Nama menu harus diisi.");
    if (!description) validationError.push("Deskripsi harus diisi.");
    if (!price) validationError.push("Harga harus angka positif.");
    if (!image) validationError.push("Gambar harus diunggah dan valid.");

    console.warn("createProduct validation failed", {
      name: rawName,
      description: rawDescription,
      price: rawPrice,
      file: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      } : null,
      errors: validationError,
    });

    const message = validationError.join(" ") ||
      "Data tidak valid. Pastikan semua field terisi dengan benar.";

    if (wantsJson) {
      return res.status(400).json({ success: false, message, errors: validationError });
    }

    return res.status(400).render("admin-product-create", {
      formData,
      errorMessage: message,
      successMessage: null,
    });
  }

  try {
    await Product.create({
      name,
      description,
      price,
      image,
    });

    if (wantsJson) {
      return res.status(201).json({
        success: true,
        message: "Menu baru berhasil ditambahkan.",
      });
    }

    return res.redirect("/products?status=created");
  } catch (error) {
    console.error("createProduct failed", {
      body: req.body,
      file: req.file,
      stack: error.stack,
    });

    const message = "Gagal menambahkan menu. Silakan coba lagi.";

    if (wantsJson) {
      return res.status(500).json({ success: false, message });
    }

    return res.status(500).render("admin-product-create", {
      formData,
      errorMessage: message,
      successMessage: null,
    });
  }
};

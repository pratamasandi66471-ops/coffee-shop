const User = require("../model/user");
const bcrypt = require("bcryptjs");

exports.register = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name || !email || !password) {
    return res.status(400).send("Nama, email, dan password wajib diisi.");
  }

  if (password.length < 8) {
    return res.status(400).send("Password minimal 8 karakter.");
  }

  try {
    // 1. Hash password (keamanan)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Simpan ke database via Model
    await User.create(name, email, hashedPassword);

    // 3. Redirect ke halaman login setelah sukses
    res.redirect("/login");
  } catch (error) {
    console.error(error);
    res.status(500).send("Gagal mendaftar. Email mungkin sudah terdaftar.");
  }
};

exports.login = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).send("Email dan password wajib diisi.");
  }

  try {
    const user = await User.findByEmail(email);
    if (!user) return res.status(401).send("Email tidak ditemukan.");

    // Bandingkan password input dengan password di database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send("Password salah.");

    // Regenerate session untuk mencegah session fixation.
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        return res.status(500).send("Terjadi kesalahan saat login.");
      }

      req.session.userId = user.id;
      req.session.userName = user.name;
      req.session.role = user.role;
      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError);
          return res.status(500).send("Terjadi kesalahan saat login.");
        }
        return res.redirect("/");
      });
    });
  } catch (error) {
    res.status(500).send("Terjadi kesalahan saat login.");
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
};

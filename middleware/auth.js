module.exports = (req, res, next) => {
  // Memeriksa apakah ada userId di dalam session
  if (req.session && req.session.userId) {
    // Jika ada, "Satpam" mempersilakan lanjut ke fungsi berikutnya
    return next();
  }

  // Jika tidak ada, "Satpam" mengusir user kembali ke halaman login
  res.redirect("/login");
};

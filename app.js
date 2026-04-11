require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");
const csrfMiddleware = require("./middleware/csrf");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
  }),
);
app.use("/images", express.static(path.join(__dirname, "public", "image")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "kopi-rahasia-99",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "strict",
      secure: isProduction,
      maxAge: 3600000,
    },
  }),
);

app.use((req, res, next) => {
  res.locals.user = req.session?.userName || null;
  res.locals.role = req.session?.role || null;
  res.locals.requestPath = req.path;
  next();
});

app.use(csrfMiddleware.attachToken);
//app.use(csrfMiddleware.protect);

app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.status(204).end();
});

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/product");
const orderRoutes = require("./routes/order");

app.use("/", authRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);

app.get("/", (req, res) => {
  res.render("home");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server nyala di http://localhost:${PORT}`);
});

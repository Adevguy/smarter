require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const app = express();
const port = 3000;
const categories = require("./data.js");
const { sendEmail } = require("./emailHandler.js");
const translations = require("./translations.js");

// Trust proxy for production environments
app.set("trust proxy", 1);

// Middleware to parse JSON bodies
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true })); // to parse form data
app.set("views", __dirname + "/views");

// Session middleware with MongoDB store
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl:
        process.env.MONGODB_URI || "mongodb://localhost:27017/smarter-sessions",
      touchAfter: 24 * 3600, // lazy session update
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production", // true in production with HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  })
);
// Sample route
app.use((req, res, next) => {
  res.locals.url = req.url;
  // Set default language if not set
  if (!req.session.language) {
    req.session.language = "ar"; // default to Arabic
  }
  res.locals.lang = req.session.language;
  res.locals.t = translations[req.session.language];
  next();
});

// Language switching route
app.get("/switch-language/:lang", (req, res) => {
  const lang = req.params.lang;
  if (lang === "ar" || lang === "en") {
    req.session.language = lang;
  }
  
  // Handle special case for products pages
  const referer = req.get("Referer") || "/";
  const productsMatch = referer.match(/\/products\/(.+)$/);
  
  if (productsMatch) {
    // Extract the category from the URL
    const categoryFromUrl = decodeURIComponent(productsMatch[1]);
    
    // Convert category to the new language
    let newCategoryName = categoryFromUrl;
    if (categoryMap[categoryFromUrl]) {
      newCategoryName = categoryMap[categoryFromUrl];
    }
    
    // Redirect to the products page with the translated category name
    res.redirect(`/products/${encodeURIComponent(newCategoryName)}`);
  } else {
    // For other pages, redirect back to the referring page or home
    res.redirect(referer);
  }
});
app.get("/", (req, res) => {
  res.render("home", { title: "Home" });
});
app.get("/contact", (req, res) => {
  const lang = req.session.language || "ar";
  const categoriesNames = Object.keys(categories[lang]).map((key) => {
    const category = categories[lang][key];
    return {
      name: key, // Arabic/English name from the object
      description: category.description || "", // optional field
    };
  });
  const products = categoriesNames.map((cat) => cat.name);
  res.render("contact", { title: "Contact Us", products });
});
app.get("/about", (req, res) => {
  res.render("about", { title: "About Us" });
});
app.get("/categories", (req, res) => {
  const lang = req.session.language || "ar";
  const uniqueCategories = Object.keys(categories[lang]).map((key) => {
    const category = categories[lang][key];
    
    // Get the Arabic category name for image naming
    let arabicCategoryName;
    if (lang === "ar") {
      // Already in Arabic
      arabicCategoryName = key;
    } else {
      // Convert from English to Arabic using categoryMap
      arabicCategoryName = categoryMap[key] || key;
    }
    
    // Set image based on Arabic category name
    let categoryImage;
    if(category.image === undefined || category.image === ""){
      categoryImage = `/category_images/${arabicCategoryName}.png`;
    } else {
      categoryImage = `/category_images/${arabicCategoryName}.png`;
    }
    
    return {
      // the object key, e.g. "paperCupsSingleLayer"
      name: key, // Arabic/English name from the object
      description: category.description || "", // optional field
      image: categoryImage, // image based on Arabic category name
    };
  });
  res.render("categories", {
    title: "Categories",
    categories: uniqueCategories,
  });
});

const categoryMap = {
  // English to Arabic
  "Paper Cups": "أكواب ورقية",
  "Cup Lids": "أغطية الأكواب",
  "Paper Cup Holders": "حاملات الأكواب الورقية",
  "Paper Bowls": "أوعية ورقية",
  "Paper Plates": "أطباق ورقية",
  "Paper Boxes": "علب ورقية",
  "Sugar Cane Boxes": "علب قصب السكر",
  "Flat Lids": "أغطية مسطحة",
  "Plastic Cups": "أكواب بلاستيكية",
  "Plastic Containers & Jars": "عبوات بلاستيكية و برطمانات",
  "Microwave Containers": "عبوات ميكروويف",
  "Paper Bags": "أكياس ورقية",
  "Dinnerware Sets": "أطقم المائدة",
  "Cake Stands": "قواعد الكيك",
  "Cafe Supplies": "مستلزمات الكافيه",
  "Aluminum Foil": "ورق ألومنيوم",
  "Wooden & Plastic Cutlery": "مستلزمات الكافيه",
  
  // Arabic to English
  "أكواب ورقية": "Paper Cups",
  "أغطية الأكواب": "Cup Lids",
  "حاملات الأكواب الورقية": "Paper Cup Holders",
  "أوعية ورقية": "Paper Bowls",
  "أطباق ورقية": "Paper Plates",
  "علب ورقية": "Paper Boxes",
  "علب قصب السكر": "Sugar Cane Boxes",
  "أغطية مسطحة": "Flat Lids",
  "أكواب بلاستيكية": "Plastic Cups",
  "عبوات بلاستيكية و برطمانات": "Plastic Containers & Jars",
  "عبوات ميكروويف": "Microwave Containers",
  "أكياس ورقية": "Paper Bags",
  "أطقم المائدة": "Dinnerware Sets",
  "قواعد الكيك": "Cake Stands",
  "مستلزمات الكافيه": "Cafe Supplies",
  "ورق ألومنيوم": "Aluminum Foil",
  "مستلزمات الوقايه": "Wooden & Plastic Cutlery"
};

app.get("/products/:category", (req, res) => {
  const lang = req.session.language || "ar";
  const category = req.params.category;

  // Convert category name to match current language
  let categoryKey = category;
  if (categoryMap[category]) {
    categoryKey = categoryMap[category];
  }

  // Try to find category in current language first
  let categoryData = categories[lang] && categories[lang][categoryKey];

  // If not found, try the original category name
  if (!categoryData) {
    categoryData = categories[lang] && categories[lang][category];
  }

  // If still not found in current language, return 404 instead of falling back
  if (!categoryData) {
    return res.status(404).send("Category not found in current language");
  }

  // Handle both array-of-arrays and groups object shape
  let rawGroups;
  if (Array.isArray(categoryData)) {
    rawGroups = categoryData;
  } else if (Array.isArray(categoryData.groups)) {
    rawGroups = categoryData.groups;
  } else {
    return res.status(500).send("Invalid category data format");
  }

  // Transform groups into objects for your template
  const products = rawGroups.map((group, idx) => {
    
    let items = Array.isArray(group)
      ? group
      : Array.isArray(group.products)
      ? group.products
      : [];

    const image =
      (group && group.image) ||
      (Array.isArray(categoryData.images) ? categoryData.images[idx] : null) ||
      null;
    
    // Get the type from the current language data
    const productType = group && group.type;
    return {
      type: productType || category,
      image, // can be null
      products: items // Pass all product items with their complete data
    };
  });

  // Use the category key we found for display
  const displayCategoryName = categoryKey || category;
  
  // Ensure category name is displayed in current language
  let localizedCategoryName = displayCategoryName;
  if (lang === "ar") {
    // If current language is Arabic, make sure we show Arabic name
    if (categoryMap[displayCategoryName]) {
      // displayCategoryName is in English, convert to Arabic
      localizedCategoryName = categoryMap[displayCategoryName];
    }
    // If displayCategoryName is already in Arabic, keep it as is
  } else {
    // If current language is English, make sure we show English name
    if (categoryMap[displayCategoryName]) {
      // displayCategoryName is in Arabic, convert to English
      localizedCategoryName = categoryMap[displayCategoryName];
    }
    // If displayCategoryName is already in English, keep it as is
  }
  let header_image = products[0].image
  if(lang === "ar") {
    let number = header_image.match(/\d+/);
    number = number - 17
    header_image = `${number}.png`
  }
  products.shift()
  res.render("products", {
    header_image,
    title: localizedCategoryName || "Products",
    description: categoryData.description || "",
    products,
    category: localizedCategoryName,
  });
});

app.post("/send-email", async (req, res) => {
  const { name, email, phoneNumber, product, message } = req.body;

  try {
    await sendEmail(name, email, phoneNumber, product, message);
    res.redirect("/");
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
});
// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

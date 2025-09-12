require("dotenv").config()

const express = require('express');
const session = require('express-session');
const app = express();
const port = 3000;
const categories = require('./data.js');
const {sendEmail} = require('./emailHandler.js');
const translations = require('./translations.js');
// Middleware to parse JSON bodies
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true })); // to parse form data
app.set("views", __dirname + "/views");

// Session middleware for language persistence
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true if using https
}));
// Sample route
app.use((req, res, next) => {
  res.locals.url = req.url;
  // Set default language if not set
  if (!req.session.language) {
    req.session.language = 'ar'; // default to Arabic
  }
  res.locals.lang = req.session.language;
  res.locals.t = translations[req.session.language];
  next();
});

// Language switching route
app.get('/switch-language/:lang', (req, res) => {
  const lang = req.params.lang;
  if (lang === 'ar' || lang === 'en') {
    req.session.language = lang;
  }
  // Redirect back to the referring page or home
  const referer = req.get('Referer') || '/';
  res.redirect(referer);
});
app.get('/', (req, res) => {
  res.render('home', { title: 'Home' });
});
app.get("/contact", (req, res) => {
  const lang = req.session.language || 'ar';
  const categoriesNames = Object.keys(categories[lang]).map(key => {
    const category = categories[lang][key];
    return {
      name: key, // Arabic/English name from the object
      description: category.description || "" // optional field
    };
  });
  const products = categoriesNames.map(cat => cat.name);
  res.render("contact", { title: "Contact Us", products });
});
app.get("/about", (req, res) => {
  res.render("about", { title: "About Us" });
});
app.get("/categories", (req, res) => {
  const lang = req.session.language || 'ar';
  const uniqueCategories = Object.keys(categories[lang]).map(key => {
    const category = categories[lang][key];
    return {
      // the object key, e.g. "paperCupsSingleLayer"
      name: key, // Arabic/English name from the object
      description: category.description || "" // optional field
    };
  });
  res.render("categories", { 
    title: "Categories", 
    categories: uniqueCategories 
  });
});


const categoryMap = {
  // English to Arabic
  "PaperCups (single layer)": "أكواب ورقية (طبقة واحدة)",
  "PaperCups (double)": "أكواب ورقية (مزدوجة)",
  "PaperCups (double corrugated)": "أكواب ورقية (مزدوجة مموجة)",
  "PaperCupLids": "أغطية الأكواب الورقية",
  // Arabic to English  
  "أكواب ورقية (طبقة واحدة)": "PaperCups (single layer)",
  "أكواب ورقية (مزدوجة)": "PaperCups (double)",
  "أكواب ورقية (مزدوجة مموجة)": "PaperCups (double corrugated)",
  "أغطية الأكواب الورقية": "PaperCupLids"
};

app.get("/products/:category", (req, res) => {
  const lang = req.session.language || 'ar';
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
  
  // If still not found, try the other language and map it
  if (!categoryData) {
    const otherLang = lang === 'ar' ? 'en' : 'ar';
    categoryData = categories[otherLang] && categories[otherLang][category];
    if (!categoryData && categoryMap[category]) {
      categoryData = categories[otherLang] && categories[otherLang][categoryMap[category]];
    }
  }

  if (!categoryData) {
    return res.status(404).send("Category not found");
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
    const items = Array.isArray(group)
      ? group
      : Array.isArray(group.products)
      ? group.products
      : [];

    const image =
      (group && group.image) ||
      (Array.isArray(categoryData.images) ? categoryData.images[idx] : null) ||
      null;

    return {
      type: category,
      material: items[0]?.rawMaterial || "N/A",
      quantity: items[0]?.piece || "N/A",
      cartoonSize: items[0]?.carton || "N/A",
      size: items.map(p => p.volume),
      id: items.map(p => p.itemNumber),
      packing: items.map(p => p.packing),
      image // can be null
    };
  });
  res.render("products", {
    title: category || "Products",
    description: categoryData.description || "",
    products,
    category
  });
});


app.post("/send-email", async (req, res) => {
  const { name, email, phoneNumber, product, message } = req.body;

  try {
    await sendEmail(name, email, phoneNumber, product, message);
    res.redirect("/")
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
});
// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
require("dotenv").config()

const express = require('express');
const app = express();
const port = 3000;
const categories = require('./data.js');
const {sendEmail} = require('./emailHandler.js');
// Middleware to parse JSON bodies
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true })); // to parse form data
app.set("views", __dirname + "/views");
// Sample route
app.use((req, res, next) => {
  res.locals.url = req.url
  next();
});
app.get('/', (req, res) => {
  res.render('home', { title: 'Home' });
});
app.get("/contact", (req, res) => {
  const categoriesNames = Object.keys(categories.ar).map(key => {
    const category = categories.ar[key];
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
  const uniqueCategories = Object.keys(categories.en).map(key => {
    const category = categories.en[key];
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
  "PaperCups (single layer)": "أكواب ورقية (طبقة واحدة)",
  "PaperCups (double)": "أكواب ورقية (مزدوجة)",
  "PaperCups (double corrugated)": "أكواب ورقية (مزدوجة مموجة)",
  "PaperCupLids": "أغطية الأكواب الورقية"
};

app.get("/products/:category", (req, res) => {
  const lang = "ar"; // or "en" depending on user/session
  const category = req.params.category;

  // Convert to Arabic key if needed
  let categoryKey = category;
  if (lang === "ar" && categoryMap[category]) {
    categoryKey = categoryMap[category];
  }

  const categoryData = categories[lang] && categories[lang][categoryKey];

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
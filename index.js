const express = require("express");
const paypal = require("paypal-rest-sdk");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use(session({
    secret: 'elchanguito-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use((req, res, next) => {
    res.locals.devMode = req.session.devMode || false;
    next();
});

const requireDevMode = (req, res, next) => {
    if (!req.session.devMode) {
        return res.redirect('/profile');
    }
    next();
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------

mongoose.connect('mongodb://localhost:27017/elchanguito')
  .then(() => {
    console.log('Connected to MongoDB');})
  .catch(err => {
    console.error('MongoDB connection error:', err);});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true }
});

productSchema.methods.getFormattedPrice = function() {
    return `$${this.price.toFixed(2)}`;
};
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'pending'
    },
    paymentId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

orderSchema.methods.getFormattedAmount = function() {
    return `$${this.amount.toFixed(2)}`;
};

const Order = mongoose.model('Order', orderSchema);

// ------------------------------------------------------------

paypal.configure({
  mode: "sandbox",
  client_id: "ATn5fZRAzklQiD1k_fmcRVUbO_zeXQ98iuLpA-fmzRJZZj8nJGzxPzWgiTzJcrfZXLRXCqP4pHxqFn5T",
  client_secret: "EHi3LOvkPy4MUZCPX6xgDqIoBLMPHzE6p2xzLW1mMtQgNmPWCMo6XrA5ZZauOb7QiKnYFC0zZVRG925T",
});

// ------------------------------------------------------------

// Home page 
app.get("/", (req, res) => {
    res.render("index");
});

// Products page
app.get("/products", async (req, res) => {
    try {
        const products = await Product.find();
        console.log('All products:', products.map(p => ({ id: p._id, name: p.name })));
        res.render("products", { products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.render("products", { products: [] });
    }
});

// "Add product" page
app.get("/add-product", requireDevMode, (req, res) => {
    res.render("add-product");
});

// Add product form 
app.post("/add-product", requireDevMode, async (req, res) => {
    try {
        const { name, description, price, image } = req.body;
        const newProduct = new Product({
            name,
            description,
            price: parseFloat(price),
            image
        });
        
        await newProduct.save();
        
        res.redirect("/products");
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send('Error adding product');
    }
});

// Edit product page
app.get("/edit-product/:id", requireDevMode, async (req, res) => {
    try {
        console.log('Fetching product with ID:', req.params.id);
        
        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.log('Invalid product ID format');
            return res.status(400).send("Invalid product ID format");
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            console.log('Product not found');
            return res.status(404).send("Product not found");
        }
        console.log('Found product:', product);
        res.render("edit-product", { product });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Error fetching product: ' + error.message);
    }
});

// Update product route
app.post("/edit-product/:id", requireDevMode, async (req, res) => {
    try {
        console.log('Updating product with ID:', req.params.id);
        console.log('Update data:', req.body);
        
        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.log('Invalid product ID format');
            return res.status(400).send("Invalid product ID format");
        }
        
        const { name, description, price, image } = req.body;
        
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                name,
                description,
                price: parseFloat(price),
                image
            },
            { new: true, runValidators: true }
        );
        
        if (!updatedProduct) {
            console.log('Product not found for update');
            return res.status(404).send("Product not found");
        }
        
        console.log('Product updated successfully:', updatedProduct);
        res.redirect("/products");
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).send('Error updating product: ' + error.message);
    }
});

// Delete product route
app.post("/delete-product/:id", requireDevMode, async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        
        if (!deletedProduct) {
            return res.status(404).send("Product not found");
        }
        
        res.redirect("/products");
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send('Error deleting product');
    }
});

// PayPal payment
app.post("/pay", async (req, res) => {
    try {
        const { productId, price } = req.body;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).send("Product not found");
        }

        const create_payment_json = {
            intent: "sale",
            payer: {
                payment_method: "paypal",
            },
            redirect_urls: {
                return_url: `http://localhost:5000/success?productId=${productId}`,
                cancel_url: `http://localhost:5000/cancel?productId=${productId}`,
            },
            transactions: [
                {
                    amount: {
                        currency: "USD",
                        total: product.price.toFixed(2),
                    },
                    description: `Payment for ${product.name}`,
                },
            ],
        };

        paypal.payment.create(create_payment_json, (error, payment) => {
            if (error) {
                console.log(error);
                res.send("Error creating payment");
            } else {
                for (let i = 0; i < payment.links.length; i++) {
                    if (payment.links[i].rel === "approval_url") {
                        res.redirect(payment.links[i].href);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).send('Error processing payment');
    }
});

// Orders page
app.get("/orders", async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('product')
            .sort({ createdAt: -1 });
        res.render("orders", { orders, devMode: req.session.devMode || false });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.render("orders", { orders: [], devMode: req.session.devMode || false });
    }
});

app.get("/success", async (req, res) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;
    const productId = req.query.productId;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found");
        }

        const execute_payment_json = {
            payer_id: payerId,
            transactions: [
                {
                    amount: {
                        currency: "USD",
                        total: product.price.toFixed(2),
                    },
                },
            ],
        };

        paypal.payment.execute(paymentId, execute_payment_json, async (error, payment) => {
            if (error) {
                console.log(error);
                res.send("Payment failed");
            } else {
                // Create order record
                const order = new Order({
                    product: productId,
                    amount: product.price,
                    status: 'completed',
                    paymentId: paymentId
                });
                await order.save();

                res.redirect("/orders");
            }
        });
    } catch (error) {
        console.error('Error processing payment success:', error);
        res.status(500).send('Error processing payment success');
    }
});

app.get("/cancel", async (req, res) => {
    const paymentId = req.query.paymentId;
    const productId = req.query.productId;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found");
        }

        // Create cancelled order for order history
        const order = new Order({
            product: productId,
            amount: product.price,
            status: 'cancelled',
            paymentId: paymentId
        });
        await order.save();

        res.redirect("/orders");
    } catch (error) {
        console.error('Error processing payment cancellation:', error);
        res.status(500).send('Error processing payment cancellation');
    }
});

// Profile page
app.get("/profile", (req, res) => {
    res.render("mode-select", { devMode: req.session.devMode || false });
});

app.post("/set-mode", (req, res) => {
    const { mode } = req.body;
    req.session.devMode = mode === 'dev';
    res.redirect('/products');
});

// Settings page (I don't actually have any settings but it looks better in the dropdown menu)
app.get("/settings", (req, res) => {
    res.render("coming-soon", { devMode: req.session.devMode || false });
});

// Product details page
app.get("/product/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).send("Invalid product ID format");
        }

        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).send("Product not found");
        }
        res.render("product", { product, devMode: req.session.devMode || false });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Error fetching product: ' + error.message);
    }
});

// Coming Soon page
app.get("/coming-soon", (req, res) => {
    res.render("coming-soon", { devMode: req.session.devMode || false });
});

// Catch-all route for 404
app.use((req, res) => {
    res.status(404).render("404");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

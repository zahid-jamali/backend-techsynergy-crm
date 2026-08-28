const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./configs/conn.js");
const userRoutes = require("./routes/userRoutes.js");
const accountRoutes = require("./routes/accountRoutes.js");
const contactRoutes = require("./routes/contactRoutes");
const dealRoutes = require("./routes/dealRoutes");
const quoteRoutes = require("./routes/quoteRoutes");
const productRoutes = require("./routes/productRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const poToVendorRoutes = require("./routes/poToVendorRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const salesTargetRoutes = require("./routes/salesTargetRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const orderRoutes = require("./routes/orderRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const financeRoutes = require("./routes/financeRoutes");
const ledgerRoutes = require("./routes/ledgerRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const priceQueryRoutes = require("./routes/priceQueryRoutes");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
dotenv.config();
connectDB();

app.use("/api/user/", userRoutes);
app.use("/api/account/", accountRoutes);
app.use("/api/contact/", contactRoutes);
app.use("/api/deals/", dealRoutes);
app.use("/api/quotes/", quoteRoutes);
app.use("/api/products/", productRoutes);
app.use("/api/vendors/", vendorRoutes);
app.use("/api/potovendor/", poToVendorRoutes);
app.use("/api/invoice/", invoiceRoutes);
app.use("/api/sales-target/", salesTargetRoutes);
app.use("/api/dashboard/", dashboardRoutes);
app.use("/api/orders/", orderRoutes);
app.use("/api/deliveries/", deliveryRoutes);
app.use("/api/finance/", financeRoutes);
app.use("/api/finance/", ledgerRoutes);
app.use("/api/workspace/", workspaceRoutes);
app.use("/api/price-queries/", priceQueryRoutes);

// for static PO rendering
// app.use('/uploads', express.static('uploads'));

app.get("/health", (req, res) => {
  res.json({
    message: "API is running",
  });
});

// const port = process.env.PORT || 2222;
// console.log(`Server is running on ${port}`);
// app.listen(port);

module.exports = app;

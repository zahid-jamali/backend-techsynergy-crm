const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./configs/conn.js');
const userRoutes = require('./routes/userRoutes.js');
const accountRoutes = require('./routes/accountRoutes.js');
const contactRoutes = require('./routes/contactRoutes');
const dealRoutes = require('./routes/dealRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const productRoutes = require('./routes/productRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const poToVendorRoutes = require('./routes/poToVendorRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const salesTargetRoutes = require('./routes/salesTargetRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
dotenv.config();
connectDB();

app.use('/api/user/', userRoutes);
app.use('/api/account/', accountRoutes);
app.use('/api/contact/', contactRoutes);
app.use('/api/deals/', dealRoutes);
app.use('/api/quotes/', quoteRoutes);
app.use('/api/products/', productRoutes);
app.use('/api/vendors/', vendorRoutes);
app.use('/api/potovendor/', poToVendorRoutes);
app.use('/api/invoice/', invoiceRoutes);
app.use('/api/sales-target', salesTargetRoutes);
app.use('/api/dashboard', dashboardRoutes);

const port = process.env.PORT || 2222;
console.log(`Server is running on ${port}`);
app.listen(port);

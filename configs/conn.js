const mongoose = require('mongoose');

const connectDB = async () => {
	try {
		const url = process.env.MONGODB_URI;

		if (!url) {
			throw new Error('MONGODB_URI is not defined in .env');
		}

		const conn = await mongoose.connect(url);

		console.log(`✅ MongoDB connected: ${conn.connection.host}`);
		return conn;
	} catch (error) {
		console.error('❌ MongoDB connection failed:', error.message);
		process.exit(1);
	}
};

module.exports = connectDB;

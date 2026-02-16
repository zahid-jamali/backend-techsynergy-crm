const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const cloudinary = require('../configs/cloudinary.js');

const storage = new CloudinaryStorage({
	cloudinary,
	params: {
		folder: 'techsynergy',
		resource_type: 'auto',
		allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
	},
});

const uploadPO = multer({ storage });

module.exports = uploadPO;

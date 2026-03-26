const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const cloudinary = require('../configs/cloudinary.js');

const storage = new CloudinaryStorage({
	cloudinary,
	params: async (req, file) => {
		const ext = path.extname(file.originalname);

		const name = path.basename(file.originalname, ext);
		console.log(`ext: ${ext} - name: ${name}`);
		return {
			folder: 'techsynergy',

			resource_type: 'raw',

			format: ext.replace('.', ''),

			public_id: `SO-${Date.now()}`, //`SO-${Date.now()}${ext}`

			allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
		};
	},
});

const uploadPO = multer({ storage });

module.exports = uploadPO;

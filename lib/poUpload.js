const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../configs/cloudinary');

const storage = new CloudinaryStorage({
	cloudinary,
	params: async (_req, file) => {
		const isPdf = file.mimetype === 'application/pdf';

		return {
			folder: 'techsynergy-crm',
			resource_type: isPdf ? 'raw' : 'image',
			allowed_formats: isPdf ? ['pdf'] : ['png', 'jpg', 'jpeg'],
			public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
		};
	},
});

const fileFilter = (req, file, cb) => {
	const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error('Only PDF or Image files allowed'));
	}
};

const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024,
	},
});

module.exports = upload;

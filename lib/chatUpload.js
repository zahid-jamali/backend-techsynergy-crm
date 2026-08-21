const path = require('path');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../configs/cloudinary');

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const ALLOWED_EXT = new Set([
	'png',
	'jpg',
	'jpeg',
	'webp',
	'gif',
	'pdf',
	'doc',
	'docx',
	'xls',
	'xlsx',
	'csv',
	'txt',
]);

const fileExt = (file) =>
	path.extname(file.originalname || '').replace('.', '').toLowerCase();

const storage = new CloudinaryStorage({
	cloudinary,
	params: async (_req, file) => {
		const ext = fileExt(file);
		const isImage =
			(file.mimetype || '').startsWith('image/') && IMAGE_EXTS.has(ext || 'jpg');

		return {
			folder: 'techsynergy-crm/price-queries',
			resource_type: isImage ? 'image' : 'raw',
			public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
			format: ext || undefined,
		};
	},
});

const fileFilter = (req, file, cb) => {
	const ext = fileExt(file);
	if (ALLOWED_EXT.has(ext) || (file.mimetype || '').startsWith('image/')) {
		cb(null, true);
		return;
	}
	cb(
		new Error(
			'File type not allowed. Use images, PDF, Word, Excel, CSV or TXT.'
		)
	);
};

const upload = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 3 * 1024 * 1024,
		files: 3,
	},
});

const handleChatUpload = (req, res, next) => {
	upload.array('files', 3)(req, res, (err) => {
		if (!err) return next();
		return res.status(400).json({
			success: false,
			msg: err.message || 'File upload failed',
		});
	});
};

module.exports = { upload, handleChatUpload, IMAGE_EXTS };

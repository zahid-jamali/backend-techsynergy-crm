const uploadedFile = (file) => {
	if (!file) return undefined;

	return {
		public_id: file.filename,
		url: file.path,
		originalName: file.originalname,
	};
};

module.exports = uploadedFile;

const path = require('path');
const { pathToFileURL } = require('url');

const sendPdf = async (res, documentName, props, filename) => {
	const [{ renderToBuffer }, { createElement }, { default: Component }] =
		await Promise.all([
			import('@react-pdf/renderer'),
			import('react'),
			import(pathToFileURL(path.join(__dirname, `${documentName}.mjs`)).href),
		]);

	const element = createElement(Component, props);
	const buffer = await renderToBuffer(element);
	const payload = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

	res.set({
		'Content-Type': 'application/pdf',
		'Content-Disposition': `attachment; filename="${filename}"`,
		'Content-Length': payload.length,
	});

	return res.send(payload);
};

module.exports = { sendPdf };

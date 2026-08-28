const cleanPart = (value, max = 56) =>
	String(value || '')
		.trim()
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
		.replace(/\s+/g, ' ')
		.slice(0, max);

const buildQuoteDownloadName = (quote, ext = 'pdf', prefix = '') => {
	const parts = [
		quote?.quoteNumber ? `Q-${quote.quoteNumber}` : null,
		cleanPart(quote?.subject),
		cleanPart(quote?.account?.accountName || quote?.account),
	].filter(Boolean);

	let base = parts.length ? parts.join(' - ') : 'quotation';
	if (prefix) base = `${prefix} - ${base}`;
	base = base.replace(/[<>:"/\\|?*]/g, '-');
	return `${base}.${ext}`;
};

module.exports = { buildQuoteDownloadName, cleanPart };

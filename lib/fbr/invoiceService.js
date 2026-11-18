const { SALE_TYPES, TEST_BUYERS, scenarioFor, guessProvince } = require('./scenarios');
const { computeLine, sumLines, round2 } = require('./tax');
const client = require('./client');
const config = require('./config');
const FbrSubmission = require('../../models/FbrSubmission');

const pktDate = (d = new Date()) =>
	new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

const presetFor = (key) => SALE_TYPES[key] || SALE_TYPES.standard;

/** Detect a sale-type preset from the sell order's tax lines. */
const presetFromOrder = (order) => {
	const taxes = order.Tax?.length ? order.Tax : order.otherTax || [];
	const pct = taxes.reduce((m, t) => Math.max(m, Number(t.percent) || 0), 0);
	if (pct === 0 && taxes.length) return 'zero';
	return 'standard';
};

const addressLine = (a = {}) =>
	[a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ');

/** Draft invoice fields derived from a delivered sell order. */
const draftFromOrder = (order) => {
	const quote = order.finalQuote || {};
	const account = quote.account || {};
	const contact = quote.contact || {};
	const remembered = account.meta?.get ? account.meta.get('fbrBuyer') : account.meta?.fbrBuyer;
	const billing = account.billingAddress || {};
	const preset = presetFor(remembered?.saleTypeKey || presetFromOrder(order));

	const buyer = {
		businessName: account.accountName || '',
		ntnCnic: remembered?.ntnCnic || '',
		strn: remembered?.strn || '',
		registrationType: remembered?.registrationType || 'Unregistered',
		province: remembered?.province || guessProvince(`${billing.state || ''} ${billing.city || ''}`),
		address: remembered?.address || addressLine(billing),
		contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
		phone: contact.phone || account.phone || '',
		email: contact.email || '',
	};

	const lines = (order.products || []).map((p) => ({
		productName: p.productName,
		description: p.description || '',
		hsCode: '',
		uoM: 'Numbers, pieces, units',
		quantity: Number(p.quantity) || 1,
		unitPrice: Number(p.listPrice) || 0,
		discount: 0,
	}));

	return {
		buyer,
		tax: {
			saleTypeKey: preset.key,
			saleType: preset.saleType,
			rate: preset.rate,
			sroScheduleNo: preset.sroScheduleNo,
			sroItemSerialNo: preset.sroItemSerialNo,
			extraTaxBlank: Boolean(preset.extraTaxBlank),
			furtherTaxPercent: 0,
			retailToEndConsumer: false,
		},
		lines,
	};
};

/** Recalculate every line + totals in place. */
const recompute = (invoice) => {
	const tax = invoice.tax || {};
	invoice.lines = (invoice.lines || []).map((l) => {
		const src = typeof l.toObject === 'function' ? l.toObject() : l;
		const calc = computeLine(src, {
			rate: tax.rate,
			saleType: tax.saleType,
			furtherTaxPercent: tax.furtherTaxPercent,
			extraTax: src.extraTax,
			fedPayable: src.fedPayable,
			salesTaxWithheldAtSource: src.salesTaxWithheldAtSource,
		});
		return { ...src, ...calc };
	});
	const t = sumLines(invoice.lines);
	Object.keys(t).forEach((k) => (t[k] = round2(t[k])));
	invoice.totals = t;
	invoice.subtotal = t.valueExclST;
	invoice.grandTotal = t.total;
	return invoice;
};

/** Apply a preset key, keeping any explicit overrides passed in. */
const applyPreset = (tax = {}, key) => {
	const p = presetFor(key || tax.saleTypeKey);
	return {
		...tax,
		saleTypeKey: p.key,
		saleType: p.saleType,
		rate: tax.rate || p.rate,
		sroScheduleNo: tax.sroScheduleNo ?? p.sroScheduleNo,
		sroItemSerialNo: tax.sroItemSerialNo ?? p.sroItemSerialNo,
		extraTaxBlank: Boolean(p.extraTaxBlank),
	};
};

const toDoc = (invoice) => {
	const scenarioId = scenarioFor(
		invoice.tax?.saleTypeKey,
		invoice.buyer?.registrationType,
		invoice.tax?.retailToEndConsumer
	);
	return {
		invoiceType: 'Sale Invoice',
		invoiceDate: pktDate(invoice.documentDate || new Date()),
		buyer: invoice.buyer,
		invoiceRefNo: '',
		scenarioId,
		tax: invoice.tax,
		exchangeRate: invoice.currency === 'USD' ? invoice.exchangeRate : 1,
		lines: (invoice.lines || []).map((l) => ({
			...(typeof l.toObject === 'function' ? l.toObject() : l),
			productDescription: [l.productName, l.description].filter(Boolean).join(' - '),
		})),
	};
};

/**
 * Validate or post an invoice-like doc to FBR and log the attempt.
 * Returns { result, payload, errors? }.
 */
const transmit = async ({ mode, doc, invoiceId, userId, source = 'invoice' }) => {
	const payload = client.buildPayload(doc);
	const errors = client.preflight(payload);
	if (errors.length) {
		return { payload, errors, result: { ok: false, error: errors.join('; ') } };
	}
	const started = Date.now();
	const { result, raw } = await client.send(mode, payload);
	await FbrSubmission.create({
		invoice: invoiceId,
		scenarioId: payload.scenarioId || doc.scenarioId,
		source,
		mode,
		environment: config.env(),
		ok: result.ok,
		httpStatus: result.httpStatus,
		irn: result.irn,
		dated: result.dated,
		statusCode: result.statusCode,
		errorCode: result.errorCode,
		error: result.error,
		itemErrors: result.itemErrors,
		request: payload,
		response: raw,
		durationMs: Date.now() - started,
		createdBy: userId,
	}).catch((e) => console.error('FBR log write failed:', e.message));
	return { payload, result };
};

/** Self-contained sandbox test invoice for one of the assigned scenarios. */
const scenarioDoc = (scenario) => {
	const preset = { ...SALE_TYPES[scenario.saleTypeKey], ...(scenario.saleTypeOverride || {}) };
	const calc = computeLine(scenario.item, { rate: preset.rate, saleType: preset.saleType });
	const buyer = TEST_BUYERS[scenario.buyer];
	return {
		invoiceType: 'Sale Invoice',
		invoiceDate: pktDate(),
		buyer: {
			ntnCnic: buyer.ntnCnic,
			businessName: buyer.name,
			province: config.seller().province || 'Sindh',
			address: 'Karachi',
			registrationType: scenario.buyer,
		},
		invoiceRefNo: '',
		scenarioId: scenario.id,
		tax: preset,
		lines: [{ ...scenario.item, ...calc, productDescription: `Sandbox test item for ${scenario.id}` }],
	};
};

module.exports = { scenarioDoc, draftFromOrder, recompute, applyPreset, toDoc, transmit, pktDate, presetFor };

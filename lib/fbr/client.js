const config = require('./config');
const { round2 } = require('./tax');

const blankIfZero = (v) => (v === '' || v === null || v === undefined ? '' : v);

/**
 * Build the PRAL DI request body from a normalized invoice.
 * Amounts are converted to PKR with `exchangeRate` (FBR only accepts PKR).
 */
const buildPayload = (doc) => {
	const seller = config.seller();
	const fx = Number(doc.exchangeRate) > 0 ? Number(doc.exchangeRate) : 1;
	const pkr = (n) => round2((Number(n) || 0) * fx);
	const tax = doc.tax || {};

	const payload = {
		invoiceType: doc.invoiceType || 'Sale Invoice',
		invoiceDate: doc.invoiceDate,
		sellerNTNCNIC: seller.ntnCnic,
		sellerBusinessName: seller.businessName,
		sellerProvince: seller.province,
		sellerAddress: seller.address,
		buyerNTNCNIC: (doc.buyer?.ntnCnic || '').trim(),
		buyerBusinessName: (doc.buyer?.businessName || '').trim(),
		buyerProvince: doc.buyer?.province || '',
		buyerAddress: (doc.buyer?.address || '').trim(),
		buyerRegistrationType: doc.buyer?.registrationType || 'Unregistered',
		invoiceRefNo: doc.invoiceRefNo || '',
	};

	if (config.env() === 'sandbox' && doc.scenarioId) {
		payload.scenarioId = doc.scenarioId;
	}

	payload.items = (doc.lines || []).map((l) => ({
		hsCode: (l.hsCode || '').trim(),
		productDescription: (l.productDescription || '').trim().slice(0, 500),
		rate: tax.rate,
		uoM: l.uoM,
		quantity: Number(l.quantity) || 0,
		totalValues: pkr(l.total),
		valueSalesExcludingST: pkr(l.valueExclST),
		fixedNotifiedValueOrRetailPrice: pkr(l.fixedNotifiedValue),
		salesTaxApplicable: pkr(l.salesTax),
		salesTaxWithheldAtSource: pkr(l.salesTaxWithheldAtSource),
		extraTax: tax.extraTaxBlank && !Number(l.extraTax) ? '' : pkr(l.extraTax),
		furtherTax: pkr(l.furtherTax),
		sroScheduleNo: blankIfZero(tax.sroScheduleNo),
		fedPayable: pkr(l.fedPayable),
		discount: pkr(l.discount),
		saleType: tax.saleType,
		sroItemSerialNo: blankIfZero(tax.sroItemSerialNo),
	}));

	return payload;
};

/** Local pre-flight checks so finance gets a readable error before calling FBR. */
const preflight = (payload) => {
	const errors = [];
	const s = config.seller();
	if (!config.token()) errors.push(`FBR ${config.env()} token is not configured on the server`);
	if (!s.ntnCnic) errors.push('Seller NTN/CNIC (FBR_SELLER_NTN) is not configured');
	if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.invoiceDate || '')) errors.push('Invoice date must be YYYY-MM-DD');
	if (!payload.buyerBusinessName) errors.push('Buyer business name is required');
	if (!payload.buyerProvince) errors.push('Buyer province is required');
	if (!payload.buyerAddress) errors.push('Buyer address is required');
	if (payload.buyerRegistrationType === 'Registered') {
		const id = payload.buyerNTNCNIC.replace(/-/g, '');
		if (!/^[A-Za-z0-9]{7}$|^\d{13}$/.test(id)) {
			errors.push('Registered buyer needs a 7-digit NTN or 13-digit CNIC');
		}
	} else if (payload.buyerNTNCNIC && !/^[A-Za-z0-9]{7}$|^\d{13}$/.test(payload.buyerNTNCNIC.replace(/-/g, ''))) {
		errors.push('Buyer NTN/CNIC must be 7 (NTN) or 13 (CNIC) digits');
	}
	if (!payload.items.length) errors.push('Invoice has no line items');
	payload.items.forEach((it, i) => {
		const n = i + 1;
		if (!/^\d{4}\.\d{4}$/.test(it.hsCode)) errors.push(`Line ${n}: HS code must look like 0000.0000`);
		if (!it.productDescription) errors.push(`Line ${n}: description is required`);
		if (!it.uoM) errors.push(`Line ${n}: unit of measure is required`);
		if (!(it.quantity > 0)) errors.push(`Line ${n}: quantity must be greater than zero`);
		if (!(it.valueSalesExcludingST > 0)) errors.push(`Line ${n}: value excluding sales tax must be greater than zero`);
	});
	return errors;
};

const parseResponse = (httpStatus, body) => {
	const v = body?.validationResponse || {};
	const items = Array.isArray(v.invoiceStatuses) ? v.invoiceStatuses : [];
	const itemErrors = items
		.filter((s) => s.statusCode && s.statusCode !== '00')
		.map((s) => ({ itemSNo: s.itemSNo, errorCode: s.errorCode, error: s.error }));
	const headerValid = String(v.statusCode) === '00' && /^valid$/i.test(String(v.status || ''));
	const ok = httpStatus === 200 && headerValid && itemErrors.length === 0;
	const firstErr = itemErrors[0];
	return {
		ok,
		httpStatus,
		irn: body?.invoiceNumber || null,
		dated: body?.dated || null,
		statusCode: v.statusCode || null,
		status: v.status || null,
		errorCode: v.errorCode || firstErr?.errorCode || null,
		error: v.error || firstErr?.error || (ok ? '' : `FBR returned HTTP ${httpStatus}`),
		itemErrors,
		itemNumbers: items.map((s) => ({ itemSNo: s.itemSNo, invoiceNo: s.invoiceNo })),
	};
};

const request = async (url, { method = 'GET', body } = {}) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), config.timeoutMs());
	try {
		const res = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${config.token()}`,
				...(body ? { 'Content-Type': 'application/json' } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal,
		});
		const text = await res.text();
		let json = null;
		try {
			json = JSON.parse(text);
		} catch {
			json = { raw: text.slice(0, 2000) };
		}
		return { status: res.status, json };
	} catch (err) {
		const timedOut = err.name === 'AbortError';
		return {
			status: 0,
			json: {
				validationResponse: {
					statusCode: '01',
					status: 'Invalid',
					error: timedOut
						? 'FBR did not respond in time. Please retry.'
						: `Could not reach FBR: ${err.message}`,
				},
			},
		};
	} finally {
		clearTimeout(timer);
	}
};

/** mode: 'validate' | 'post' */
const send = async (mode, payload) => {
	const url = mode === 'post' ? config.urls().post : config.urls().validate;
	const { status, json } = await request(url, { method: 'POST', body: payload });
	return { result: parseResponse(status, json), raw: json, url };
};

const ALLOWED_REFERENCE = {
	provinces: 'v1/provinces',
	doctypecode: 'v1/doctypecode',
	itemdesccode: 'v1/itemdesccode',
	sroitemcode: 'v1/sroitemcode',
	transtypecode: 'v1/transtypecode',
	uom: 'v1/uom',
	SroSchedule: 'v1/SroSchedule',
	SaleTypeToRate: 'v2/SaleTypeToRate',
	HS_UOM: 'v2/HS_UOM',
	SROItem: 'v2/SROItem',
};

const reference = async (name, query = {}) => {
	const path = ALLOWED_REFERENCE[name];
	if (!path) throw new Error('Unknown reference list');
	const qs = new URLSearchParams(
		Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''))
	).toString();
	const { status, json } = await request(`${config.urls().reference}/${path}${qs ? `?${qs}` : ''}`);
	if (status !== 200) throw new Error(`FBR reference API returned ${status}`);
	return json;
};

/** Check buyer registration (Get_Reg_Type). */
const registrationType = async (registrationNo) => {
	const { status, json } = await request(`${config.urls().dist}/Get_Reg_Type`, {
		method: 'POST',
		body: { Registration_No: registrationNo },
	});
	if (status !== 200) throw new Error(`FBR registration lookup returned ${status}`);
	return json;
};

module.exports = { buildPayload, preflight, send, reference, registrationType, parseResponse };

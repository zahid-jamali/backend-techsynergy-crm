/**
 * Sales-tax engine for FBR Digital Invoicing.
 *
 * Rates follow the `ratE_DESC` strings of the SaleTypeToRate reference API,
 * e.g. "18%", "1%", "Exempt", "0%", "18% and Rs. 80 per Liter".
 *
 * Verified against the PRAL sandbox:
 *  - plain percentage:  ST = rate% x base
 *  - "x% and Rs. y per <unit>" (FED in ST mode): ST = x% x base + y x qty x (1 + x%)
 *  - 3rd Schedule goods: base = fixed notified / retail price (when given)
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100 + Number.EPSILON) / 100;

const parseRate = (rate) => {
	const raw = String(rate ?? '').trim();
	if (!raw || /exempt/i.test(raw)) return { percent: 0, perUnit: 0, exempt: /exempt/i.test(raw) };
	const pct = raw.match(/(\d+(?:\.\d+)?)\s*%/);
	const per = raw.match(/Rs\.?\s*(\d+(?:\.\d+)?)\s*per/i);
	return {
		percent: pct ? Number(pct[1]) : 0,
		perUnit: per ? Number(per[1]) : 0,
		exempt: false,
	};
};

/**
 * @param {object} line   { quantity, unitPrice, discount, fixedNotifiedValue }
 * @param {object} tax    { rate, saleType, furtherTaxPercent, extraTax, fedPayable, salesTaxWithheldAtSource }
 */
const computeLine = (line = {}, tax = {}) => {
	const quantity = Number(line.quantity) || 0;
	const unitPrice = Number(line.unitPrice) || 0;
	const discount = round2(line.discount);
	const gross = round2(quantity * unitPrice);
	const valueExclST = round2(Math.max(0, gross - discount));
	const fixedNotifiedValue = round2(line.fixedNotifiedValue);

	const { percent, perUnit } = parseRate(tax.rate);
	const thirdSchedule = /3rd schedule/i.test(tax.saleType || '');
	const base = thirdSchedule && fixedNotifiedValue > 0 ? fixedNotifiedValue : valueExclST;

	const salesTax = round2(
		(base * percent) / 100 + perUnit * quantity * (1 + percent / 100)
	);
	const furtherTax = round2((valueExclST * (Number(tax.furtherTaxPercent) || 0)) / 100);
	const extraTax = round2(tax.extraTax);
	const fedPayable = round2(tax.fedPayable);
	const salesTaxWithheldAtSource = round2(tax.salesTaxWithheldAtSource);
	const total = round2(valueExclST + salesTax + furtherTax + extraTax + fedPayable);

	return {
		quantity,
		unitPrice,
		discount,
		gross,
		valueExclST,
		fixedNotifiedValue,
		salesTax,
		furtherTax,
		extraTax,
		fedPayable,
		salesTaxWithheldAtSource,
		total,
	};
};

const sumLines = (lines = []) =>
	lines.reduce(
		(acc, l) => {
			acc.gross += l.gross || 0;
			acc.discount += l.discount || 0;
			acc.valueExclST += l.valueExclST || 0;
			acc.salesTax += l.salesTax || 0;
			acc.furtherTax += l.furtherTax || 0;
			acc.extraTax += l.extraTax || 0;
			acc.fedPayable += l.fedPayable || 0;
			acc.withheld += l.salesTaxWithheldAtSource || 0;
			acc.total += l.total || 0;
			return acc;
		},
		{ gross: 0, discount: 0, valueExclST: 0, salesTax: 0, furtherTax: 0, extraTax: 0, fedPayable: 0, withheld: 0, total: 0 }
	);

module.exports = { round2, parseRate, computeLine, sumLines };

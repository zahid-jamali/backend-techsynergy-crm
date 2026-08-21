const DEFAULT_WHT = 5.5;

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

const priceFromCosting = ({ vendorPrice, margin, withHolding }) => {
	const cost = Math.max(0, Number(vendorPrice) || 0);
	const marginPct = Math.max(0, Number(margin) || 0);
	const whtPct = Math.max(0, Number(withHolding) || 0);
	const priceAfterMargin = round(cost + (cost * marginPct) / 100);
	const withHoldingAmount = round((priceAfterMargin * whtPct) / 100);
	const listPrice = round(priceAfterMargin + withHoldingAmount);
	return { cost, marginPct, whtPct, priceAfterMargin, withHoldingAmount, listPrice };
};

const calculateProduct = (p = {}) => {
	const quantity = Math.max(1, Number(p.quantity) || 1);
	const vendorPrice = Math.max(
		0,
		Number(p.vendorPrice ?? p.purchasePrice) || 0
	);
	const margin = Math.max(0, Number(p.margin) || 0);
	const withHolding = p.withHolding === '' || p.withHolding === undefined
		? DEFAULT_WHT
		: Math.max(0, Number(p.withHolding) || 0);

	const costing = priceFromCosting({ vendorPrice, margin, withHolding });
	const listPrice =
		vendorPrice > 0
			? costing.listPrice
			: round(Math.max(0, Number(p.listPrice) || 0));
	const priceAfterMargin =
		vendorPrice > 0 ? costing.priceAfterMargin : listPrice;
	const withHoldingAmount =
		vendorPrice > 0 ? costing.withHoldingAmount : 0;

	const amount = round(quantity * listPrice);
	const taxes = Array.isArray(p.Tax) ? p.Tax : [];
	let taxAmount = 0;
	taxes.forEach((t) => {
		taxAmount += (amount * (Number(t.percent) || 0)) / 100;
	});
	taxAmount = round(taxAmount);

	return {
		quantity,
		vendorPrice: round(vendorPrice),
		margin: round(margin),
		withHolding: round(withHolding),
		priceAfterMargin,
		withHoldingAmount,
		listPrice,
		amount,
		Tax: taxes.map((t) => ({
			tax: t.tax,
			percent: Number(t.percent) || 0,
		})),
		taxAmount,
		total: round(amount + taxAmount),
		marginAmount: round(priceAfterMargin - vendorPrice),
	};
};

const mapQuoteProduct = (p, index) => {
	const calculated = calculateProduct(p);
	return {
		serialNo: index + 1,
		productName: p.productName,
		description: p.description || '',
		quantity: calculated.quantity,
		vendorPrice: calculated.vendorPrice,
		margin: calculated.margin,
		withHolding: calculated.withHolding,
		priceAfterMargin: calculated.priceAfterMargin,
		withHoldingAmount: calculated.withHoldingAmount,
		listPrice: calculated.listPrice,
		amount: calculated.amount,
		Tax: calculated.Tax,
		taxAmount: calculated.taxAmount,
		total: calculated.total,
	};
};

const quoteTotals = (products = [], otherTax = []) => {
	const subTotal = round(
		products.reduce((sum, p) => sum + (Number(p.total) || 0), 0)
	);
	const calculatedOtherTaxes = (Array.isArray(otherTax) ? otherTax : []).map(
		(t) => {
			const percent = Number(t.percent) || 0;
			return {
				tax: t.tax,
				percent,
				amount: round((subTotal * percent) / 100),
			};
		}
	);
	const otherTaxAmount = round(
		calculatedOtherTaxes.reduce((sum, t) => sum + t.amount, 0)
	);
	return {
		subTotal,
		otherTax: calculatedOtherTaxes.map(({ tax, percent }) => ({ tax, percent })),
		otherTaxAmount,
		grandTotal: round(subTotal + otherTaxAmount),
		vendorTotal: round(
			products.reduce(
				(sum, p) =>
					sum + (Number(p.vendorPrice) || 0) * (Number(p.quantity) || 0),
				0
			)
		),
		marginTotal: round(
			products.reduce(
				(sum, p) =>
					sum +
					((Number(p.priceAfterMargin) || 0) - (Number(p.vendorPrice) || 0)) *
						(Number(p.quantity) || 0),
				0
			)
		),
		withHoldingTotal: round(
			products.reduce(
				(sum, p) =>
					sum + (Number(p.withHoldingAmount) || 0) * (Number(p.quantity) || 0),
				0
			)
		),
	};
};

module.exports = {
	DEFAULT_WHT,
	round,
	priceFromCosting,
	calculateProduct,
	mapQuoteProduct,
	quoteTotals,
};

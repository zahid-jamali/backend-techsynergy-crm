import { Document, Page, Text } from '@react-pdf/renderer';
import {
	h,
	styles,
	COMPANY,
	capitalize,
	formatDate,
	formatMoney,
	DocHeader,
	InfoBoxes,
	DataTable,
	Totals,
	Footer,
	TermList,
} from './shared.mjs';

const POToVendorDocument = ({ po }) => {
	const money = (amount) => formatMoney(amount, 'PKR');
	const products = po.products || [];
	const taxes = po.Tax || [];
	const taxLines = taxes.map((t) => [
		`${String(t.tax || '').toUpperCase()} (${t.percent}%)`,
		money(t.amount),
	]);

	return h(
		Document,
		null,
		h(
			Page,
			{ size: 'A4', style: styles.page },
			h(DocHeader, {
				title: 'PURCHASE ORDER TO VENDOR',
				rows: [
					['PO No:', po.poToNumber],
					['Date:', formatDate(po.createdAt)],
					['Reference Quote:', po.refQuote?.quoteNumber || '-'],
				],
			}),
			h(InfoBoxes, {
				leftTitle: 'COMPANY',
				leftLines: COMPANY.shortAddress,
				rightTitle: 'VENDOR',
				rightHeading: capitalize(po.vendor?.name || ''),
				rightLines: [`Status: ${po.vendor?.status || '-'}`],
			}),
			h(Text, { style: styles.paragraph }, `Subject: ${po.subject || ''}`),
			h(DataTable, {
				columns: [
					{ label: '#', width: '6%' },
					{ label: 'Product Description', width: '36%' },
					{ label: 'Unit Price', width: '16%', align: 'right' },
					{ label: 'Qty', width: '10%', align: 'right' },
					{ label: 'Amount', width: '16%', align: 'right', strong: true },
					{ label: 'Line Total', width: '16%', align: 'right', strong: true },
				],
				rows:
					products.length > 0
						? products.map((p, i) => {
								const unit = Number(p.listPrice) || 0;
								const qty = Number(p.quantity) || 0;
								const amount =
									Number(p.amount) > 0
										? Number(p.amount)
										: Math.round(unit * qty * 100) / 100;
								return [
									i + 1,
									capitalize(p.productName),
									money(unit),
									qty,
									money(amount),
									money(amount),
								];
						  })
						: [['', 'No products available', '', '', '', '']],
				footer:
					products.length > 0
						? (() => {
								const qtySum = products.reduce(
									(sum, p) => sum + (Number(p.quantity) || 0),
									0
								);
								const amountSum = products.reduce((sum, p) => {
									const unit = Number(p.listPrice) || 0;
									const qty = Number(p.quantity) || 0;
									const amount =
										Number(p.amount) > 0
											? Number(p.amount)
											: Math.round(unit * qty * 100) / 100;
									return sum + amount;
								}, 0);
								return [
									'',
									'Totals',
									'',
									qtySum,
									money(amountSum),
									money(amountSum),
								];
						  })()
						: null,
				note: 'Amount = Unit Price × Qty',
			}),
			h(Totals, {
				lines: [['Subtotal', money(po.subTotal)], ...taxLines],
				grandLabel: 'Total',
				grandValue: money(po.grandTotal),
			}),
			h(TermList, {
				title: 'Terms & Conditions:',
				items: po.termsAndConditions || [],
			}),
			h(Footer, null)
		)
	);
};

export default POToVendorDocument;

import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import {
	h,
	s,
	COMPANY,
	FBR_LOGO_SRC,
	fmtDate,
	fmtNum,
	fmtQty,
	amountInWords,
	Header,
	MetaGrid,
	Party,
	Table,
	Footer,
	Signatures,
} from './docKit.mjs';

const STATUS = {
	Draft: ['DRAFT', '#64748b'],
	Issued: ['ISSUED', '#15803d'],
	Cancelled: ['CANCELLED', '#b91c1c'],
};

const TaxInvoiceDocument = ({ invoice, seller = {}, qrDataUrl }) => {
	const buyer = invoice.buyer || {};
	const tax = invoice.tax || {};
	const totals = invoice.totals || {};
	const lines = invoice.lines || [];
	const cur = invoice.currency || 'PKR';
	const fbr = invoice.fbr || {};
	const reported = Boolean(fbr.irn);
	const [statusLabel, statusColor] = STATUS[invoice.status] || STATUS.Draft;
	const showFurther = (totals.furtherTax || 0) > 0;
	const showExtra = (totals.extraTax || 0) + (totals.fedPayable || 0) > 0;
	const showDiscount = (totals.discount || 0) > 0;

	const columns = [
		{ label: '#', width: '4%', align: 'center' },
		{ label: 'Description of Goods', width: showFurther ? '22%' : '30%' },
		{ label: 'HS Code', width: '9%' },
		{ label: 'Qty', width: '7%', align: 'right' },
		{ label: 'Unit Price', width: '10%', align: 'right' },
		{ label: 'Value Excl. ST', width: '11%', align: 'right' },
		{ label: 'Rate', width: '8%', align: 'center' },
		{ label: 'Sales Tax', width: '10%', align: 'right' },
		...(showFurther ? [{ label: 'Further Tax', width: '9%', align: 'right' }] : []),
		{ label: 'Amount', width: showFurther ? '10%' : '11%', align: 'right' },
	];

	const rows = lines.map((l, i) => [
		String(i + 1),
		[l.productName, l.description],
		l.hsCode || '-',
		[fmtQty(l.quantity), l.uoM === 'Numbers, pieces, units' ? 'Units' : l.uoM],
		fmtNum(l.unitPrice),
		fmtNum(l.valueExclST),
		tax.rate || '-',
		fmtNum(l.salesTax),
		...(showFurther ? [fmtNum(l.furtherTax)] : []),
		fmtNum(l.total),
	]);

	const footer = [
		'',
		'Total',
		'',
		fmtQty(lines.reduce((a, l) => a + (Number(l.quantity) || 0), 0)),
		'',
		fmtNum(totals.valueExclST),
		'',
		fmtNum(totals.salesTax),
		...(showFurther ? [fmtNum(totals.furtherTax)] : []),
		fmtNum(totals.total),
	];

	const totalRows = [
		['Gross amount', fmtNum(totals.gross)],
		...(showDiscount ? [['Less: discount', `(${fmtNum(totals.discount)})`]] : []),
		['Value excluding sales tax', fmtNum(totals.valueExclST)],
		[`Sales tax${tax.rate ? ` @ ${tax.rate}` : ''}`, fmtNum(totals.salesTax)],
		...(showFurther ? [[`Further tax @ ${tax.furtherTaxPercent}%`, fmtNum(totals.furtherTax)]] : []),
		...(showExtra ? [['Extra tax / FED', fmtNum((totals.extraTax || 0) + (totals.fedPayable || 0))]] : []),
	];

	const terms = invoice.termsAndConditions || [];

	return h(
		Document,
		{ title: `${invoice.invoiceNumber} — Sales Tax Invoice`, author: COMPANY.name },
		h(
			Page,
			{ size: 'A4', style: s.page },
			invoice.status !== 'Issued' ? h(Text, { style: s.watermark, fixed: true }, statusLabel) : null,
			h(Header, {
				title: 'SALES TAX INVOICE',
				subtitle: reported ? 'Reported to FBR Digital Invoicing System' : 'Under Section 23 of the Sales Tax Act, 1990',
				status: statusLabel,
				statusColor,
			}),
			h(View, { style: s.rule }),
			h(MetaGrid, {
				items: [
					['Invoice No.', invoice.invoiceNumber],
					['Invoice Date', fmtDate(invoice.documentDate)],
					['Due Date', fmtDate(invoice.dueDate)],
					['Payment Terms', invoice.paymentTerms],
					['Customer PO / Ref', invoice.customerRefNo],
					['Sell Order No.', invoice.order?.orderNumber],
					['Delivery Challan', invoice.delivery?.deliveryNumber],
					['Currency', cur === 'USD' ? `USD (1 USD = PKR ${fmtNum(invoice.exchangeRate)})` : 'PKR'],
				],
			}),
			h(
				View,
				{ style: s.parties },
				h(Party, {
					heading: 'SUPPLIER',
					name: seller.businessName || COMPANY.name,
					rows: [
						['Address', seller.address || COMPANY.address.slice(0, 2).join(', ')],
						['NTN', seller.ntnCnic || 'G141420'],
						['STRN', process.env.FBR_SELLER_STRN || ''],
						['Province', seller.province],
						['Email', 'sales@techsynergypk.com'],
					],
				}),
				h(Party, {
					heading: 'BUYER',
					name: buyer.businessName,
					rows: [
						['Address', buyer.address],
						['NTN / CNIC', buyer.ntnCnic],
						['STRN', buyer.strn],
						['Registration', buyer.registrationType],
						['Province', buyer.province],
						['Attention', [buyer.contactName, buyer.phone].filter(Boolean).join(' · ')],
					],
				})
			),
			h(
				View,
				{ style: [s.kv, { marginBottom: 6 }] },
				h(Text, { style: s.kvLabel }, 'Sale type'),
				h(
					Text,
					{ style: s.kvValue },
					[tax.saleType, tax.sroScheduleNo ? `SRO/Schedule: ${tax.sroScheduleNo}` : '', tax.sroItemSerialNo ? `Item S.No: ${tax.sroItemSerialNo}` : '']
						.filter(Boolean)
						.join('   |   ')
				)
			),
			h(Table, { columns, rows, footer }),
			h(
				View,
				{ style: s.bottom, wrap: false },
				h(
					View,
					{ style: s.words },
					h(
						View,
						{ style: s.wordsBox },
						h(Text, { style: s.wordsLabel }, 'Amount in words'),
						h(Text, { style: s.wordsText }, amountInWords(totals.total, cur))
					),
					invoice.description
						? h(View, { style: { marginBottom: 6 } }, h(Text, { style: s.sectionTitle }, 'DESCRIPTION'), h(Text, { style: s.small }, invoice.description))
						: null,
					invoice.notes
						? h(View, null, h(Text, { style: s.sectionTitle }, 'NOTES'), h(Text, { style: s.small }, invoice.notes))
						: null
				),
				h(
					View,
					{ style: s.totals },
					totalRows.map(([k, v], i) =>
						h(View, { key: `t${i}`, style: s.totRow }, h(Text, null, k), h(Text, { style: s.right }, v))
					),
					h(View, { style: s.grand }, h(Text, { style: s.grandText }, `Total (${cur})`), h(Text, { style: s.grandText }, fmtNum(totals.total)))
				)
			),
			h(
				View,
				{ style: s.fbrBox, wrap: false },
				FBR_LOGO_SRC
					? h(Image, { src: FBR_LOGO_SRC, style: s.fbrLogo })
					: h(View, { style: s.fbrBadge }, h(Text, { style: s.fbrBadgeText }, 'FBR\nDIGITAL\nINVOICING\nSYSTEM')),
				h(
					View,
					{ style: s.fbrInfo },
					h(Text, { style: s.sectionTitle }, 'FBR DIGITAL INVOICE'),
					reported
						? [
								h(Text, { key: 'l', style: s.small }, 'FBR Invoice Reference Number (IRN)'),
								h(Text, { key: 'i', style: s.irn }, fbr.irn),
								h(
									Text,
									{ key: 'd', style: s.small },
									`Reported: ${fbr.dated || fmtDate(fbr.submittedAt)}${fbr.environment === 'sandbox' ? '  ·  SANDBOX (test) environment' : ''}`
								),
								h(Text, { key: 'v', style: s.small }, 'Verify this invoice by scanning the QR code with the FBR Tax Asaan app.'),
						  ]
						: h(
								Text,
								{ style: s.small },
								invoice.status === 'Draft'
									? 'This draft has not been reported to FBR. The FBR IRN and QR code are printed once the invoice is issued.'
									: 'This invoice was not reported to FBR Digital Invoicing.'
						  )
				),
				reported && qrDataUrl ? h(Image, { src: qrDataUrl, style: s.qr }) : null
			),
			h(
				View,
				{ style: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }, wrap: false },
				h(
					View,
					{ style: { width: '55%' } },
					h(Text, { style: s.sectionTitle }, 'TERMS & CONDITIONS'),
					(terms.length ? terms : ['Payment is due by the date shown above.', 'Goods once delivered are not returnable except under warranty.']).map(
						(t, i) => h(Text, { key: `tc${i}`, style: s.small }, `${i + 1}. ${t}`)
					)
				),
				h(
					View,
					{ style: { width: '42%' } },
					h(Text, { style: s.sectionTitle }, 'BANK DETAILS'),
					COMPANY.bank.map((b, i) => h(Text, { key: `b${i}`, style: s.small }, b))
				)
			),
			h(Signatures, { labels: ['Prepared by', 'Authorised signatory', "Customer's acknowledgement"] }),
			h(Footer, { left: `${COMPANY.name}  ·  This is a computer-generated invoice.` })
		)
	);
};

export default TaxInvoiceDocument;

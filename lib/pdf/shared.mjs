import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createElement } from 'react';
import { Font, Image, StyleSheet, Text, View } from '@react-pdf/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../../assets');
const FONT_PATH = path.join(ASSETS_DIR, 'myFont.ttf');
const LOGO_CANDIDATES = ['logo.jpeg', 'logo.jpg', 'logo.png', 'image.jpeg'];

const resolveLogoSrc = () => {
	for (const name of LOGO_CANDIDATES) {
		const filePath = path.join(ASSETS_DIR, name);
		if (!fs.existsSync(filePath)) continue;
		const ext = path.extname(name).toLowerCase().replace('.', '');
		const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
		const base64 = fs.readFileSync(filePath).toString('base64');
		return `data:${mime};base64,${base64}`;
	}
	return null;
};

const LOGO_SRC = resolveLogoSrc();

let FONT_FAMILY = 'Helvetica';
try {
	if (fs.existsSync(FONT_PATH)) {
		Font.register({ family: 'DocFont', src: FONT_PATH });
		FONT_FAMILY = 'DocFont';
	}
} catch (error) {
	console.warn('PDF custom font skipped:', error.message);
}

const h = (type, props, ...children) => {
	const flat = children
		.flat(Infinity)
		.filter((child) => child !== null && child !== undefined && child !== false);
	return createElement(type, props || null, ...flat);
};

const capitalize = (value) => {
	if (!value || typeof value !== 'string') return '';
	return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDate = (value) => {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleDateString();
};

const formatMoney = (amount = 0, currency = 'PKR') => {
	if (currency === 'PKR') {
		return new Intl.NumberFormat('en-PK', {
			style: 'currency',
			currency: 'PKR',
			minimumFractionDigits: 2,
		}).format(Number(amount) || 0);
	}

	return `${currency} ${Number(amount || 0).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
};

const COMPANY = {
	name: 'TECHSYNERGY INNOVATIONS (PRIVATE) LIMITED',
	address: [
		'Plot 47-C, Mezzanine Floor, 21st Street',
		'Phase II Extension, DHA, Karachi',
		'Website: www.techsynergypk.com',
		'Email: sales@techsynergypk.com',
		'NTN: G141420',
	],
	shortAddress: [
		'Plot 47-C, Mezzanine Floor',
		'Phase II Extension, DHA Karachi',
		'NTN: G141420',
	],
	footer: [
		'47-C, Mezz Floor, DHA Phase II Ext, Karachi',
		'www.techsynergypk.com | info@techsynergypk.com | 0337-8328310',
	],
	bank: [
		'Bank: Faysal Bank Limited',
		'Account Title: TECHSYNERGY INNOVATIONS (PRIVATE) LIMITED',
		'Account Number: 3555301000014430',
		'IBAN: PK65FAYS3555301000014431',
	],
};

const styles = StyleSheet.create({
	page: {
		fontFamily: FONT_FAMILY,
		fontSize: 10,
		paddingTop: 28,
		paddingBottom: 64,
		paddingHorizontal: 32,
		color: '#000',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 18,
	},
	logoWrap: {
		width: 220,
		height: 64,
		marginRight: 12,
	},
	logo: {
		width: 220,
		height: 64,
		objectFit: 'contain',
	},
	logoFallback: {
		fontSize: 14,
		fontFamily: FONT_FAMILY,
	},
	headerMeta: {
		alignItems: 'flex-end',
		maxWidth: 260,
	},
	docTitleBox: {
		backgroundColor: '#000',
		paddingVertical: 8,
		paddingHorizontal: 16,
		marginBottom: 8,
	},
	docTitleText: {
		color: '#fff',
		fontSize: 11,
		textAlign: 'center',
	},
	metaRow: {
		flexDirection: 'row',
		marginBottom: 2,
	},
	metaLabel: {
		width: 80,
		color: '#444',
		fontSize: 9,
	},
	metaValue: {
		color: '#444',
		fontSize: 9,
		maxWidth: 150,
		textAlign: 'right',
	},
	section: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 12,
		marginBottom: 14,
	},
	box: {
		width: '48%',
	},
	boxTitle: {
		backgroundColor: '#000',
		paddingVertical: 5,
		marginBottom: 8,
	},
	boxTitleText: {
		color: '#fff',
		textAlign: 'center',
		fontSize: 10,
	},
	bold: {
		marginBottom: 4,
	},
	light: {
		color: '#444',
		fontSize: 9,
		lineHeight: 1.4,
	},
	paragraph: {
		marginBottom: 8,
		lineHeight: 1.4,
	},
	table: {
		marginTop: 16,
		width: '100%',
	},
	tableHeader: {
		flexDirection: 'row',
		borderBottomWidth: 2,
		borderBottomColor: '#000',
		paddingBottom: 6,
		marginBottom: 4,
	},
	tableRow: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#ddd',
		paddingVertical: 7,
		alignItems: 'flex-start',
	},
	th: {
		fontSize: 9,
	},
	td: {
		fontSize: 9,
		color: '#444',
	},
	right: {
		textAlign: 'right',
	},
	totalsWrap: {
		marginTop: 10,
		alignItems: 'flex-end',
	},
	totals: {
		width: 240,
	},
	totalsRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 4,
	},
	grandRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 6,
		borderTopWidth: 2,
		borderTopColor: '#000',
		marginTop: 4,
	},
	bank: {
		marginTop: 28,
	},
	terms: {
		marginTop: 20,
	},
	termItem: {
		fontSize: 9,
		color: '#444',
		marginBottom: 3,
		paddingLeft: 4,
	},
	signatureRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 40,
	},
	signBox: {
		width: '40%',
		alignItems: 'center',
	},
	signLine: {
		marginTop: 36,
		width: '100%',
		borderTopWidth: 1,
		borderTopColor: '#000',
	},
	footer: {
		position: 'absolute',
		bottom: 18,
		left: 32,
		right: 32,
		textAlign: 'center',
		borderTopWidth: 1,
		borderTopColor: '#000',
		paddingTop: 8,
	},
	footerText: {
		fontSize: 9,
		color: '#444',
		textAlign: 'center',
		marginBottom: 2,
	},
	watermark: {
		position: 'absolute',
		top: '42%',
		left: 0,
		right: 0,
		textAlign: 'center',
		fontSize: 48,
		color: '#000',
		opacity: 0.06,
	},
});

const DocHeader = ({ title, rows = [] }) =>
	h(
		View,
		{ style: styles.header },
		LOGO_SRC
			? h(
					View,
					{ style: styles.logoWrap },
					h(Image, { src: LOGO_SRC, style: styles.logo })
			  )
			: h(Text, { style: styles.logoFallback }, 'TechSynergy'),
		h(
			View,
			{ style: styles.headerMeta },
			h(View, { style: styles.docTitleBox }, h(Text, { style: styles.docTitleText }, title)),
			rows.map(([label, value], index) =>
				h(
					View,
					{ key: `meta-${index}`, style: styles.metaRow },
					h(Text, { style: styles.metaLabel }, label),
					h(Text, { style: styles.metaValue }, String(value ?? '-'))
				)
			)
		)
	);

const InfoBoxes = ({ leftTitle, leftLines, rightTitle, rightHeading, rightLines }) =>
	h(
		View,
		{ style: styles.section },
		h(
			View,
			{ style: styles.box },
			h(View, { style: styles.boxTitle }, h(Text, { style: styles.boxTitleText }, leftTitle)),
			h(Text, { style: styles.bold }, COMPANY.name),
			leftLines.map((line, index) =>
				h(Text, { key: `l-${index}`, style: styles.light }, line)
			)
		),
		h(
			View,
			{ style: styles.box },
			h(View, { style: styles.boxTitle }, h(Text, { style: styles.boxTitleText }, rightTitle)),
			h(Text, { style: styles.bold }, rightHeading || '-'),
			(rightLines || []).map((line, index) =>
				h(Text, { key: `r-${index}`, style: styles.light }, line)
			)
		)
	);

const DataTable = ({ columns, rows }) =>
	h(
		View,
		{ style: styles.table },
		h(
			View,
			{ style: styles.tableHeader, wrap: false },
			columns.map((col, index) =>
				h(
					Text,
					{
						key: `h-${index}`,
						style: [
							styles.th,
							{ width: col.width },
							col.align === 'right' ? styles.right : {},
						],
					},
					col.label
				)
			)
		),
		rows.map((row, rowIndex) =>
			h(
				View,
				{ key: `r-${rowIndex}`, style: styles.tableRow, wrap: false },
				row.map((cell, cellIndex) =>
					h(
						Text,
						{
							key: `c-${cellIndex}`,
							style: [
								styles.td,
								{ width: columns[cellIndex].width },
								columns[cellIndex].align === 'right' ? styles.right : {},
							],
						},
						cell == null || cell === '' ? '-' : String(cell)
					)
				)
			)
		)
	);

const Totals = ({ lines, grandLabel, grandValue }) =>
	h(
		View,
		{ style: styles.totalsWrap, wrap: false },
		h(
			View,
			{ style: styles.totals },
			lines.map(([label, value], index) =>
				h(
					View,
					{ key: `t-${index}`, style: styles.totalsRow },
					h(Text, null, label),
					h(Text, { style: styles.right }, value)
				)
			),
			h(
				View,
				{ style: styles.grandRow },
				h(Text, null, grandLabel),
				h(Text, null, grandValue)
			)
		)
	);

const Footer = () =>
	h(
		View,
		{ style: styles.footer, fixed: true },
		COMPANY.footer.map((line, index) =>
			h(Text, { key: `f-${index}`, style: styles.footerText }, line)
		)
	);

const Signatures = ({ left = 'Prepared By', right = 'Received By' }) =>
	h(
		View,
		{ style: styles.signatureRow, wrap: false },
		h(View, { style: styles.signBox }, h(Text, null, left), h(View, { style: styles.signLine })),
		h(View, { style: styles.signBox }, h(Text, null, right), h(View, { style: styles.signLine }))
	);

const TermList = ({ title, items = [], transform = true }) => {
	if (!items.length) return null;
	return h(
		View,
		{ style: styles.terms, wrap: false },
		h(Text, { style: styles.bold }, title),
		items.map((item, index) =>
			h(
				Text,
				{ key: `term-${index}`, style: styles.termItem },
				`• ${transform ? capitalize(item) : item}`
			)
		)
	);
};

export {
	h,
	styles,
	COMPANY,
	LOGO_SRC,
	capitalize,
	formatDate,
	formatMoney,
	DocHeader,
	InfoBoxes,
	DataTable,
	Totals,
	Footer,
	Signatures,
	TermList,
};

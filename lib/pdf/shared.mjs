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
		marginTop: 12,
		width: '100%',
		borderWidth: 1,
		borderColor: '#111827',
	},
	tableHeader: {
		flexDirection: 'row',
		backgroundColor: '#111827',
	},
	tableRow: {
		flexDirection: 'row',
		borderTopWidth: 1,
		borderTopColor: '#111827',
		alignItems: 'stretch',
	},
	tableRowAlt: {
		backgroundColor: '#f8fafc',
	},
	tableFooter: {
		flexDirection: 'row',
		backgroundColor: '#f3f4f6',
		borderTopWidth: 1.5,
		borderTopColor: '#111827',
	},
	thWrap: {
		paddingVertical: 7,
		paddingHorizontal: 5,
		borderRightWidth: 1,
		borderRightColor: '#374151',
		justifyContent: 'center',
	},
	tdWrap: {
		paddingVertical: 6,
		paddingHorizontal: 5,
		borderRightWidth: 1,
		borderRightColor: '#d1d5db',
		justifyContent: 'center',
	},
	cellLast: {
		borderRightWidth: 0,
	},
	th: {
		fontSize: 8,
		color: '#fff',
		fontFamily: FONT_FAMILY,
	},
	td: {
		fontSize: 8.5,
		color: '#111827',
	},
	tdMuted: {
		fontSize: 7.5,
		color: '#4b5563',
		marginTop: 2,
	},
	tdNumeric: {
		fontSize: 7.5,
		color: '#111827',
	},
	tdStrong: {
		fontSize: 7.5,
		color: '#111827',
		fontFamily: FONT_FAMILY,
	},
	right: {
		textAlign: 'right',
	},
	tableNote: {
		marginTop: 6,
		fontSize: 8,
		color: '#4b5563',
	},
	snapshot: {
		flexDirection: 'row',
		marginTop: 4,
		marginBottom: 8,
		borderWidth: 1,
		borderColor: '#111827',
	},
	snapshotCell: {
		flex: 1,
		paddingVertical: 8,
		paddingHorizontal: 8,
		borderRightWidth: 1,
		borderRightColor: '#111827',
	},
	snapshotLabel: {
		fontSize: 7.5,
		color: '#4b5563',
		marginBottom: 3,
		textTransform: 'uppercase',
	},
	snapshotValue: {
		fontSize: 10,
		color: '#111827',
	},
	totalsWrap: {
		marginTop: 12,
		alignItems: 'flex-end',
	},
	totals: {
		width: 280,
		borderWidth: 1,
		borderColor: '#111827',
	},
	totalsRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 5,
		paddingHorizontal: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#e5e7eb',
	},
	grandRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 7,
		paddingHorizontal: 8,
		backgroundColor: '#111827',
	},
	grandText: {
		color: '#fff',
		fontSize: 10,
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

const PAGE_INNER_WIDTH = 531;

const resolveColWidth = (width, tableWidth = PAGE_INNER_WIDTH) => {
	if (typeof width === 'number' && width > 0) return width;
	const raw = String(width || '');
	if (raw.endsWith('%')) {
		return Math.floor((tableWidth * parseFloat(raw)) / 100);
	}
	const parsed = parseFloat(raw);
	return parsed > 0 ? parsed : 60;
};

const cellBoxStyle = (colWidth, align, isLast, header = false) => ({
	width: colWidth,
	minWidth: colWidth,
	maxWidth: colWidth,
	flexShrink: 0,
	flexGrow: 0,
	overflow: 'hidden',
	paddingVertical: header ? 7 : 6,
	paddingHorizontal: 4,
	borderRightWidth: isLast ? 0 : 1,
	borderRightColor: header ? '#374151' : '#d1d5db',
	alignItems: align === 'right' ? 'flex-end' : 'flex-start',
	justifyContent: 'flex-start',
	backgroundColor: header ? '#111827' : undefined,
});
const renderCellContent = (cell, col, header = false, innerWidth = 60) => {
	const textStyle = [
		header ? styles.th : col.compact || col.align === 'right' ? styles.tdNumeric : styles.td,
		{ width: innerWidth, maxWidth: innerWidth },
		col.align === 'right' ? styles.right : {},
		!header && col.strong ? styles.tdStrong : {},
	];
	const mutedStyle = [
		styles.tdMuted,
		{ width: innerWidth, maxWidth: innerWidth },
		col.align === 'right' ? styles.right : {},
	];

	if (Array.isArray(cell)) {
		const [primary, secondary] = cell;
		return [
			h(
				Text,
				{ style: textStyle, wrap: true },
				primary == null || primary === '' ? '-' : String(primary)
			),
			secondary
				? h(Text, { style: mutedStyle, wrap: true }, String(secondary))
				: null,
		];
	}
	return h(
		Text,
		{ style: textStyle, wrap: col.wrap !== false },
		cell == null || cell === '' ? '-' : String(cell)
	);
};

const renderTableRow = (cells, columns, widths, rowStyle, keyPrefix) =>
	h(
		View,
		{ key: keyPrefix, style: rowStyle, wrap: false },
		cells.map((cell, cellIndex) => {
			const col = columns[cellIndex] || {};
			const colWidth = widths[cellIndex] || 60;
			const innerWidth = Math.max(12, colWidth - 8);
			const isHeader = keyPrefix === 'h';
			return h(
				View,
				{
					key: `${keyPrefix}-c-${cellIndex}`,
					style: cellBoxStyle(
						colWidth,
						col.align,
						cellIndex === columns.length - 1,
						isHeader
					),
				},
				renderCellContent(cell, col, isHeader, innerWidth)
			);
		})
	);

const DataTable = ({ columns, rows, footer, note, tableWidth = PAGE_INNER_WIDTH }) => {
	const widths = columns.map((col) => resolveColWidth(col.width, tableWidth));
	return h(
		View,
		null,
		h(
			View,
			{ style: [styles.table, { width: tableWidth }] },
			renderTableRow(
				columns.map((col) => col.label),
				columns,
				widths,
				styles.tableHeader,
				'h'
			),
			rows.map((row, rowIndex) =>
				renderTableRow(
					row,
					columns,
					widths,
					[rowIndex % 2 === 1 ? styles.tableRowAlt : {}, styles.tableRow],
					`r-${rowIndex}`
				)
			),
			footer
				? renderTableRow(footer, columns, widths, styles.tableFooter, 'f')
				: null
		),
		note ? h(Text, { style: styles.tableNote }, note) : null
	);
};

const SnapshotBar = ({ items = [] }) =>
	h(
		View,
		{ style: styles.snapshot, wrap: false },
		items.map(([label, value], index) =>
			h(
				View,
				{
					key: `s-${index}`,
					style: [
						styles.snapshotCell,
						index === items.length - 1 ? { borderRightWidth: 0 } : {},
					],
				},
				h(Text, { style: styles.snapshotLabel }, label),
				h(Text, { style: styles.snapshotValue }, String(value ?? '-'))
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
					h(Text, { style: styles.td }, label),
					h(Text, { style: [styles.td, styles.right] }, value)
				)
			),
			h(
				View,
				{ style: styles.grandRow },
				h(Text, { style: styles.grandText }, grandLabel),
				h(Text, { style: styles.grandText }, grandValue)
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
	SnapshotBar,
	Totals,
	Footer,
	Signatures,
	TermList,
};

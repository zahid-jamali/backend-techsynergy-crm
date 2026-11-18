/**
 * Shared building blocks for the finance / operations documents
 * (tax invoice and delivery challan). Kept apart from shared.mjs so the
 * quotation and PO documents used by staff/admin are not affected.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer';
import { h, COMPANY, LOGO_SRC } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '../../assets');

const loadAsset = (names) => {
	for (const name of names) {
		const p = path.join(ASSETS_DIR, name);
		if (!fs.existsSync(p)) continue;
		const ext = path.extname(name).slice(1).toLowerCase();
		return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${fs.readFileSync(p).toString('base64')}`;
	}
	return null;
};

/** Official FBR Digital Invoicing logo — drop the file into backend-crm/assets. */
const FBR_LOGO_SRC = loadAsset(['fbr-di-logo.png', 'fbr-di-logo.jpg', 'fbr-di-logo.jpeg', 'fbr-logo.png']);

const INK = '#0f172a';
const MUTED = '#475569';
const LINE = '#cbd5e1';
const BRAND = '#0b2965';
const SOFT = '#f1f5f9';

const s = StyleSheet.create({
	page: { fontFamily: 'Helvetica', fontSize: 9, paddingTop: 26, paddingBottom: 70, paddingHorizontal: 30, color: INK },
	header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
	logo: { width: 190, height: 70, objectFit: 'contain' },
	logoText: { fontSize: 16, color: BRAND },
	titleWrap: { alignItems: 'flex-end' },
	title: { fontSize: 17, color: BRAND, letterSpacing: 1, fontFamily: 'Helvetica-Bold' },
	subtitle: { fontSize: 8, color: MUTED, marginTop: 2 },
	statusPill: { marginTop: 6, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3, fontSize: 8, color: '#fff', fontFamily: 'Helvetica-Bold' },
	rule: { height: 2, backgroundColor: BRAND, marginBottom: 10 },
	metaGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: LINE, marginBottom: 10 },
	metaCell: { width: '25%', paddingVertical: 5, paddingHorizontal: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: LINE },
	metaLabel: { fontSize: 6.5, color: MUTED, textTransform: 'uppercase', marginBottom: 2 },
	metaValue: { fontSize: 8.5, color: INK, fontFamily: 'Helvetica-Bold' },
	parties: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
	party: { width: '49%', borderWidth: 1, borderColor: LINE },
	partyHead: { backgroundColor: BRAND, paddingVertical: 4, paddingHorizontal: 6 },
	partyHeadText: { color: '#fff', fontSize: 8, letterSpacing: 0.5, fontFamily: 'Helvetica-Bold' },
	partyBody: { padding: 6 },
	partyName: { fontSize: 10, marginBottom: 3, fontFamily: 'Helvetica-Bold' },
	kv: { flexDirection: 'row', marginBottom: 1.5 },
	kvLabel: { width: 70, fontSize: 7.5, color: MUTED },
	kvValue: { flex: 1, fontSize: 8, color: INK },
	table: { borderWidth: 1, borderColor: INK },
	thRow: { flexDirection: 'row', backgroundColor: INK },
	th: { color: '#fff', fontSize: 7, paddingVertical: 5, paddingHorizontal: 3, fontFamily: 'Helvetica-Bold' },
	tr: { flexDirection: 'row', borderTopWidth: 0.75, borderTopColor: LINE },
	trAlt: { backgroundColor: '#f8fafc' },
	td: { fontSize: 7.8, paddingVertical: 4, paddingHorizontal: 3 },
	tdSub: { fontSize: 6.6, color: MUTED, marginTop: 1.5 },
	tfRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: INK, backgroundColor: SOFT, fontFamily: 'Helvetica-Bold' },
	right: { textAlign: 'right' },
	center: { textAlign: 'center' },
	bottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
	words: { width: '55%' },
	wordsBox: { borderWidth: 1, borderColor: LINE, padding: 6, marginBottom: 8 },
	wordsLabel: { fontSize: 6.5, color: MUTED, textTransform: 'uppercase', marginBottom: 2 },
	wordsText: { fontSize: 8.5 },
	totals: { width: '42%', borderWidth: 1, borderColor: INK },
	totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.75, borderBottomColor: LINE },
	grand: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 6, backgroundColor: BRAND },
	grandText: { color: '#fff', fontSize: 10, fontFamily: 'Helvetica-Bold' },
	sectionTitle: { fontSize: 8, color: BRAND, marginBottom: 3, letterSpacing: 0.5, fontFamily: 'Helvetica-Bold' },
	small: { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
	fbrBox: { flexDirection: 'row', borderWidth: 1, borderColor: INK, marginTop: 10, padding: 6, alignItems: 'center' },
	fbrLogo: { width: 72, height: 72, objectFit: 'contain', marginRight: 8 },
	fbrBadge: { width: 72, height: 72, borderWidth: 1.5, borderColor: '#15803d', alignItems: 'center', justifyContent: 'center', marginRight: 8, padding: 4 },
	fbrBadgeText: { fontSize: 7, color: '#15803d', textAlign: 'center' },
	qr: { width: 72, height: 72, marginLeft: 8 },
	fbrInfo: { flex: 1 },
	irn: { fontSize: 11, letterSpacing: 0.5, marginVertical: 2, fontFamily: 'Helvetica-Bold' },
	signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
	signBox: { width: '30%', alignItems: 'center' },
	signLine: { width: '100%', borderTopWidth: 1, borderTopColor: INK, marginTop: 26, marginBottom: 3 },
	footer: { position: 'absolute', bottom: 18, left: 30, right: 30, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 5 },
	footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
	footerText: { fontSize: 7, color: MUTED },
	watermark: { position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center', fontSize: 72, color: '#94a3b8', opacity: 0.12, transform: 'rotate(-35deg)' },
});

const fmtDate = (v) => {
	if (!v) return '-';
	const d = new Date(v);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
};

const fmtNum = (n, digits = 2) =>
	Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtQty = (n) => {
	const v = Number(n || 0);
	return Number.isInteger(v) ? v.toLocaleString('en-PK') : fmtNum(v, 3);
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below1000 = (n) => {
	let out = '';
	if (n >= 100) {
		out += `${ONES[Math.floor(n / 100)]} Hundred`;
		n %= 100;
		if (n) out += ' ';
	}
	if (n >= 20) {
		out += TENS[Math.floor(n / 10)];
		if (n % 10) out += `-${ONES[n % 10]}`;
	} else if (n) out += ONES[n];
	return out;
};
/** South-Asian grouping: crore / lakh / thousand. */
const intToWords = (n) => {
	if (!n) return 'Zero';
	const parts = [];
	const crore = Math.floor(n / 1e7);
	n %= 1e7;
	const lakh = Math.floor(n / 1e5);
	n %= 1e5;
	const thousand = Math.floor(n / 1e3);
	n %= 1e3;
	if (crore) parts.push(`${intToWords(crore)} Crore`);
	if (lakh) parts.push(`${below1000(lakh)} Lakh`);
	if (thousand) parts.push(`${below1000(thousand)} Thousand`);
	if (n) parts.push(below1000(n));
	return parts.join(' ');
};
const amountInWords = (amount, currency = 'PKR') => {
	const value = Math.round((Number(amount) || 0) * 100) / 100;
	const whole = Math.floor(value);
	const fraction = Math.round((value - whole) * 100);
	const [major, minor] = currency === 'USD' ? ['US Dollars', 'Cents'] : ['Rupees', 'Paisa'];
	return `${major} ${intToWords(whole)}${fraction ? ` and ${intToWords(fraction)} ${minor}` : ''} Only`;
};

const Header = ({ title, subtitle, status, statusColor }) =>
	h(
		View,
		{ style: s.header },
		LOGO_SRC ? h(Image, { src: LOGO_SRC, style: s.logo }) : h(Text, { style: s.logoText }, 'TechSynergy'),
		h(
			View,
			{ style: s.titleWrap },
			h(Text, { style: s.title }, title),
			subtitle ? h(Text, { style: s.subtitle }, subtitle) : null,
			status ? h(Text, { style: [s.statusPill, { backgroundColor: statusColor || BRAND }] }, status) : null
		)
	);

const MetaGrid = ({ items }) =>
	h(
		View,
		{ style: s.metaGrid },
		items.map(([label, value], i) =>
			h(
				View,
				{ key: `m${i}`, style: [s.metaCell, (i + 1) % 4 === 0 ? { borderRightWidth: 0 } : {}] },
				h(Text, { style: s.metaLabel }, label),
				h(Text, { style: s.metaValue }, value == null || value === '' ? '-' : String(value))
			)
		)
	);

const Party = ({ heading, name, rows }) =>
	h(
		View,
		{ style: s.party },
		h(View, { style: s.partyHead }, h(Text, { style: s.partyHeadText }, heading)),
		h(
			View,
			{ style: s.partyBody },
			h(Text, { style: s.partyName }, name || '-'),
			rows
				.filter(([, v]) => v)
				.map(([k, v], i) =>
					h(View, { key: `p${i}`, style: s.kv }, h(Text, { style: s.kvLabel }, k), h(Text, { style: s.kvValue }, String(v)))
				)
		)
	);

/** columns: [{ label, width, align }]; rows: arrays of cells (string | [main, sub]) */
const Table = ({ columns, rows, footer }) => {
	const cell = (c, col, key, header = false, blank = '-') => {
		const style = [header ? s.th : s.td, { width: col.width }, col.align === 'right' ? s.right : col.align === 'center' ? s.center : {}];
		if (Array.isArray(c)) {
			return h(
				View,
				{ key, style: { width: col.width, paddingVertical: 4, paddingHorizontal: 3 } },
				h(Text, { style: [s.td, { padding: 0 }, col.align === 'right' ? s.right : {}] }, c[0] ?? '-'),
				c[1] ? h(Text, { style: [s.tdSub, col.align === 'right' ? s.right : {}] }, c[1]) : null
			);
		}
		return h(Text, { key, style }, c == null || c === '' ? blank : String(c));
	};
	return h(
		View,
		{ style: s.table },
		h(View, { style: s.thRow, fixed: true }, columns.map((col, i) => cell(col.label, col, `h${i}`, true))),
		rows.map((r, ri) =>
			h(View, { key: `r${ri}`, style: [s.tr, ri % 2 ? s.trAlt : {}], wrap: false }, r.map((c, ci) => cell(c, columns[ci], `r${ri}c${ci}`)))
		),
		footer ? h(View, { style: s.tfRow }, footer.map((c, ci) => cell(c, columns[ci], `f${ci}`, false, ''))) : null
	);
};

const Footer = ({ left }) =>
	h(
		View,
		{ style: s.footer, fixed: true },
		h(
			View,
			{ style: s.footerRow },
			h(Text, { style: s.footerText }, left || COMPANY.footer[0]),
			h(Text, { style: s.footerText, render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}` })
		),
		h(Text, { style: [s.footerText, { marginTop: 2 }] }, COMPANY.footer[1])
	);

const Signatures = ({ labels }) =>
	h(
		View,
		{ style: s.signRow, wrap: false },
		labels.map((l, i) =>
			h(View, { key: `s${i}`, style: s.signBox }, h(View, { style: s.signLine }), h(Text, { style: s.small }, l))
		)
	);

export {
	h,
	s,
	COMPANY,
	FBR_LOGO_SRC,
	BRAND,
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
};

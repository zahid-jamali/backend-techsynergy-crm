/**
 * Sale-type presets and the PRAL sandbox scenarios this seller must clear.
 * Every sample below was validated against validateinvoicedata_sb before
 * being committed (sandbox, seller G141420, Sindh).
 */

const SALE_TYPES = {
	standard: {
		key: 'standard',
		label: 'Goods at standard rate',
		saleType: 'Goods at standard rate (default)',
		rate: '18%',
		sroScheduleNo: '',
		sroItemSerialNo: '',
	},
	reduced: {
		key: 'reduced',
		label: 'Goods at reduced rate (8th Schedule)',
		saleType: 'Goods at Reduced Rate',
		rate: '1%',
		sroScheduleNo: 'EIGHTH SCHEDULE Table 1',
		sroItemSerialNo: '82',
		extraTaxBlank: true,
	},
	exempt: {
		key: 'exempt',
		label: 'Exempt goods (6th Schedule)',
		saleType: 'Exempt goods',
		rate: 'Exempt',
		sroScheduleNo: '6th Schd Table I',
		sroItemSerialNo: '100',
		extraTaxBlank: true,
	},
	zero: {
		key: 'zero',
		label: 'Zero-rated goods (5th Schedule)',
		saleType: 'Goods at zero-rate',
		rate: '0%',
		sroScheduleNo: '327(I)/2008',
		sroItemSerialNo: '1',
	},
	thirdSchedule: {
		key: 'thirdSchedule',
		label: '3rd Schedule goods (retail price)',
		saleType: '3rd Schedule Goods',
		rate: '18%',
		sroScheduleNo: '',
		sroItemSerialNo: '',
		needsFixedValue: true,
	},
	processing: {
		key: 'processing',
		label: 'Processing / conversion of goods',
		saleType: 'Processing/Conversion of Goods',
		rate: '5%',
		sroScheduleNo: '',
		sroItemSerialNo: '',
	},
	fedInSt: {
		key: 'fedInSt',
		label: 'Goods with FED in ST mode',
		saleType: 'Goods (FED in ST Mode)',
		rate: '18% and Rs. 80 per Liter',
		sroScheduleNo: '',
		sroItemSerialNo: '',
	},
	sro297: {
		key: 'sro297',
		label: 'Goods listed in SRO 297(I)/2023',
		saleType: 'Goods as per SRO.297(|)/2023',
		rate: '25%',
		sroScheduleNo: '297(I)/2023-Table-I',
		sroItemSerialNo: '12',
	},
};

/** Sandbox scenario resolved from the invoice's sale type and buyer. */
const scenarioFor = (saleTypeKey, buyerRegistrationType, retailToEndConsumer = false) => {
	if (retailToEndConsumer) {
		if (saleTypeKey === 'standard') return 'SN026';
		if (saleTypeKey === 'thirdSchedule') return 'SN027';
		if (saleTypeKey === 'reduced') return 'SN028';
	}
	switch (saleTypeKey) {
		case 'standard':
			return buyerRegistrationType === 'Registered' ? 'SN001' : 'SN002';
		case 'reduced':
			return 'SN005';
		case 'exempt':
			return 'SN006';
		case 'zero':
			return 'SN007';
		case 'thirdSchedule':
			return 'SN008';
		case 'processing':
			return 'SN016';
		case 'fedInSt':
			return 'SN017';
		case 'sro297':
			return 'SN024';
		default:
			return 'SN001';
	}
};

const TEST_BUYERS = {
	Registered: { ntnCnic: '2046004', name: 'FBR Sandbox Registered Buyer' },
	Unregistered: { ntnCnic: '1000000000000', name: 'Walk-in Customer' },
};

/** The 12 scenarios assigned to this seller in IRIS. */
const SCENARIOS = [
	{ id: 'SN001', title: 'Goods at Standard Rate to Registered Buyers', saleTypeKey: 'standard', buyer: 'Registered', item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN002', title: 'Goods at Standard Rate to Unregistered Buyers', saleTypeKey: 'standard', buyer: 'Unregistered', item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN005', title: 'Reduced Rate Sale', saleTypeKey: 'reduced', buyer: 'Unregistered', item: { hsCode: '0102.2930', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN006', title: 'Exempt Goods Sale', saleTypeKey: 'exempt', buyer: 'Unregistered', item: { hsCode: '0102.2930', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN007', title: 'Zero Rated Sale', saleTypeKey: 'zero', buyer: 'Unregistered', item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN008', title: 'Sale of 3rd Schedule Goods', saleTypeKey: 'thirdSchedule', buyer: 'Unregistered', item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000, fixedNotifiedValue: 1000 } },
	{ id: 'SN016', title: 'Processing / Conversion of Goods', saleTypeKey: 'processing', buyer: 'Unregistered', item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN017', title: 'Sale of Goods where FED is Charged in ST Mode', saleTypeKey: 'fedInSt', buyer: 'Unregistered', item: { hsCode: '2710.1240', uoM: 'Liter', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN024', title: 'Goods Sold that are Listed in SRO 297(1)/2023', saleTypeKey: 'sro297', buyer: 'Unregistered', item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN026', title: 'Sale to End Consumer by Retailers (Standard Rate)', saleTypeKey: 'standard', buyer: 'Unregistered', retail: true, item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
	{ id: 'SN027', title: 'Sale to End Consumer by Retailers (3rd Schedule)', saleTypeKey: 'thirdSchedule', buyer: 'Unregistered', retail: true, item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000, fixedNotifiedValue: 1000 } },
	{ id: 'SN028', title: 'Sale to End Consumer by Retailers (Reduced Rate)', saleTypeKey: 'reduced', buyer: 'Unregistered', retail: true, saleTypeOverride: { sroItemSerialNo: '70' }, item: { hsCode: '0101.2100', uoM: 'Numbers, pieces, units', quantity: 1, unitPrice: 1000 } },
];

const PROVINCES = [
	'Sindh',
	'Punjab',
	'Khyber Pakhtunkhwa',
	'Balochistan',
	'Capital Territory',
	'Gilgit Baltistan',
	'Azad Jammu and Kashmir',
];

/** Best-effort province from a free-text state/city. */
const guessProvince = (text = '') => {
	const t = String(text).toLowerCase();
	if (/sindh|karachi|hyderabad|sukkur|larkana/.test(t)) return 'Sindh';
	if (/punjab|lahore|faisalabad|multan|rawalpindi|gujranwala|sialkot/.test(t)) return 'Punjab';
	if (/khyber|kpk|kp\b|peshawar|mardan|abbottabad/.test(t)) return 'Khyber Pakhtunkhwa';
	if (/baloch|quetta|gwadar/.test(t)) return 'Balochistan';
	if (/islamabad|capital|ict/.test(t)) return 'Capital Territory';
	if (/gilgit/.test(t)) return 'Gilgit Baltistan';
	if (/azad|ajk|muzaffarabad|mirpur/.test(t)) return 'Azad Jammu and Kashmir';
	return '';
};

module.exports = { SALE_TYPES, SCENARIOS, TEST_BUYERS, PROVINCES, scenarioFor, guessProvince };

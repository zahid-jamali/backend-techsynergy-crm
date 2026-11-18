/**
 * Run the assigned FBR sandbox scenarios from the command line.
 *
 *   node scripts/fbr-scenarios.js              # validate all
 *   node scripts/fbr-scenarios.js --post       # post all (creates sandbox IRNs)
 *   node scripts/fbr-scenarios.js SN001 SN017  # only these
 *
 * Uses the same payload builder as the CRM, so a pass here means the
 * Finance → FBR Digital Invoicing page will pass too.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const config = require('../lib/fbr/config');
const client = require('../lib/fbr/client');
const { SCENARIOS } = require('../lib/fbr/scenarios');
const { scenarioDoc } = require('../lib/fbr/invoiceService');

const args = process.argv.slice(2);
const mode = args.includes('--post') ? 'post' : 'validate';
const only = args.filter((a) => /^SN\d{3}$/i.test(a)).map((a) => a.toUpperCase());

(async () => {
	if (config.env() !== 'sandbox') {
		console.error('FBR_ENV is not sandbox — refusing to run test scenarios.');
		process.exit(1);
	}
	console.log(`FBR ${config.env()} · ${mode} · seller ${config.seller().ntnCnic}\n`);
	let failed = 0;
	for (const s of SCENARIOS) {
		if (only.length && !only.includes(s.id)) continue;
		const payload = client.buildPayload(scenarioDoc(s));
		const errors = client.preflight(payload);
		if (errors.length) {
			failed++;
			console.log(`${s.id}  PRE-FLIGHT  ${errors.join('; ')}`);
			continue;
		}
		const { result } = await client.send(mode, payload);
		if (!result.ok) failed++;
		console.log(
			`${s.id}  ${result.ok ? 'PASS' : 'FAIL'}  ${result.irn || ''}${
				result.ok ? '' : `[${result.errorCode || result.httpStatus}] ${result.error}`
			}`
		);
	}
	process.exit(failed ? 1 : 0);
})();

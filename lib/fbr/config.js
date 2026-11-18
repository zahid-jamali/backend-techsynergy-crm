/**
 * FBR Digital Invoicing (PRAL DI API v1.11) configuration.
 *
 * Every secret comes from the environment. The same DI URLs serve sandbox
 * and production; PRAL routes by token, but the sandbox methods carry a
 * `_sb` suffix, so we pick the URL from FBR_ENV as well.
 */

const GATEWAY = 'https://gw.fbr.gov.pk';

const env = () => (process.env.FBR_ENV || 'sandbox').toLowerCase() === 'production'
	? 'production'
	: 'sandbox';

const isEnabled = () => String(process.env.FBR_ENABLED || 'false').toLowerCase() === 'true';

const token = () =>
	env() === 'production'
		? process.env.FBR_PRODUCTION_TOKEN || ''
		: process.env.FBR_SANDBOX_TOKEN || '';

const urls = () => {
	const suffix = env() === 'production' ? '' : '_sb';
	return {
		post: `${GATEWAY}/di_data/v1/di/postinvoicedata${suffix}`,
		validate: `${GATEWAY}/di_data/v1/di/validateinvoicedata${suffix}`,
		reference: `${GATEWAY}/pdi`,
		dist: `${GATEWAY}/dist/v1`,
	};
};

const seller = () => ({
	ntnCnic: (process.env.FBR_SELLER_NTN || '').trim(),
	businessName: (process.env.FBR_SELLER_BUSINESS_NAME || '').trim(),
	province: (process.env.FBR_SELLER_PROVINCE || 'Sindh').trim(),
	address: (process.env.FBR_SELLER_ADDRESS || '').trim(),
});

const timeoutMs = () => Number(process.env.FBR_TIMEOUT_MS) || 30000;

/** Public view of the configuration — never includes the token. */
const publicConfig = () => {
	const s = seller();
	const t = token();
	return {
		enabled: isEnabled(),
		environment: env(),
		tokenConfigured: Boolean(t),
		tokenHint: t ? `••••${t.slice(-4)}` : null,
		seller: s,
		ready: isEnabled() && Boolean(t) && Boolean(s.ntnCnic) && Boolean(s.businessName),
		endpoints: { post: urls().post, validate: urls().validate },
	};
};

module.exports = { env, isEnabled, token, urls, seller, timeoutMs, publicConfig };

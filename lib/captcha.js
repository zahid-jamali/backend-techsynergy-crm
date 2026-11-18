/**
 * Login bot protection.
 *
 * Provider "turnstile" — Cloudflare Turnstile, used when
 * TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY are configured.
 * Provider "recaptcha" — Google reCAPTCHA v2 ("I'm not a robot" checkbox),
 * used when RECAPTCHA_SITE_KEY + RECAPTCHA_SECRET_KEY are configured.
 * Provider "builtin"   — self-hosted, signed SVG image challenge, used
 * otherwise so the login is never left unprotected.
 */
const crypto = require('crypto');

const TTL_MS = 5 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const used = new Map(); // nonce -> expiry (single-use challenges)

const secret = () => process.env.CAPTCHA_SECRET || process.env.JWT_SECRET || 'change-me';

const provider = () => {
	if (process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY) return 'turnstile';
	if (process.env.RECAPTCHA_SITE_KEY && process.env.RECAPTCHA_SECRET_KEY) return 'recaptcha';
	return 'builtin';
};

const sign = (text) => crypto.createHmac('sha256', secret()).update(text).digest('base64url');

const sweep = () => {
	const now = Date.now();
	for (const [k, exp] of used) if (exp < now) used.delete(k);
};

const rand = (min, max) => min + Math.random() * (max - min);

const renderSvg = (code) => {
	const w = 160;
	const hgt = 52;
	const parts = [`<rect width="${w}" height="${hgt}" rx="8" fill="#f1f5f9"/>`];
	for (let i = 0; i < 6; i++) {
		parts.push(
			`<path d="M${rand(0, w)} ${rand(0, hgt)} Q${rand(0, w)} ${rand(0, hgt)} ${rand(0, w)} ${rand(0, hgt)}" stroke="hsl(${Math.floor(rand(200, 240))},40%,${Math.floor(rand(55, 75))}%)" stroke-width="${rand(1, 2).toFixed(1)}" fill="none"/>`
		);
	}
	for (let i = 0; i < 30; i++) {
		parts.push(`<circle cx="${rand(0, w).toFixed(1)}" cy="${rand(0, hgt).toFixed(1)}" r="${rand(0.6, 1.6).toFixed(1)}" fill="#94a3b8"/>`);
	}
	code.split('').forEach((ch, i) => {
		const x = 18 + i * 27 + rand(-3, 3);
		const y = 35 + rand(-5, 5);
		const rot = rand(-22, 22).toFixed(1);
		parts.push(
			`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Verdana,Arial,sans-serif" font-size="${Math.floor(rand(24, 30))}" font-weight="700" fill="hsl(${Math.floor(rand(210, 230))},70%,${Math.floor(rand(18, 32))}%)" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})">${ch}</text>`
		);
	});
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}">${parts.join('')}</svg>`;
};

/** New built-in challenge: the answer itself never leaves the server unsigned. */
const createChallenge = () => {
	const code = Array.from({ length: 5 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
	const nonce = crypto.randomBytes(12).toString('base64url');
	const exp = Date.now() + TTL_MS;
	const body = Buffer.from(JSON.stringify({ n: nonce, e: exp })).toString('base64url');
	const token = `${body}.${sign(`${body}|${code}`)}`;
	return { token, svg: `data:image/svg+xml;base64,${Buffer.from(renderSvg(code)).toString('base64')}`, expiresAt: exp };
};

const verifyBuiltin = (token, answer) => {
	if (!token || !answer) return false;
	const [body, mac] = String(token).split('.');
	if (!body || !mac) return false;
	let data;
	try {
		data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
	} catch {
		return false;
	}
	if (!data?.n || !data?.e || data.e < Date.now()) return false;
	sweep();
	if (used.has(data.n)) return false;
	used.set(data.n, data.e); // burn on first attempt, right or wrong
	const expected = sign(`${body}|${String(answer).trim().toUpperCase()}`);
	const a = Buffer.from(expected);
	const b = Buffer.from(mac);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifyTurnstile = async (responseToken, remoteIp) => {
	if (!responseToken) return false;
	try {
		const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				secret: process.env.TURNSTILE_SECRET_KEY,
				response: responseToken,
				...(remoteIp ? { remoteip: remoteIp } : {}),
			}),
		});
		const data = await res.json();
		return Boolean(data.success);
	} catch (err) {
		console.error('Cloudflare Turnstile verify failed:', err.message);
		return false;
	}
};

const verifyRecaptcha = async (responseToken, remoteIp) => {
	if (!responseToken) return false;
	try {
		const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				secret: process.env.RECAPTCHA_SECRET_KEY,
				response: responseToken,
				...(remoteIp ? { remoteip: remoteIp } : {}),
			}),
		});
		const data = await res.json();
		return Boolean(data.success);
	} catch (err) {
		console.error('reCAPTCHA verify failed:', err.message);
		return false;
	}
};

/** Public challenge description for the login page. */
const challenge = () => {
	const p = provider();
	if (p === 'turnstile') {
		return { provider: 'turnstile', siteKey: process.env.TURNSTILE_SITE_KEY };
	}
	if (p === 'recaptcha') {
		return { provider: 'recaptcha', siteKey: process.env.RECAPTCHA_SITE_KEY };
	}
	return { provider: 'builtin', ...createChallenge() };
};

/** body: { captchaToken, captchaAnswer } (builtin) or { captchaToken } (turnstile / recaptcha) */
const verify = async (body = {}, remoteIp) => {
	const p = provider();
	if (p === 'turnstile') return verifyTurnstile(body.captchaToken, remoteIp);
	if (p === 'recaptcha') return verifyRecaptcha(body.captchaToken, remoteIp);
	return verifyBuiltin(body.captchaToken, body.captchaAnswer);
};

module.exports = { challenge, verify, provider };

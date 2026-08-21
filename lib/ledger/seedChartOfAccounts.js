const ChartOfAccount = require('../../models/ChartOfAccount');

const SYSTEM_ACCOUNTS = [
	{ code: '1100', name: 'Cash', type: 'asset', normalBalance: 'debit', currencyHint: 'any' },
	{ code: '1110', name: 'Bank PKR', type: 'asset', normalBalance: 'debit', currencyHint: 'PKR' },
	{ code: '1120', name: 'Bank USD', type: 'asset', normalBalance: 'debit', currencyHint: 'USD' },
	{ code: '1200', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit', currencyHint: 'any' },
	{ code: '2100', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit', currencyHint: 'any' },
	{ code: '3100', name: 'Opening Balance Equity', type: 'equity', normalBalance: 'credit', currencyHint: 'any' },
	{ code: '4100', name: 'Sales', type: 'income', normalBalance: 'credit', currencyHint: 'any' },
	{ code: '5100', name: 'Purchases', type: 'expense', normalBalance: 'debit', currencyHint: 'any' },
];

let seeded = false;

const ensureChartOfAccounts = async (userId) => {
	if (seeded) return;
	await Promise.all(
		SYSTEM_ACCOUNTS.map((row) =>
			ChartOfAccount.updateOne(
				{ code: row.code },
				{
					$setOnInsert: {
						...row,
						isSystem: true,
						isPostable: true,
						isActive: true,
						createdBy: userId,
					},
				},
				{ upsert: true }
			)
		)
	);
	seeded = true;
};

const getAccountByCode = async (code) => {
	const account = await ChartOfAccount.findOne({
		code,
		isActive: true,
		isPostable: true,
	});
	if (!account) {
		throw new Error(`Ledger account ${code} is missing. Seed the chart of accounts.`);
	}
	return account;
};

module.exports = {
	SYSTEM_ACCOUNTS,
	ensureChartOfAccounts,
	getAccountByCode,
};

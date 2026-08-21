const axios = require('axios');
const mongoose = require('mongoose');
const Contact = require('../models/Contacts');
const Account = require('../models/Account');
const Deal = require('../models/Deals');
const Quote = require('../models/Quotes');
const User = require('../models/Users');
const SalesTarget = require('../models/SalesTarget');
const Order = require('../models/Order');

const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

const CLOSED_STAGES = ['Closed Won', 'Closed Lost', 'Closed Lost to Competition'];

let usdRateCache = { rate: 280, at: 0 };
const USD_CACHE_MS = 30 * 60 * 1000;

const getUsdToPkr = async () => {
	if (usdRateCache.rate && Date.now() - usdRateCache.at < USD_CACHE_MS) {
		return usdRateCache.rate;
	}
	try {
		const response = await axios.get('https://open.er-api.com/v6/latest/USD', {
			timeout: 2500,
		});
		const rate = Number(response.data?.rates?.PKR);
		if (rate > 0) {
			usdRateCache = { rate, at: Date.now() };
			return rate;
		}
	} catch (error) {
		console.error('USD rate fetch failed:', error.message);
	}
	return usdRateCache.rate || 280;
};

const pkrAmount = (usdRate, field = '$amount') => ({
	$cond: [
		{ $eq: ['$currency', 'USD'] },
		{ $multiply: [{ $ifNull: [field, 0] }, usdRate] },
		{ $ifNull: [field, 0] },
	],
});

const yearRange = () => {
	const now = new Date();
	return {
		now,
		start: new Date(now.getFullYear(), 0, 1),
		end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
		currentMonth: now.getMonth(),
	};
};

const buildStaffDashboard = async (userId) => {
	const userObjectId = new mongoose.Types.ObjectId(userId);
	const { start, end, currentMonth, now } = yearRange();
	const usdRate = await getUsdToPkr();
	const pkr = pkrAmount(usdRate);
	const orderPkr = pkrAmount(usdRate, '$grandTotal');

	const [
		contactCount,
		accountCount,
		dealFacet,
		quoteFacet,
		orderFacet,
		topDeals,
		recentQuotes,
		salesTarget,
	] = await Promise.all([
		Contact.countDocuments({ contactOwner: userId, isActive: true }),
		Account.countDocuments({ accountOwner: userId, isActive: true }),
		Deal.aggregate([
			{ $match: { dealOwner: userObjectId, isActive: { $ne: false } } },
			{ $addFields: { pkr } },
			{
				$facet: {
					summary: [
						{
							$group: {
								_id: null,
								totalDeals: { $sum: 1 },
								openDeals: {
									$sum: {
										$cond: [{ $in: ['$stage', CLOSED_STAGES] }, 0, 1],
									},
								},
								closedWonDeals: {
									$sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] },
								},
								closedLostDeals: {
									$sum: {
										$cond: [
											{
												$in: [
													'$stage',
													['Closed Lost', 'Closed Lost to Competition'],
												],
											},
											1,
											0,
										],
									},
								},
								pipelineValue: {
									$sum: {
										$cond: [{ $in: ['$stage', CLOSED_STAGES] }, 0, '$pkr'],
									},
								},
								weightedExpectedRevenue: {
									$sum: { $ifNull: ['$expectedRevenue', 0] },
								},
								wonValue: {
									$sum: {
										$cond: [{ $eq: ['$stage', 'Closed Won'] }, '$pkr', 0],
									},
								},
							},
						},
					],
					pipeline: [
						{ $match: { stage: { $nin: CLOSED_STAGES } } },
						{
							$group: {
								_id: '$stage',
								count: { $sum: 1 },
								totalValue: { $sum: '$pkr' },
								weightedRevenue: { $sum: { $ifNull: ['$expectedRevenue', 0] } },
							},
						},
						{ $sort: { count: -1 } },
					],
				},
			},
		]),
		Quote.aggregate([
			{ $match: { quoteOwner: userObjectId, isActive: { $ne: false } } },
			{
				$facet: {
					summary: [
						{
							$group: {
								_id: null,
								totalQuotes: { $sum: 1 },
								confirmedQuotes: {
									$sum: { $cond: [{ $eq: ['$quoteStage', 'Confirmed'] }, 1, 0] },
								},
							},
						},
					],
					stages: [
						{
							$group: {
								_id: '$quoteStage',
								count: { $sum: 1 },
								totalRevenue: { $sum: { $ifNull: ['$grandTotal', 0] } },
							},
						},
						{ $sort: { count: -1 } },
					],
				},
			},
		]),
		Order.aggregate([
			{ $match: { createdBy: userObjectId, isActive: true } },
			{ $addFields: { pkr: orderPkr } },
			{
				$facet: {
					summary: [
						{
							$group: {
								_id: null,
								totalSellOrders: { $sum: 1 },
								approvedSellOrders: {
									$sum: {
										$cond: [
											{
												$and: [
													{ $eq: ['$isSOApproved', true] },
													{ $eq: ['$status', 'Accepted'] },
												],
											},
											1,
											0,
										],
									},
								},
							},
						},
					],
					yearRevenue: [
						{
							$match: {
								isSOApproved: true,
								status: 'Accepted',
								createdAt: { $gte: start, $lte: end },
							},
						},
						{
							$group: {
								_id: null,
								totalSell: { $sum: '$pkr' },
							},
						},
					],
					monthly: [
						{
							$match: {
								isSOApproved: true,
								status: 'Accepted',
								createdAt: { $gte: start, $lte: end },
							},
						},
						{
							$group: {
								_id: { $month: '$createdAt' },
								revenue: { $sum: '$pkr' },
							},
						},
					],
				},
			},
		]),
		Deal.find({ dealOwner: userId, isActive: { $ne: false } })
			.sort({ amount: -1 })
			.limit(5)
			.select('dealName amount stage currency')
			.lean(),
		Quote.find({ quoteOwner: userId, isActive: { $ne: false } })
			.sort({ createdAt: -1 })
			.limit(5)
			.select('subject grandTotal quoteStage createdAt')
			.lean(),
		SalesTarget.findOne({
			user: userId,
			month: now.getMonth() + 1,
			year: now.getFullYear(),
		})
			.select('targetAmount')
			.lean(),
	]);

	const dealSummary = dealFacet[0]?.summary?.[0] || {};
	const quoteSummary = quoteFacet[0]?.summary?.[0] || {};
	const orderSummary = orderFacet[0]?.summary?.[0] || {};
	const totalSell = orderFacet[0]?.yearRevenue?.[0]?.totalSell || 0;
	const monthlyMap = new Map(
		(orderFacet[0]?.monthly || []).map((row) => [row._id, row.revenue])
	);
	const monthlyRevenue = [];
	for (let i = 0; i <= currentMonth; i += 1) {
		monthlyRevenue.push({
			month: MONTH_NAMES[i],
			revenue: monthlyMap.get(i + 1) || 0,
		});
	}

	const closedWon = dealSummary.closedWonDeals || 0;
	const targetedRevenue = Number(salesTarget?.targetAmount || 0);

	return {
		summaryStats: {
			contacts: contactCount,
			accounts: accountCount,
			totalDeals: dealSummary.totalDeals || 0,
			openDeals: dealSummary.openDeals || 0,
			closedWonDeals: closedWon,
			closedLostDeals: dealSummary.closedLostDeals || 0,
			totalQuotes: quoteSummary.totalQuotes || 0,
			confirmedQuotes: quoteSummary.confirmedQuotes || 0,
			totalSell,
			avgDealSize: closedWon > 0 ? Math.round((dealSummary.wonValue || 0) / closedWon) : 0,
			approvedSellOrders: orderSummary.approvedSellOrders || 0,
			totalSellOrders: orderSummary.totalSellOrders || 0,
			targetedRevenue,
			weightedExpectedRevenue: dealSummary.weightedExpectedRevenue || 0,
			pipelineValue: dealSummary.pipelineValue || 0,
		},
		monthlyRevenue,
		pipelineData: dealFacet[0]?.pipeline || [],
		quoteStageData: quoteFacet[0]?.stages || [],
		topDeals,
		recentQuotes,
		USD_RATE: usdRate,
	};
};

const buildAdminDashboard = async () => {
	const usdRate = await getUsdToPkr();
	const pkr = pkrAmount(usdRate);
	const now = new Date();
	const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

	const [
		dealFacet,
		quoteFacet,
		orderSummary,
		accountFacet,
		contactFacet,
		totalUsers,
		accountsWithContacts,
		accountsWithDeals,
	] = await Promise.all([
		Deal.aggregate([
			{ $match: { isActive: true } },
			{ $addFields: { pkr } },
			{
				$facet: {
					stats: [
						{
							$group: {
								_id: null,
								totalRevenue: {
									$sum: {
										$cond: [{ $eq: ['$stage', 'Closed Won'] }, '$pkr', 0],
									},
								},
								pipelineValue: {
									$sum: {
										$cond: [{ $in: ['$stage', CLOSED_STAGES] }, 0, '$pkr'],
									},
								},
								expectedRevenue: { $sum: { $ifNull: ['$expectedRevenue', 0] } },
								closedWonCount: {
									$sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] },
								},
								closedLostCount: {
									$sum: {
										$cond: [
											{
												$in: [
													'$stage',
													['Closed Lost', 'Closed Lost to Competition'],
												],
											},
											1,
											0,
										],
									},
								},
								totalDeals: { $sum: 1 },
								avgDealSize: { $avg: '$pkr' },
								thisMonthRevenue: {
									$sum: {
										$cond: [
											{
												$and: [
													{ $eq: ['$stage', 'Closed Won'] },
													{ $gte: ['$closingDate', startOfMonth] },
												],
											},
											'$pkr',
											0,
										],
									},
								},
								lastMonthRevenue: {
									$sum: {
										$cond: [
											{
												$and: [
													{ $eq: ['$stage', 'Closed Won'] },
													{ $gte: ['$closingDate', startOfLastMonth] },
													{ $lte: ['$closingDate', endOfLastMonth] },
												],
											},
											'$pkr',
											0,
										],
									},
								},
							},
						},
					],
					dealsByAmount: [
						{ $sort: { pkr: -1 } },
						{ $limit: 10 },
						{
							$lookup: {
								from: 'accounts',
								localField: 'account',
								foreignField: '_id',
								as: 'account',
							},
						},
						{ $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
						{
							$project: {
								dealName: 1,
								stage: 1,
								amount: '$pkr',
								account: { accountName: '$account.accountName' },
							},
						},
					],
					dealsByStageAmount: [
						{
							$group: {
								_id: '$stage',
								totalAmount: { $sum: '$pkr' },
								dealCount: { $sum: 1 },
							},
						},
						{ $sort: { totalAmount: -1 } },
					],
					dealStages: [
						{ $group: { _id: '$stage', count: { $sum: 1 } } },
						{ $sort: { count: -1 } },
					],
					revenueTrend: [
						{
							$match: {
								stage: 'Closed Won',
								closingDate: { $gte: sixMonthsAgo },
							},
						},
						{
							$group: {
								_id: {
									month: { $month: '$closingDate' },
									year: { $year: '$closingDate' },
								},
								revenue: { $sum: '$pkr' },
							},
						},
						{ $sort: { '_id.year': 1, '_id.month': 1 } },
					],
					topAccountsByRevenue: [
						{ $match: { stage: 'Closed Won' } },
						{
							$group: {
								_id: '$account',
								totalRevenue: { $sum: '$pkr' },
								dealCount: { $sum: 1 },
							},
						},
						{ $sort: { totalRevenue: -1 } },
						{ $limit: 5 },
						{
							$lookup: {
								from: 'accounts',
								localField: '_id',
								foreignField: '_id',
								as: 'account',
							},
						},
						{ $unwind: '$account' },
						{
							$project: {
								accountName: '$account.accountName',
								industry: '$account.industry',
								totalRevenue: 1,
								dealCount: 1,
							},
						},
					],
					dealsPerAccount: [
						{
							$group: {
								_id: '$account',
								dealCount: { $sum: 1 },
							},
						},
						{ $sort: { dealCount: -1 } },
						{ $limit: 8 },
						{
							$lookup: {
								from: 'accounts',
								localField: '_id',
								foreignField: '_id',
								as: 'account',
							},
						},
						{ $unwind: '$account' },
						{
							$project: {
								accountName: '$account.accountName',
								dealCount: 1,
							},
						},
					],
					userPerformance: [
						{
							$group: {
								_id: '$dealOwner',
								totalRevenue: {
									$sum: {
										$cond: [{ $eq: ['$stage', 'Closed Won'] }, '$pkr', 0],
									},
								},
								pipelineValue: {
									$sum: {
										$cond: [{ $in: ['$stage', CLOSED_STAGES] }, 0, '$pkr'],
									},
								},
								totalDeals: { $sum: 1 },
								wonDeals: {
									$sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] },
								},
							},
						},
						{ $sort: { totalRevenue: -1 } },
						{
							$lookup: {
								from: 'users',
								localField: '_id',
								foreignField: '_id',
								as: 'user',
							},
						},
						{ $unwind: '$user' },
						{
							$project: {
								name: '$user.name',
								email: '$user.email',
								designation: '$user.designation',
								totalRevenue: 1,
								pipelineValue: 1,
								totalDeals: 1,
								wonDeals: 1,
							},
						},
					],
				},
			},
		]),
		Quote.aggregate([
			{ $match: { isActive: true } },
			{
				$facet: {
					summary: [
						{
							$group: {
								_id: null,
								totalQuotes: { $sum: 1 },
								confirmedQuotes: {
									$sum: { $cond: [{ $eq: ['$quoteStage', 'Confirmed'] }, 1, 0] },
								},
							},
						},
					],
					status: [
						{ $group: { _id: '$quoteStage', value: { $sum: 1 } } },
						{ $sort: { value: -1 } },
					],
				},
			},
		]),
		Order.aggregate([
			{ $match: { isActive: true } },
			{
				$group: {
					_id: null,
					totalOrders: { $sum: 1 },
					approvedOrders: {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ['$isSOApproved', true] },
										{ $eq: ['$status', 'Accepted'] },
									],
								},
								1,
								0,
							],
						},
					},
					deliveredOrders: {
						$sum: {
							$cond: [
								{
									$in: [
										'$fulfillmentStatus',
										['delivered', 'forwarded_to_finance', 'invoiced'],
									],
								},
								1,
								0,
							],
						},
					},
				},
			},
		]),
		Account.aggregate([
			{ $match: { isActive: true } },
			{
				$facet: {
					total: [{ $count: 'count' }],
					byIndustry: [
						{ $group: { _id: { $ifNull: ['$industry', 'Unknown'] }, count: { $sum: 1 } } },
						{ $sort: { count: -1 } },
						{ $limit: 8 },
					],
					byType: [
						{
							$group: {
								_id: { $ifNull: ['$accountType', 'Unknown'] },
								count: { $sum: 1 },
							},
						},
						{ $sort: { count: -1 } },
					],
				},
			},
		]),
		Contact.aggregate([
			{ $match: { isActive: true } },
			{
				$facet: {
					total: [{ $count: 'count' }],
					perAccount: [
						{ $group: { _id: '$account', contactCount: { $sum: 1 } } },
						{ $sort: { contactCount: -1 } },
						{ $limit: 8 },
						{
							$lookup: {
								from: 'accounts',
								localField: '_id',
								foreignField: '_id',
								as: 'account',
							},
						},
						{ $unwind: '$account' },
						{
							$project: {
								accountName: '$account.accountName',
								contactCount: 1,
							},
						},
					],
				},
			},
		]),
		User.countDocuments({ isActive: true }),
		Contact.distinct('account', { isActive: true, account: { $ne: null } }),
		Deal.distinct('account', { isActive: true, account: { $ne: null } }),
	]);

	const stats = dealFacet[0]?.stats?.[0] || {};
	const quoteSummary = quoteFacet[0]?.summary?.[0] || {};
	const orders = orderSummary[0] || {};
	const totalAccounts = accountFacet[0]?.total?.[0]?.count || 0;
	const totalContacts = contactFacet[0]?.total?.[0]?.count || 0;
	const closed = (stats.closedWonCount || 0) + (stats.closedLostCount || 0);
	const winRate = closed === 0 ? 0 : Number(((stats.closedWonCount / closed) * 100).toFixed(2));
	const lastMonthRevenue = stats.lastMonthRevenue || 0;
	const thisMonthRevenue = stats.thisMonthRevenue || 0;
	const growthRate =
		lastMonthRevenue === 0
			? thisMonthRevenue > 0
				? 100
				: 0
			: Number((((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(2));

	const revenueTrend = (dealFacet[0]?.revenueTrend || []).map((item) => ({
		month: MONTH_NAMES[item._id.month - 1],
		revenue: item.revenue,
	}));

	const dealStages = (dealFacet[0]?.dealStages || []).map((d) => ({
		stage: d._id,
		count: d.count,
	}));

	const quoteStatus = (quoteFacet[0]?.status || []).map((q) => ({
		name: q._id || 'Unknown',
		value: q.value,
	}));

	return {
		USD_RATE: usdRate,
		summaryStats: {
			totalRevenue: stats.totalRevenue || 0,
			pipelineValue: stats.pipelineValue || 0,
			expectedRevenue: stats.expectedRevenue || 0,
			avgDealSize: Math.round(stats.avgDealSize || 0),
			winRate,
			totalUsers,
			totalDeals: stats.totalDeals || 0,
			totalQuotes: quoteSummary.totalQuotes || 0,
			confirmedQuotes: quoteSummary.confirmedQuotes || 0,
			totalOrders: orders.totalOrders || 0,
			approvedOrders: orders.approvedOrders || 0,
			deliveredOrders: orders.deliveredOrders || 0,
			totalAccounts,
			totalContacts,
			growthRate,
			thisMonthRevenue,
			lastMonthRevenue,
		},
		quoteStatus,
		revenueTrend,
		dealAnalytics: {
			dealsByAmount: dealFacet[0]?.dealsByAmount || [],
			dealsByStageAmount: dealFacet[0]?.dealsByStageAmount || [],
			dealStages,
		},
		accountAnalytics: {
			accountsByIndustry: accountFacet[0]?.byIndustry || [],
			accountsByType: accountFacet[0]?.byType || [],
			topAccountsByRevenue: dealFacet[0]?.topAccountsByRevenue || [],
			dealsPerAccount: dealFacet[0]?.dealsPerAccount || [],
		},
		contactAnalytics: {
			contactsPerAccount: contactFacet[0]?.perAccount || [],
		},
		userAnalytics: {
			userPerformance: dealFacet[0]?.userPerformance || [],
		},
		relationshipOverview: {
			totalAccounts,
			totalContacts,
			totalUsers,
			accountsWithDeals: (accountsWithDeals || []).length,
			accountsWithContacts: (accountsWithContacts || []).length,
		},
	};
};

module.exports = {
	getUsdToPkr,
	buildStaffDashboard,
	buildAdminDashboard,
};

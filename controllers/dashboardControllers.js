const Contact = require('../models/Contacts');
const Account = require('../models/Account');
const Deal = require('../models/Deals');
const Quote = require('../models/Quotes');
const mongoose = require('mongoose');
const convertCurrency = require('../lib/convertCurrency.js');
const User = require('../models/Users');
const SalesTarget = require('../models/SalesTarget');

const getAdminDashboard = async (req, res) => {
	try {
		const now = new Date();
		const currentYear = now.getFullYear();

		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(now.getMonth() - 5);
		sixMonthsAgo.setDate(1);

		const USD_RATE = 280; // later move to config

		/* ================= EXECUTIVE AGGREGATION ================= */

		const dealsAgg = await Deal.aggregate([
			{ $match: { isActive: true } },
			{
				$addFields: {
					normalizedAmount: {
						$cond: [
							{ $eq: ['$currency', 'USD'] },
							{ $multiply: ['$amount', USD_RATE] },
							'$amount',
						],
					},
				},
			},
			{
				$group: {
					_id: null,
					totalRevenue: {
						$sum: {
							$cond: [
								{ $eq: ['$stage', 'Closed Won'] },
								'$normalizedAmount',
								0,
							],
						},
					},
					pipelineValue: {
						$sum: {
							$cond: [
								{
									$not: {
										$in: ['$stage', ['Closed Won', 'Closed Lost']],
									},
								},
								'$normalizedAmount',
								0,
							],
						},
					},
					expectedRevenue: { $sum: '$expectedRevenue' },
					closedWonCount: {
						$sum: { $cond: [{ $eq: ['$stage', 'Closed Won'] }, 1, 0] },
					},
					closedLostCount: {
						$sum: { $cond: [{ $eq: ['$stage', 'Closed Lost'] }, 1, 0] },
					},
					totalDeals: { $sum: 1 },
					avgDealSize: { $avg: '$normalizedAmount' },
				},
			},
		]);

		const stats = dealsAgg[0] || {};

		const winRate =
			stats.closedWonCount + stats.closedLostCount === 0
				? 0
				: (
						(stats.closedWonCount /
							(stats.closedWonCount + stats.closedLostCount)) *
						100
					).toFixed(2);

		const totalUsers = await User.countDocuments({ isActive: true });
		const totalQuotes = await Quote.countDocuments({ isActive: true });

		/* ================================================== */

		const pipelineAgg = await Deal.aggregate([
			{
				$match: {
					isActive: true,
					stage: {
						$nin: [
							'Closed Won',
							'Closed Lost',
							'Closed Lost to Competition',
						],
					},
				},
			},
			{
				$addFields: {
					normalizedAmount: {
						$cond: [
							{ $eq: ['$currency', 'USD'] },
							{ $multiply: ['$amount', USD_RATE] },
							'$amount',
						],
					},
				},
			},
			{
				$group: {
					_id: null,
					totalPipelineValue: { $sum: '$normalizedAmount' },
				},
			},
		]);

		const pipelineValue = pipelineAgg[0]?.totalPipelineValue || 0;

		/* =============================================================*/

		const dealsByAmount = await Deal.aggregate([
			{
				$match: {
					isActive: true,
				},
			},
			{
				$addFields: {
					normalizedAmount: {
						$cond: [
							{ $eq: ['$currency', 'USD'] },
							{ $multiply: ['$amount', USD_RATE] },
							'$amount',
						],
					},
				},
			},
			{
				$project: {
					dealName: 1,
					stage: 1,
					amount: '$normalizedAmount',
				},
			},
			{ $sort: { amount: -1 } },
			{ $limit: 10 },
		]);

		const dealsByStageAmount = await Deal.aggregate([
			{
				$match: {
					isActive: true,
				},
			},
			{
				$addFields: {
					normalizedAmount: {
						$cond: [
							{ $eq: ['$currency', 'USD'] },
							{ $multiply: ['$amount', USD_RATE] },
							'$amount',
						],
					},
				},
			},
			{
				$group: {
					_id: '$stage',
					totalAmount: { $sum: '$normalizedAmount' },
					dealCount: { $sum: 1 },
				},
			},
			{ $sort: { totalAmount: -1 } },
		]);

		/* ================= REVENUE TREND ================= */

		const revenueTrendAgg = await Deal.aggregate([
			{
				$match: {
					stage: 'Closed Won',
					closingDate: { $gte: sixMonthsAgo },
					isActive: true,
				},
			},
			{
				$addFields: {
					normalizedAmount: {
						$cond: [
							{ $eq: ['$currency', 'USD'] },
							{ $multiply: ['$amount', USD_RATE] },
							'$amount',
						],
					},
				},
			},
			{
				$group: {
					_id: {
						month: { $month: '$closingDate' },
						year: { $year: '$closingDate' },
					},
					revenue: { $sum: '$normalizedAmount' },
				},
			},
			{ $sort: { '_id.year': 1, '_id.month': 1 } },
		]);

		const monthNames = [
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

		const revenueTrend = revenueTrendAgg.map((item) => ({
			month: monthNames[item._id.month - 1],
			revenue: item.revenue,
		}));

		/* ================= DEAL STAGES ================= */

		const dealStagesAgg = await Deal.aggregate([
			{ $match: { isActive: true } },
			{ $group: { _id: '$stage', count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
		]);

		const dealStages = dealStagesAgg.map((d) => ({
			stage: d._id,
			count: d.count,
		}));

		/* ================= REVENUE BY STAFF ================= */

		const revenueByStaff = await Deal.aggregate([
			{ $match: { stage: 'Closed Won', isActive: true } },
			{
				$addFields: {
					normalizedAmount: {
						$cond: [
							{ $eq: ['$currency', 'USD'] },
							{ $multiply: ['$amount', USD_RATE] },
							'$amount',
						],
					},
				},
			},
			{
				$group: {
					_id: '$dealOwner',
					revenue: { $sum: '$normalizedAmount' },
				},
			},
			{ $sort: { revenue: -1 } },
			{ $limit: 5 },
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
					revenue: 1,
				},
			},
		]);

		/* ================= QUOTE STATUS ================= */

		const quoteStatusAgg = await Quote.aggregate([
			{ $match: { isActive: true } },
			{ $group: { _id: '$quoteStage', value: { $sum: 1 } } },
			{ $sort: { value: -1 } },
		]);

		const quoteStatus = quoteStatusAgg.map((q) => ({
			name: q._id,
			value: q.value,
		}));

		/* ================= MONTHLY GROWTH ================= */

		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const startOfLastMonth = new Date(
			now.getFullYear(),
			now.getMonth() - 1,
			1
		);
		const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

		const [thisMonthAgg, lastMonthAgg] = await Promise.all([
			Deal.aggregate([
				{
					$match: {
						stage: 'Closed Won',
						closingDate: { $gte: startOfMonth },
						isActive: true,
					},
				},
				{ $group: { _id: null, total: { $sum: '$amount' } } },
			]),
			Deal.aggregate([
				{
					$match: {
						stage: 'Closed Won',
						closingDate: {
							$gte: startOfLastMonth,
							$lte: endOfLastMonth,
						},
						isActive: true,
					},
				},
				{ $group: { _id: null, total: { $sum: '$amount' } } },
			]),
		]);

		const thisMonthRevenue = thisMonthAgg[0]?.total || 0;
		const lastMonthRevenue = lastMonthAgg[0]?.total || 0;

		const growthRate =
			lastMonthRevenue === 0
				? 100
				: (
						((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) *
						100
					).toFixed(2);

		/* ================= ACCOUNT ANALYTICS ================= */

		const totalAccounts = await Account.countDocuments({ isActive: true });

		const accountsByIndustry = await Account.aggregate([
			{ $match: { isActive: true } },
			{
				$group: {
					_id: '$industry',
					count: { $sum: 1 },
				},
			},
			{ $sort: { count: -1 } },
		]);

		const accountsByType = await Account.aggregate([
			{ $match: { isActive: true } },
			{
				$group: {
					_id: '$accountType',
					count: { $sum: 1 },
				},
			},
			{ $sort: { count: -1 } },
		]);

		/* ===== Top Accounts by Deal Revenue ===== */

		const topAccountsByRevenue = await Deal.aggregate([
			{ $match: { isActive: true, stage: 'Closed Won' } },
			{
				$addFields: {
					normalizedAmount: {
						$cond: [
							{ $eq: ['$currency', 'USD'] },
							{ $multiply: ['$amount', USD_RATE] },
							'$amount',
						],
					},
				},
			},
			{
				$group: {
					_id: '$account',
					totalRevenue: { $sum: '$normalizedAmount' },
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
		]);

		/* ================= CONTACT ANALYTICS ================= */

		const totalContacts = await Contact.countDocuments({ isActive: true });

		const contactsPerAccount = await Contact.aggregate([
			{ $match: { isActive: true } },
			{
				$group: {
					_id: '$account',
					contactCount: { $sum: 1 },
				},
			},
			{ $sort: { contactCount: -1 } },
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
					contactCount: 1,
				},
			},
		]);

		/* ================= DEALS PER ACCOUNT ================= */

		const dealsPerAccount = await Deal.aggregate([
			{ $match: { isActive: true } },
			{
				$group: {
					_id: '$account',
					dealCount: { $sum: 1 },
				},
			},
			{ $sort: { dealCount: -1 } },
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
					dealCount: 1,
				},
			},
		]);

		/* ================= USER ANALYTICS ================= */

		const userPerformance = await Deal.aggregate([
			{ $match: { isActive: true } },
			{
				$addFields: {
					normalizedAmount: {
						$cond: [
							{ $eq: ['$currency', 'USD'] },
							{ $multiply: ['$amount', USD_RATE] },
							'$amount',
						],
					},
				},
			},
			{
				$group: {
					_id: '$dealOwner',
					totalRevenue: {
						$sum: {
							$cond: [
								{ $eq: ['$stage', 'Closed Won'] },
								'$normalizedAmount',
								0,
							],
						},
					},
					totalDeals: { $sum: 1 },
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
					totalDeals: 1,
				},
			},
		]);

		const relationshipOverview = {
			totalAccounts,
			totalContacts,
			totalUsers,
			accountsWithDeals: dealsPerAccount.length,
			accountsWithContacts: contactsPerAccount.length,
		};

		/* ================= FINAL RESPONSE ================= */

		res.json({
			summaryStats: {
				totalRevenue: stats.totalRevenue || 0,
				pipelineValue: stats.pipelineValue || 0,
				expectedRevenue: stats.expectedRevenue || 0,
				avgDealSize: Math.round(stats.avgDealSize || 0),
				winRate: Number(winRate),
				totalUsers,
				totalDeals: stats.totalDeals || 0,
				totalQuotes,
				totalAccounts,
				totalContacts,
				growthRate: Number(growthRate),
			},

			revenueTrend,

			dealAnalytics: {
				dealsByAmount,
				dealsByStageAmount,
				dealStages,
			},

			accountAnalytics: {
				accountsByIndustry,
				accountsByType,
				topAccountsByRevenue,
				dealsPerAccount,
			},

			contactAnalytics: {
				contactsPerAccount,
			},

			userAnalytics: {
				userPerformance,
			},

			relationshipOverview,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: 'Dashboard Error' });
	}
};

const getYearRange = () => {
	const now = new Date();
	const start = new Date(now.getFullYear(), 0, 1);
	const end = new Date(now.getFullYear(), now.getMonth(), 31, 23, 59, 59);
	return { start, end };
};

const getDashboardData = async (req, res) => {
	try {
		const userId = req.user.id;
		const userObjectId = new mongoose.Types.ObjectId(userId);

		const { start, end } = getYearRange();
		const currentMonth = new Date().getMonth(); // 0-based

		/* ===============================
		   BASIC COUNTS
		================================= */

		const [
			contacts,
			accounts,
			totalDeals,
			openDeals,
			closedWonDeals,
			closedLostDeals,
			totalQuotes,
			confirmedQuotes,
			approvedQuotes,
		] = await Promise.all([
			Contact.countDocuments({ contactOwner: userId, isActive: true }),

			Account.countDocuments({ accountOwner: userId, isActive: true }),

			Deal.countDocuments({ dealOwner: userId }),

			Deal.countDocuments({
				dealOwner: userId,
				stage: {
					$nin: [
						'Closed Won',
						'Closed Lost',
						'Closed Lost to Competition',
					],
				},
			}),

			Deal.countDocuments({
				dealOwner: userId,
				stage: 'Closed Won',
			}),

			Deal.countDocuments({
				dealOwner: userId,
				stage: { $in: ['Closed Lost', 'Closed Lost to Competition'] },
			}),

			Quote.countDocuments({ quoteOwner: userId }),

			Quote.countDocuments({
				quoteOwner: userId,
				quoteStage: 'Confirmed',
			}),

			Quote.countDocuments({
				quoteOwner: userId,
				isSOApproved: true,
			}),
		]);

		/* ===============================
		   REVENUE CALCULATIONS
		================================= */

		const convertToPKR = async (amount, currency) => {
			if (!amount) return 0;

			switch (currency) {
				case 'USD':
					let tmp = await convertCurrency(amount, 'USD', 'PKR');
					return tmp;
				case 'PKR':
				default:
					return amount;
			}
		};

		const deals = await Deal.find({ dealOwner: userId });

		const dealValues = await Promise.all(
			deals.map((d) => convertToPKR(d.amount, d.currency))
		);

		const totalDealValue = dealValues.reduce(
			(sum, val) => sum + Number(val || 0),
			0
		);

		const weightedExpectedRevenue = dealValues.reduce(
			(sum, val) => sum + Number(val || 0),
			0
		);

		const approvedSales = await Quote.find({
			quoteOwner: userId,
			isSOApproved: true,
			createdAt: { $gte: start, $lte: end },
		});

		const saleValues = await Promise.all(
			approvedSales.map((q) => convertToPKR(q.grandTotal, q.currency))
		);

		const totalSell = saleValues.reduce(
			(sum, val) => sum + Number(val || 0),
			0
		);

		const avgDealSize =
			closedWonDeals > 0 ? totalDealValue / closedWonDeals : 0;

		const winRate =
			totalDeals > 0 ? ((closedWonDeals / totalDeals) * 100).toFixed(2) : 0;

		const conversionRate =
			totalQuotes > 0
				? ((approvedQuotes / totalQuotes) * 100).toFixed(2)
				: 0;

		const summaryStats = {
			contacts,
			accounts,
			totalDeals,
			openDeals,
			closedWonDeals,
			closedLostDeals,
			totalQuotes,
			confirmedQuotes,
			approvedQuotes,
			totalSell,
			weightedExpectedRevenue,
			avgDealSize: Math.round(avgDealSize),
			winRate,
			conversionRate,
		};

		/* ===============================
		   MONTHLY REVENUE (ONLY UNTIL CURRENT MONTH)
		================================= */

		const monthlyRevenueAgg = await Quote.aggregate([
			{
				$match: {
					quoteOwner: userId,
					isSOApproved: true,
					createdAt: { $gte: start, $lte: end },
				},
			},
			{
				$group: {
					_id: { $month: '$createdAt' },
					revenue: { $sum: '$grandTotal' },
				},
			},
		]);

		const monthNames = [
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

		const monthlyRevenue = [];

		for (let i = 0; i <= currentMonth; i++) {
			const found = monthlyRevenueAgg.find((m) => m._id === i + 1);

			monthlyRevenue.push({
				month: monthNames[i],
				revenue: found ? found.revenue : 0,
			});
		}

		/* ===============================
		   PIPELINE STAGE BREAKDOWN
		================================= */

		const pipelineData = await Deal.aggregate([
			{
				$match: {
					dealOwner: userObjectId,
					isActive: true,
					stage: {
						$nin: [
							'Closed Won',
							'Closed Lost',
							'Closed Lost to Competition',
						],
					},
				},
			},
			{
				$group: {
					_id: '$stage',
					count: { $sum: 1 },
					totalValue: { $sum: '$amount' }, // 🔥 extra useful data
					weightedRevenue: { $sum: '$expectedRevenue' }, // 🔥 powerful metric
				},
			},
			{
				$sort: { count: -1 },
			},
		]);

		/* ===============================
		   QUOTE STAGE BREAKDOWN
		================================= */

		const quoteStageData = await Quote.aggregate([
			{
				$match: {
					quoteOwner: userObjectId,
					isActive: true,
				},
			},
			{
				$group: {
					_id: '$quoteStage',
					count: { $sum: 1 },
					totalRevenue: { $sum: '$grandTotal' }, // 🔥 revenue per stage
				},
			},
			{
				$sort: { count: -1 },
			},
		]);

		/* ===============================
		   TOP DEALS
		================================= */

		const topDeals = await Deal.find({
			dealOwner: userId,
		})
			.sort({ amount: -1 })
			.limit(5)
			.select('dealName amount stage currency');

		/* ===============================
		   RECENT QUOTES
		================================= */

		const recentQuotes = await Quote.find({
			quoteOwner: userId,
		})
			.sort({ createdAt: -1 })
			.limit(5)
			.select('subject grandTotal quoteStage createdAt');

		/* ===============================
		   FINAL RESPONSE
		================================= */

		res.status(200).json({
			summaryStats,
			monthlyRevenue,
			pipelineData,
			quoteStageData,
			topDeals,
			recentQuotes,
		});
	} catch (error) {
		console.error('Dashboard error:', error);
		res.status(500).json({
			message: 'Failed to load dashboard data',
		});
	}
};

module.exports = { getDashboardData, getAdminDashboard };

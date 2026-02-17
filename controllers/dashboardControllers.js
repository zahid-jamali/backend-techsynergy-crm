const Contact = require('../models/Contacts');
const Account = require('../models/Account');
const Deal = require('../models/Deals');
const Quote = require('../models/Quotes');
const mongoose = require('mongoose');
/* ===============================
   GET YEAR RANGE
================================= */
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

		const deals = await Deal.find({ dealOwner: userId });

		const totalDealValue = deals.reduce(
			(sum, d) => sum + (d.amount || 0),
			0
		);

		const weightedExpectedRevenue = deals.reduce(
			(sum, d) => sum + (d.expectedRevenue || 0),
			0
		);

		const approvedSales = await Quote.find({
			quoteOwner: userId,
			isSOApproved: true,
			createdAt: { $gte: start, $lte: end },
		});

		const totalSell = approvedSales.reduce(
			(sum, q) => sum + (q.grandTotal || 0),
			0
		);

		const avgDealSize =
			closedWonDeals > 0 ? totalDealValue / closedWonDeals : 0;

		const winRate =
			totalDeals > 0
				? ((closedWonDeals / totalDeals) * 100).toFixed(2)
				: 0;

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
			.select('dealName amount stage');

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

module.exports = { getDashboardData };

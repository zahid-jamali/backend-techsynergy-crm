const Contact = require('../models/Contacts');
const Account = require('../models/Account');
const Deal = require('../models/Deals');
const Quote = require('../models/Quotes');
const mongoose = require('mongoose');
const convertCurrency = require('../lib/convertCurrency.js');
const User = require('../models/Users');
const SalesTarget = require('../models/SalesTarget');
const Order = require('../models/Order');
const ExcelJS = require('exceljs');

const axios = require('axios');


const getMegaExcel = async (req, res) => {
    try {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: true,
            useSharedStrings: true,
        });

        const sheet = workbook.addWorksheet('CRM Report', {
            properties: { tabColor: { argb: 'FF0000' } }, // red tab
        });

        // ✅ Columns
		sheet.columns = [
		    { header: 'Sr. No', key: 'sr', width: 8 },
		    { header: 'Deal', key: 'deal', width: 28 },
		    { header: 'Customer', key: 'customer', width: 28 },
		    
		    { header: 'Probability', key: 'probability', width: 18 },

		    { header: 'Subtotal', key: 'dealAmount', width: 18 },
			{ header: 'Tax Amount', key: 'taxAmount', width: 18 },
			{ header: 'Grand Total', key: 'totalDeal', width: 20 },

		    { header: 'Taxes %', key: 'taxSummary', width: 30 },
		    { header: 'Products', key: 'productCount', width: 12 },

		    { header: 'Stage', key: 'stage', width: 18 },
		    { header: 'Next Step', key: 'nextStep', width: 18 },

		    { header: 'POC', key: 'poc', width: 25 },
		    { header: 'Designation', key: 'designation', width: 22 },
		    { header: 'Cell', key: 'cell', width: 18 },
		    { header: 'Email', key: 'email', width: 32 },
		    { header: 'Owner', key: 'owner', width: 25 },
		];

        // ✅ HEADER DESIGN (Premium look)
        const headerRow = sheet.getRow(1);

        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F2937' }, // dark gray (pro look)
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        headerRow.height = 22;

        // ✅ Freeze header
        sheet.views = [{ state: 'frozen', ySplit: 1 }];

        // ✅ Filter enable
        sheet.autoFilter = {
            from: 'A1',
            to: 'I1',
        };

        let sr = 1;

        const cursor = Account.aggregate([
            { $match: { isActive: true } },

            {
                $lookup: {
                    from: 'deals',
                    localField: '_id',
                    foreignField: 'account',
                    as: 'deals',
                },
            },
            { $unwind: { path: '$deals', preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: 'contacts',
                    localField: 'deals.contact',
                    foreignField: '_id',
                    as: 'contact',
                },
            },
            { $unwind: { path: '$contact', preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: 'users',
                    localField: 'deals.dealOwner',
                    foreignField: '_id',
                    as: 'owner',
                },
            },
            { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },


			{
			    $lookup: {
			        from: 'quotes',
			        let: { dealId: '$deals._id' },
			        pipeline: [
			            {
			                $match: {
			                    $expr: { $eq: ['$deal', '$$dealId'] },
			                    $or: [{quoteStage: 'Delivered'}, {quoteStage: 'Confirmed'}],
			                    isActive: true,
			                },
			            },
			            { $sort: { createdAt: -1 } },
			            { $limit: 1 },
			        ],
			        as: 'quote',
			    },
			},
			{ $unwind: { path: '$quote', preserveNullAndEmptyArrays: true } },


           {
				    $project: {
				        customer: '$accountName',
				        deal: '$deals.dealName',
				        stage: '$deals.stage',
				        probability: '$deals.probability',
				        probability: '$deals.probability',
				        nextStep: '$deals.nextStep',

				        // ✅ ADD THESE (THIS IS YOUR MAIN FIX)
				        dealAmount: { $ifNull: ['$quote.subTotal', 0] },
				        taxAmount: { $ifNull: ['$quote.otherTaxAmount', 0] },
				        totalDeal: { $ifNull: ['$quote.grandTotal', 0] },

				        productCount: {
				            $size: { $ifNull: ['$quote.products', []] }
				        },

				        // ✅ FIX TAX FIELD NAME (IMPORTANT)
				        taxSummary: {
				            $reduce: {
				                input: { $ifNull: ['$quote.otherTax', []] }, // ✅ NOT "taxes"
				                initialValue: '',
				                in: {
				                    $concat: [
				                        '$$value',
				                        {
				                            $cond: [
				                                { $eq: ['$$value', ''] },
				                                '',
				                                ', '
				                            ]
				                        },
				                        '$$this.tax',
				                        ' ',
				                        { $toString: '$$this.percent' },
				                        '%'
				                    ]
				                }
				            }
				        },

				        poc: {
				            $trim: {
				                input: {
				                    $concat: [
				                        { $ifNull: ['$contact.firstName', '' ] },
				                        ' ',
				                        { $ifNull: ['$contact.lastName', '' ] },
				                    ],
				                },
				            },
				        },

				        designation: { $ifNull: ['$contact.designation', '' ] },
				        cell: { $ifNull: ['$contact.phone', '' ] },
				        email: { $ifNull: ['$contact.email', '' ] },

				        owner: {
				            $trim: {
				                input: {
				                    $concat: [
				                        { $ifNull: ['$owner.name', '' ] },
				                        ' ',
				                    ],
				                },
				            },
				        },
				    }
				}
            
        ])
        .allowDiskUse(true)
        .cursor();

        // Headers for download
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=crm-report.xlsx'
        );

        // ✅ Add rows (with styling)
        for await (const doc of cursor) {
			const row = sheet.addRow({
			    sr: sr++,
			    customer: doc.customer || '—',
			    deal: doc.deal || '—',
			    nextStep:doc.nextStep || '-',
			    probability: doc.probability || "-",
			    stage: doc.stage || '—',

			    dealAmount: doc.dealAmount,
			    taxAmount: doc.taxAmount,
			    totalDeal: doc.totalDeal,

			    taxSummary: doc.taxSummary || '—',
			    productCount: doc.productCount || 0,

			    poc: doc.poc || '—',
			    designation: doc.designation || '—',
			    cell: doc.cell || '—',
			    email: doc.email || '—',
			    owner: doc.owner || '—',
			});

            // ✅ Zebra striping
            if (sr % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF9FAFB' }, // light gray
                    };
                });
            }

            // ✅ Alignment + border
            row.eachCell((cell, colNumber) => {
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: colNumber === 1 ? 'center' : 'left',
                };

                cell.border = {
                    bottom: { style: 'thin' },
                };
            });

            row.commit();
        }

        sheet.commit();
        await workbook.commit();

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Excel generation failed' });
    }
};






const getSingleUserPerformance = async (req, res) => {
	try {
		const userId = req.params.id;

		/* ================= USER INFO ================= */

		const user = await User.findById(userId).select(
			'_id name email phone totalSell role isActive createdAt'
		);

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		/* ================= FETCH RELATED DATA ================= */

		const deals = await Deal.find({ dealOwner: userId })
			.populate('account', 'accountName')
			.populate('contact', 'firstName lastName')
			.populate('dealOwner', 'name');

		const quotes = await Quote.find({ quoteOwner: userId })
			.populate('contact', 'firstName lastName')
			.populate('deal')
			.populate('quoteOwner', 'name');

		const sellOrders = await Order.find({
			createdBy: userId,
			isActive: true,
		})
			.populate('finalQuote')
			.populate('createdBy');
		/* ================= DEAL CALCULATIONS ================= */

		const totalDeals = deals.length;

		const closedWonDeals = deals.filter((d) => d.stage === 'Closed Won');

		const totalRevenue = user.totalSell;

		const winRate =
			totalDeals > 0
				? Number(((closedWonDeals.length / totalDeals) * 100).toFixed(1))
				: 0;

		/* ================= QUOTES ================= */

		const totalQuotes = quotes.length;

		/* ================= ACTIVE FILTERS FOR TABLES ================= */

		const activeDeals = deals.filter(
			(d) =>
				![
					'Closed Won',
					'Closed Lost',
					'Closed Lost to Competition',
				].includes(d.stage)
		);

		const activeQuotes = quotes.filter(
			(q) => !['Rejected', 'Cancelled'].includes(q.quoteStage)
		);

		const activeSellOrders = sellOrders.filter(
			(s) => s.status !== 'Cancelled'
		);

		/* ================= RESPONSE ================= */

		res.status(200).json({
			user: {
				_id: user._id,
				name: user.name,
				isActive: user.isActive,
				email: user.email,
				phone: user.phone,
				role: user.role,
				createdAt: user.createdAt,
			},

			stats: {
				totalDeals,
				totalRevenue,
				winRate,
				totalQuotes,
			},

			tables: {
				activeDeals,
				activeQuotes,
				activeSellOrders,
			},
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({
			message: 'Failed to load single user performance',
		});
	}
};

const getAdminDashboard = async (req, res) => {
	try {
		const now = new Date();
		const currentYear = now.getFullYear();

		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(now.getMonth() - 5);
		sixMonthsAgo.setDate(1);

		const response = await axios.get(`https://open.er-api.com/v6/latest/USD`);

		const USD_RATE = response.data.rates['PKR'];

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
		// console.log(pipelineValue);

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
				$lookup: {
					from: 'accounts',
					localField: 'account',
					foreignField: '_id',
					as: 'account',
				},
			},
			{ $unwind: '$account' },
			{
				$project: {
					dealName: 1,
					stage: 1,
					amount: '$normalizedAmount',
					account: 1,
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
			USD_RATE,
			summaryStats: {
				totalRevenue: stats.totalRevenue || 0,
				pipelineValue: pipelineValue || 0,
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
			totalSellOrders,
			approvedSellOrders,
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

			Order.countDocuments({ createdBy: userId, isActive: true }),

			Order.countDocuments({
				createdBy: userId,
				isActive: true,
				isSOApproved: true,
				status: 'Accepted',
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
			deals.map((d) =>
				d.stage !== 'Closed Lost' &&
				d.stage !== 'Closed Lost to Competition'
					? convertToPKR(d.amount, d.currency)
					: 0
			)
		);

		const totalDealValue = dealValues.reduce(
			(sum, val) => sum + Number(val || 0),
			0
		);

		const weightedExpectedRevenue = dealValues.reduce(
			(sum, val) => sum + Number(val || 0),
			0
		);

		const approvedSales = await Order.find({
			createdBy: userId,
			isSOApproved: true,
			status: 'Accepted',
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

		const summaryStats = {
			contacts,
			accounts,
			totalDeals,
			openDeals,
			closedWonDeals,
			closedLostDeals,
			totalQuotes,
			confirmedQuotes,
			totalSell,
			avgDealSize: Math.round(avgDealSize),
			approvedSellOrders,
			totalSellOrders,
		};

		/* ===============================
		   MONTHLY REVENUE (ONLY UNTIL CURRENT MONTH)
		================================= */

		const monthlyRevenueAgg = await Order.aggregate([
			{
				$match: {
					createdBy: userId,
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
					totalValue: { $sum: '$amount' },
					weightedRevenue: { $sum: '$amount' },
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

module.exports = {
	getDashboardData,
	getAdminDashboard,
	getSingleUserPerformance,
	getMegaExcel,
};

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
const { buildAdminDashboard, buildStaffDashboard } = require('../lib/dashboardQueries');


const getPipelineExcel = async (req, res) => {
    try {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: true,
            useSharedStrings: true,
        });

        const sheet = workbook.addWorksheet('pipeline report', {
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

const getMasterExcel = async (req, res) => {
    try {
        // ================= RESPONSE HEADERS =================
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=contacts-report.xlsx'
        );

        // ================= WORKBOOK =================
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: true,
            useSharedStrings: true,
        });

        const sheet = workbook.addWorksheet('Contacts Report', {
            properties: {
                tabColor: { argb: 'FF0000' },
            },
        });

        // ================= COLUMNS =================
        sheet.columns = [
            { header: 'Sr. No', key: 'sr', width: 10 },
            { header: 'Customer', key: 'customer', width: 30 },

            { header: 'POC', key: 'poc', width: 28 },
            { header: 'Designation', key: 'designation', width: 22 },

            { header: 'Phone', key: 'phone', width: 20 },
            { header: 'Mobile', key: 'mobile', width: 20 },

            { header: 'Email', key: 'email', width: 35 },

            { header: 'Description', key: 'description', width: 40 },

            { header: 'Contact Owner', key: 'owner', width: 25 },

            { header: 'Created At', key: 'createdAt', width: 20 },
        ];

        // ================= HEADER STYLE =================
        const headerRow = sheet.getRow(1);

        headerRow.eachCell((cell) => {
            cell.font = {
                bold: true,
                color: { argb: 'FFFFFFFF' },
            };

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F2937' },
            };

            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
            };

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        headerRow.height = 22;

        // ================= FREEZE =================
        sheet.views = [{ state: 'frozen', ySplit: 1 }];

        // ================= FILTER =================
        sheet.autoFilter = {
            from: 'A1',
            to: 'J1',
        };

        // ================= AGGREGATION =================
        const cursor = Account.aggregate([
            {
                $match: {
                    isActive: true,
                },
            },

            // ================= CONTACTS =================
            {
                $lookup: {
                    from: 'contacts',
                    localField: '_id',
                    foreignField: 'account',
                    as: 'contact',
                },
            },

            {
                $unwind: {
                    path: '$contact',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // ================= CONTACT OWNER =================
            {
                $lookup: {
                    from: 'users',
                    localField: 'contact.contactOwner',
                    foreignField: '_id',
                    as: 'owner',
                },
            },

            {
                $unwind: {
                    path: '$owner',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // ================= PROJECT =================
            {
                $project: {
                    customer: '$accountName',

                    poc: {
                        $trim: {
                            input: {
                                $concat: [
                                    {
                                        $ifNull: ['$contact.firstName', ''],
                                    },
                                    ' ',
                                    {
                                        $ifNull: ['$contact.lastName', ''],
                                    },
                                ],
                            },
                        },
                    },

                    designation: {
                        $ifNull: ['$contact.designation', ''],
                    },

                    phone: {
                        $ifNull: ['$contact.phone', ''],
                    },

                    mobile: {
                        $ifNull: ['$contact.mobile', ''],
                    },

                    email: {
                        $ifNull: ['$contact.email', ''],
                    },

                    description: {
                        $ifNull: ['$contact.description', ''],
                    },

                    owner: {
                        $trim: {
                            input: {
                                $concat: [
                                    {
                                        $ifNull: ['$owner.name', ''],
                                    },
                                ],
                            },
                        },
                    },

                    createdAt: '$contact.createdAt',
                },
            },
        ])
            .allowDiskUse(true)
            .cursor();

        // ================= ROWS =================
        let sr = 1;

        for await (const doc of cursor) {
            const row = sheet.addRow({
                sr: sr,

                customer: doc.customer || '—',

                poc: doc.poc || '—',
                designation: doc.designation || '—',

                phone: doc.phone || '—',
                mobile: doc.mobile || '—',

                email: doc.email || '—',

                description: doc.description || '—',

                owner: doc.owner || '—',

                createdAt: doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString()
                    : '—',
            });

            // ================= ZEBRA =================
            if (sr % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: {
                            argb: 'FFF9FAFB',
                        },
                    };
                });
            }

            // ================= CELL STYLE =================
            row.eachCell((cell, colNumber) => {
                cell.alignment = {
                    vertical: 'middle',
                    horizontal:
                        colNumber === 1 ? 'center' : 'left',
                };

                cell.border = {
                    bottom: {
                        style: 'thin',
                    },
                };
            });

            row.commit();
            sr++;
        }

        // ================= FINALIZE =================
        sheet.commit();

        await workbook.commit();

    } catch (error) {
        console.error(error);

        if (!res.headersSent) {
            res.status(500).json({
                message: 'Excel generation failed',
                error: error.message,
            });
        }
    }
};






const getRevenueExcel = async (req, res) => {
    try {

        // ================= RESPONSE HEADERS =================
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=revenue-report.xlsx'
        );

        // ================= WORKBOOK =================
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: true,
            useSharedStrings: true,
        });

        const sheet = workbook.addWorksheet('Revenue Report', {
            properties: {
                tabColor: { argb: 'FF0000' },
            },
        });

        // ================= COLUMNS =================
        sheet.columns = [
            { header: 'Sr. No', key: 'sr', width: 10 },

            { header: 'Order #', key: 'orderNumber', width: 20 },

            { header: 'Customer', key: 'customer', width: 30 },

            { header: 'Deal', key: 'deal', width: 30 },

            { header: 'POC', key: 'poc', width: 28 },

            { header: 'Deal Owner', key: 'dealOwner', width: 25 },

            { header: 'Products', key: 'products', width: 50 },

            { header: 'Product Taxes', key: 'productTaxes', width: 40 },

            { header: 'Other Taxes', key: 'otherTaxes', width: 35 },

            { header: 'Subtotal', key: 'subtotal', width: 18 },

            { header: 'Other Tax Amount', key: 'otherTaxAmount', width: 20 },

            { header: 'Discount', key: 'discount', width: 18 },

            { header: 'Grand Total', key: 'grandTotal', width: 20 },

            { header: 'Currency', key: 'currency', width: 15 },

            { header: 'Status', key: 'status', width: 18 },

            { header: 'Confirmed Date', key: 'confirmedDate', width: 20 },

            { header: 'Created By', key: 'createdBy', width: 25 },

            { header: 'Created At', key: 'createdAt', width: 20 },
        ];

        // ================= HEADER STYLE =================
        const headerRow = sheet.getRow(1);

        headerRow.eachCell((cell) => {
            cell.font = {
                bold: true,
                color: { argb: 'FFFFFFFF' },
            };

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F2937' },
            };

            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true,
            };

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        headerRow.height = 25;

        // ================= FREEZE =================
        sheet.views = [{ state: 'frozen', ySplit: 1 }];

        // ================= FILTER =================
        sheet.autoFilter = {
            from: 'A1',
            to: 'R1',
        };

        // ================= AGGREGATION =================
        const cursor = Order.aggregate([

            {
                $match: {
                    isActive: true,
                },
            },

            // ================= QUOTE =================
            {
                $lookup: {
                    from: 'quotes',
                    localField: 'finalQuote',
                    foreignField: '_id',
                    as: 'quote',
                },
            },

            {
                $unwind: {
                    path: '$quote',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // ================= DEAL =================
            {
                $lookup: {
                    from: 'deals',
                    localField: 'quote.deal',
                    foreignField: '_id',
                    as: 'deal',
                },
            },

            {
                $unwind: {
                    path: '$deal',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // ================= ACCOUNT =================
            {
                $lookup: {
                    from: 'accounts',
                    localField: 'deal.account',
                    foreignField: '_id',
                    as: 'account',
                },
            },

            {
                $unwind: {
                    path: '$account',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // ================= CONTACT =================
            {
                $lookup: {
                    from: 'contacts',
                    localField: 'deal.contact',
                    foreignField: '_id',
                    as: 'contact',
                },
            },

            {
                $unwind: {
                    path: '$contact',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // ================= DEAL OWNER =================
            {
                $lookup: {
                    from: 'users',
                    localField: 'deal.dealOwner',
                    foreignField: '_id',
                    as: 'dealOwner',
                },
            },

            {
                $unwind: {
                    path: '$dealOwner',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // ================= CREATED BY =================
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdByUser',
                },
            },

            {
                $unwind: {
                    path: '$createdByUser',
                    preserveNullAndEmptyArrays: true,
                },
            },

            // ================= PROJECT =================
            {
                $project: {

                    orderNumber: 1,

                    subtotal: 1,
                    discount: 1,
                    grandTotal: 1,

                    currency: 1,
                    status: 1,

                    confirmedDate: 1,
                    createdAt: 1,

                    otherTaxAmount: 1,

                    customer: '$account.accountName',

                    deal: '$deal.dealName',

                    poc: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ['$contact.firstName', ''] },
                                    ' ',
                                    { $ifNull: ['$contact.lastName', ''] },
                                ],
                            },
                        },
                    },

                    dealOwner: '$dealOwner.name',

                    createdBy: '$createdByUser.name',

                    // ================= PRODUCTS =================
                    products: {
                        $reduce: {
                            input: {
                                $ifNull: ['$products', []],
                            },
                            initialValue: '',
                            in: {
                                $concat: [
                                    '$$value',
                                    {
                                        $cond: [
                                            { $eq: ['$$value', ''] },
                                            '',
                                            '\n',
                                        ],
                                    },

                                    '$$this.productName',

                                    ' (Qty: ',
                                    {
                                        $toString: '$$this.quantity',
                                    },

                                    ', Total: ',
                                    {
                                        $toString: '$$this.total',
                                    },

                                    ')',
                                ],
                            },
                        },
                    },

                    // ================= PRODUCT TAXES =================
                    productTaxes: {
                        $reduce: {
                            input: {
                                $ifNull: ['$products', []],
                            },
                            initialValue: '',
                            in: {
                                $concat: [
                                    '$$value',

                                    {
                                        $cond: [
                                            { $eq: ['$$value', ''] },
                                            '',
                                            '\n',
                                        ],
                                    },

                                    '$$this.productName',
                                    ': ',

                                    {
                                        $reduce: {
                                            input: {
                                                $ifNull: ['$$this.Tax', []],
                                            },
                                            initialValue: '',
                                            in: {
                                                $concat: [
                                                    '$$value',

                                                    {
                                                        $cond: [
                                                            {
                                                                $eq: [
                                                                    '$$value',
                                                                    '',
                                                                ],
                                                            },
                                                            '',
                                                            ', ',
                                                        ],
                                                    },

                                                    '$$this.tax',
                                                    ' ',

                                                    {
                                                        $toString:
                                                            '$$this.percent',
                                                    },

                                                    '%',
                                                ],
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },

                    // ================= OTHER TAXES =================
                    otherTaxes: {
                        $reduce: {
                            input: {
                                $ifNull: ['$otherTax', []],
                            },
                            initialValue: '',
                            in: {
                                $concat: [
                                    '$$value',

                                    {
                                        $cond: [
                                            { $eq: ['$$value', ''] },
                                            '',
                                            ', ',
                                        ],
                                    },

                                    '$$this.tax',
                                    ' ',

                                    {
                                        $toString: '$$this.percent',
                                    },

                                    '%',
                                ],
                            },
                        },
                    },
                },
            },

            {
                $sort: {
                    createdAt: -1,
                },
            },

        ])
            .allowDiskUse(true)
            .cursor();

        // ================= ROWS =================
        let sr = 1;

        for await (const doc of cursor) {

            const row = sheet.addRow({

                sr,

                orderNumber: doc.orderNumber || '—',

                customer: doc.customer || '—',

                deal: doc.deal || '—',

                poc: doc.poc || '—',

                dealOwner: doc.dealOwner || '—',

                products: doc.products || '—',

                productTaxes: doc.productTaxes || '—',

                otherTaxes: doc.otherTaxes || '—',

                subtotal: doc.subtotal || 0,

                otherTaxAmount: doc.otherTaxAmount || 0,

                discount: doc.discount || 0,

                grandTotal: doc.grandTotal || 0,

                currency: doc.currency || '—',

                status: doc.status || '—',

                confirmedDate: doc.confirmedDate
                    ? new Date(doc.confirmedDate).toLocaleDateString()
                    : '—',

                createdBy: doc.createdBy || '—',

                createdAt: doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString()
                    : '—',
            });

            // ================= ZEBRA =================
            if (sr % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: {
                            argb: 'FFF9FAFB',
                        },
                    };
                });
            }

            // ================= CELL STYLE =================
            row.eachCell((cell, colNumber) => {

                cell.alignment = {
                    vertical: 'top',
                    horizontal:
                        colNumber === 1
                            ? 'center'
                            : 'left',
                    wrapText: true,
                };

                cell.border = {
                    bottom: {
                        style: 'thin',
                    },
                };
            });

            row.commit();

            sr++;
        }

        // ================= FINALIZE =================
        sheet.commit();

        await workbook.commit();

    } catch (error) {

        console.error(error);

        if (!res.headersSent) {
            res.status(500).json({
                message: 'Excel generation failed',
                error: error.message,
            });
        }
    }
};




const getUsersPerformanceExcel = async (req, res) => {
    try {

        // ================= RESPONSE HEADERS =================
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=users-performance-report.xlsx'
        );

        // ================= WORKBOOK =================
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: true,
            useSharedStrings: true,
        });

        const sheet = workbook.addWorksheet('Users Performance', {
            properties: {
                tabColor: { argb: 'FF0000' },
            },
        });

        // ================= COLUMNS =================
        sheet.columns = [
            { header: 'Sr. No', key: 'sr', width: 10 },

            { header: 'User', key: 'user', width: 30 },

            { header: 'Email', key: 'email', width: 35 },

            { header: 'Total Deals', key: 'totalDeals', width: 18 },

            { header: 'Open Deals', key: 'openDeals', width: 18 },

            { header: 'Closed Won', key: 'closedDeals', width: 18 },

            { header: 'Closed Lost', key: 'lostDeals', width: 18 },

            { header: 'Total Quotations', key: 'totalQuotes', width: 20 },

            { header: 'Delivered Quotes', key: 'deliveredQuotes', width: 20 },

            { header: 'Confirmed Quotes', key: 'confirmedQuotes', width: 20 },

            { header: 'Pipeline Revenue', key: 'pipelineRevenue', width: 22 },

            { header: 'Closed Revenue', key: 'closedRevenue', width: 22 },

            { header: 'Total Revenue', key: 'totalRevenue', width: 22 },

            { header: 'Orders', key: 'totalOrders', width: 15 },

            { header: 'Currency', key: 'currency', width: 12 },

            { header: 'Created At', key: 'createdAt', width: 20 },
        ];

        // ================= HEADER STYLE =================
        const headerRow = sheet.getRow(1);

        headerRow.eachCell((cell) => {

            cell.font = {
                bold: true,
                color: { argb: 'FFFFFFFF' },
            };

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F2937' },
            };

            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true,
            };

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        headerRow.height = 25;

        // ================= FREEZE =================
        sheet.views = [{ state: 'frozen', ySplit: 1 }];

        // ================= FILTER =================
        sheet.autoFilter = {
            from: 'A1',
            to: 'P1',
        };

        // ================= AGGREGATION =================
        const cursor = User.aggregate([

            {
                $match: {
                    isActive: true,
                },
            },

            // ================= DEALS =================
            {
                $lookup: {
                    from: 'deals',
                    let: {
                        userId: '$_id',
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: [
                                        '$dealOwner',
                                        '$$userId',
                                    ],
                                },
                                isActive: true,
                            },
                        },
                    ],
                    as: 'deals',
                },
            },

            // ================= QUOTES =================
            {
                $lookup: {
                    from: 'quotes',
                    let: {
                        dealIds: '$deals._id',
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: [
                                        '$deal',
                                        '$$dealIds',
                                    ],
                                },
                                isActive: true,
                            },
                        },
                    ],
                    as: 'quotes',
                },
            },

            // ================= ORDERS =================
            {
                $lookup: {
                    from: 'orders',
                    let: {
                        quoteIds: '$quotes._id',
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: [
                                        '$finalQuote',
                                        '$$quoteIds',
                                    ],
                                },
                                isActive: true,
                            },
                        },
                    ],
                    as: 'orders',
                },
            },

            // ================= PROJECT =================
            {
                $project: {

                    user: '$name',

                    email: 1,

                    currency: {
                        $literal: 'PKR',
                    },

                    createdAt: 1,

                    // ================= DEAL COUNTS =================
                    totalDeals: {
                        $size: {
                            $ifNull: ['$deals', []],
                        },
                    },

                    openDeals: {
                        $size: {
                            $filter: {
                                input: '$deals',
                                as: 'deal',
                                cond: {
                                    $not: {
                                        $in: [
                                            '$$deal.stage',
                                            [
                                                'Closed Won',
                                                'Closed Lost',
                                                'Closed Lost to Competition',
                                            ],
                                        ],
                                    },
                                },
                            },
                        },
                    },

                    closedDeals: {
                        $size: {
                            $filter: {
                                input: '$deals',
                                as: 'deal',
                                cond: {
                                    $eq: [
                                        '$$deal.stage',
                                        'Closed Won',
                                    ],
                                },
                            },
                        },
                    },

                    lostDeals: {
                        $size: {
                            $filter: {
                                input: '$deals',
                                as: 'deal',
                                cond: {
                                    $in: [
                                        '$$deal.stage',
                                        [
                                            'Closed Lost',
                                            'Closed Lost to Competition',
                                        ],
                                    ],
                                },
                            },
                        },
                    },

                    // ================= QUOTES =================
                    totalQuotes: {
                        $size: '$quotes',
                    },

                    deliveredQuotes: {
                        $size: {
                            $filter: {
                                input: '$quotes',
                                as: 'quote',
                                cond: {
                                    $eq: [
                                        '$$quote.quoteStage',
                                        'Delivered',
                                    ],
                                },
                            },
                        },
                    },

                    confirmedQuotes: {
                        $size: {
                            $filter: {
                                input: '$quotes',
                                as: 'quote',
                                cond: {
                                    $eq: [
                                        '$$quote.quoteStage',
                                        'Confirmed',
                                    ],
                                },
                            },
                        },
                    },

                    // ================= PIPELINE REVENUE =================
                    pipelineRevenue: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$deals',
                                        as: 'deal',
                                        cond: {
                                            $not: {
                                                $in: [
                                                    '$$deal.stage',
                                                    [
                                                        'Closed Won',
                                                        'Closed Lost',
                                                        'Closed Lost to Competition',
                                                    ],
                                                ],
                                            },
                                        },
                                    },
                                },
                                as: 'deal',
                                in: {
                                    $ifNull: [
                                        '$$deal.expectedRevenue',
                                        0,
                                    ],
                                },
                            },
                        },
                    },

                    // ================= CLOSED REVENUE =================
                    closedRevenue: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$orders',
                                        as: 'order',
                                        cond: {
                                            $eq: [
                                                '$$order.status',
                                                'Accepted',
                                            ],
                                        },
                                    },
                                },
                                as: 'order',
                                in: {
                                    $ifNull: [
                                        '$$order.grandTotal',
                                        0,
                                    ],
                                },
                            },
                        },
                    },

                    // ================= TOTAL REVENUE =================
                    totalRevenue: {
                        $sum: {
                            $map: {
                                input: '$orders',
                                as: 'order',
                                in: {
                                    $ifNull: [
                                        '$$order.grandTotal',
                                        0,
                                    ],
                                },
                            },
                        },
                    },

                    // ================= ORDERS =================
                    totalOrders: {
                        $size: '$orders',
                    },
                },
            },

            {
                $sort: {
                    totalRevenue: -1,
                },
            },

        ])
            .allowDiskUse(true)
            .cursor();

        // ================= ROWS =================
        let sr = 1;

        for await (const doc of cursor) {

            const row = sheet.addRow({

                sr,

                user: doc.user || '—',

                email: doc.email || '—',

                totalDeals: doc.totalDeals || 0,

                openDeals: doc.openDeals || 0,

                closedDeals: doc.closedDeals || 0,

                lostDeals: doc.lostDeals || 0,

                totalQuotes: doc.totalQuotes || 0,

                deliveredQuotes: doc.deliveredQuotes || 0,

                confirmedQuotes: doc.confirmedQuotes || 0,

                pipelineRevenue: doc.pipelineRevenue || 0,

                closedRevenue: doc.closedRevenue || 0,

                totalRevenue: doc.totalRevenue || 0,

                totalOrders: doc.totalOrders || 0,

                currency: doc.currency || 'PKR',

                createdAt: doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString()
                    : '—',
            });

            // ================= ZEBRA =================
            if (sr % 2 === 0) {

                row.eachCell((cell) => {

                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: {
                            argb: 'FFF9FAFB',
                        },
                    };
                });
            }

            // ================= CELL STYLE =================
            row.eachCell((cell, colNumber) => {

                cell.alignment = {
                    vertical: 'middle',
                    horizontal:
                        colNumber === 1
                            ? 'center'
                            : 'left',
                    wrapText: true,
                };

                cell.border = {
                    bottom: {
                        style: 'thin',
                    },
                };
            });

            row.commit();

            sr++;
        }

        // ================= FINALIZE =================
        sheet.commit();

        await workbook.commit();

    } catch (error) {

        console.error(error);

        if (!res.headersSent) {
            res.status(500).json({
                message: 'Excel generation failed',
                error: error.message,
            });
        }
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
		const data = await buildAdminDashboard();
		return res.json(data);
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: 'Dashboard Error' });
	}
};

const getDashboardData = async (req, res) => {
	try {
		const data = await buildStaffDashboard(req.user.id);
		return res.status(200).json(data);
	} catch (error) {
		console.error('Dashboard error:', error);
		return res.status(500).json({
			message: 'Failed to load dashboard data',
		});
	}
};

module.exports = {
	getDashboardData,
	getAdminDashboard,
	getSingleUserPerformance,
	getPipelineExcel,
	getMasterExcel,
	getRevenueExcel,
	getUsersPerformanceExcel
};

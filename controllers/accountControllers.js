const Account = require('../models/Account.js');
const User = require('../models/Users');
const {
  parseListQuery,
  archiveMatch,
  regex,
  sendPage,
  paginate,
} = require('../lib/listQuery');
const { setArchived } = require('../lib/archiveRecord');

const createAccount = async (req, res) => {
  try {
    const {
      accountName,
      accountSite,
      accountType,
      industry,
      rating,
      ownership,
      annualRevenue,
      phone,
      website,
      billingAddress,
      shippingAddress,
      description,
      meta,
    } = req.body;

    if (!accountName) {
      return res.status(400).json({
        success: false,
        msg: 'Account name is required',
      });
    }

    const existingAccount = await Account.findOne({
      accountName: accountName.trim(),
      accountOwner: req.user.id,
    });

    if (existingAccount) {
      return res.status(409).json({
        success: false,
        msg: 'Account with this name already exists',
      });
    }

    const account = await Account.create({
      accountOwner: req.user.id,
      accountName: accountName.trim(),
      accountSite,
      accountType,
      industry,
      rating,
      ownership,
      annualRevenue,
      phone,
      website,
      billingAddress,
      shippingAddress,
      description,
      meta,
    });

    return res.status(201).json({
      success: true,
      msg: 'Account created successfully',
      data: account,
    });
  } catch (error) {
    console.error('Create Account Error:', error);

    return res.status(500).json({
      success: false,
      msg: 'Server error while creating account',
    });
  }
};

const getMyAccounts = async (req, res) => {
  try {
    const { page, limit, search, archived } = parseListQuery(req);
    const filter = {
      accountOwner: req.user.id,
      isActive: true,
      ...archiveMatch(archived),
    };
    if (req.query.accountType) filter.accountType = req.query.accountType;
    if (req.query.industry) filter.industry = req.query.industry;
    if (search) {
      filter.$or = [
        { accountName: regex(search) },
        { phone: regex(search) },
        { website: regex(search) },
        { industry: regex(search) },
      ];
    }
    const result = await paginate(Account, { filter, page, limit });
    return sendPage(res, result.data, result);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: 'Internal server error!!!' });
  }
};

const updateMyAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const usr = await User.findById(req.user.id);
    let account;
    if (usr.isSuperUser) {
      account = await Account.findOne({
        _id: id,
      });
    } else {
      account = await Account.findOne({
        _id: id,
        accountOwner: req.user.id,
      });
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        msg: 'Account not found',
      });
    }

    const {
      accountName,
      accountSite,
      accountType,
      industry,
      rating,
      ownership,
      annualRevenue,
      phone,
      website,
      billingAddress,
      shippingAddress,
      description,
      meta,
      isActive,
    } = req.body;

    // Prevent duplicate name for same owner
    if (accountName && accountName.trim() !== account.accountName) {
      const existingAccount = await Account.findOne({
        accountName: accountName.trim(),
        accountOwner: req.user.id,
        _id: { $ne: id },
      });

      if (existingAccount) {
        return res.status(409).json({
          success: false,
          msg: 'Account with this name already exists',
        });
      }

      account.accountName = accountName.trim();
    }

    // Update only provided fields
    if (accountSite !== undefined) account.accountSite = accountSite;
    if (accountType !== undefined) account.accountType = accountType;
    if (industry !== undefined) account.industry = industry;
    if (rating !== undefined) account.rating = rating;
    if (ownership !== undefined) account.ownership = ownership;
    if (annualRevenue !== undefined) account.annualRevenue = annualRevenue;
    if (phone !== undefined) account.phone = phone;
    if (website !== undefined) account.website = website;
    if (billingAddress !== undefined) account.billingAddress = billingAddress;
    if (shippingAddress !== undefined)
      account.shippingAddress = shippingAddress;
    if (description !== undefined) account.description = description;

    await account.save();

    return res.status(200).json({
      success: true,
      msg: 'Account updated successfully',
      data: account,
    });
  } catch (error) {
    console.error('Update Account Error:', error);

    return res.status(500).json({
      success: false,
      msg: 'Server error while updating account',
    });
  }
};

const deleteMyAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const usr = await User.findById(req.user.id);
    let account;
    if (usr.isSuperUser) {
      account = await Account.findOne({
        _id: id,
      });
    } else {
      account = await Account.findOne({
        _id: id,
        accountOwner: req.user.id,
      });
    }

    if (!account) {
      return res.status(404).json({
        success: false,
        msg: 'Account not found',
      });
    }

    account.isActive = false;
    await account.save();

    return res.status(200).json({
      success: true,
      msg: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete Account Error:', error);

    return res.status(500).json({
      success: false,
      msg: 'Server error while deleting account',
    });
  }
};

// =======================================================================================
// Admin Area
// =========================================================================================

const getAllAccounts = async (req, res) => {
  try {
    const { page, limit, search, archived } = parseListQuery(req);
    const filter = { isActive: true, ...archiveMatch(archived) };
    if (req.query.accountType) filter.accountType = req.query.accountType;
    if (req.query.industry) filter.industry = req.query.industry;
    if (req.query.owner) filter.accountOwner = req.query.owner;
    if (search) {
      filter.$or = [
        { accountName: regex(search) },
        { phone: regex(search) },
        { website: regex(search) },
        { industry: regex(search) },
      ];
    }
    const result = await paginate(Account, {
      filter,
      page,
      limit,
      populate: [
        { path: 'accountOwner', select: 'name email' },
        {
          path: 'contacts',
          match: { isActive: true, isArchived: { $ne: true } },
          select: 'firstName lastName email phone',
        },
      ],
    });
    return sendPage(res, result.data, result);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: 'Internal server error!!!' });
  }
};

const lookupAccounts = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit = Math.min(40, parseInt(req.query.limit, 10) || 20);
    const filter = { isActive: true, isArchived: { $ne: true } };
    if (search) {
      filter.$or = [{ accountName: regex(search) }, { phone: regex(search) }];
    }
    const data = await Account.find(filter)
      .populate('accountOwner', 'name email')
      .sort({ accountName: 1 })
      .limit(limit);
    return res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error!!!' });
  }
};

const archiveAccount = async (req, res) => {
  try {
    const archived = req.body.archived !== false;
    const account = await setArchived(Account, {
      id: req.params.id,
      user: req.user,
      ownerField: 'accountOwner',
      archived,
    });
    if (!account) {
      return res.status(404).json({ success: false, msg: 'Account not found' });
    }
    return res.json({
      success: true,
      msg: archived ? 'Account archived' : 'Account restored',
      data: account,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error!!!' });
  }
};

module.exports = {
  createAccount,
  updateMyAccount,
  deleteMyAccount,
  getMyAccounts,
  getAllAccounts,
  lookupAccounts,
  archiveAccount,
};

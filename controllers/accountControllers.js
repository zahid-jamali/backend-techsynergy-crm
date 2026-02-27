const Account = require('../models/Account.js');
const User = require('../models/Users');

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
    const accounts = await Account.find({
      accountOwner: req.user.id,
      isActive: true,
    });

    return res.status(200).json(accounts);
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
    const accounts = await Account.aggregate([
      // Join Account Owner
      {
        $lookup: {
          from: 'users', // collection name of User model
          localField: 'accountOwner',
          foreignField: '_id',
          as: 'accountOwner',
        },
      },
      {
        $unwind: {
          path: '$accountOwner',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Join Contacts
      {
        $lookup: {
          from: 'contacts', // collection name of Contact model
          localField: '_id',
          foreignField: 'account',
          as: 'contacts',
        },
      },
    ]);

    return res.status(200).json(accounts);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ msg: 'Internal server error!!!' });
  }
};
module.exports = {
  createAccount,
  updateMyAccount,
  deleteMyAccount,
  getMyAccounts,
  getAllAccounts,
};

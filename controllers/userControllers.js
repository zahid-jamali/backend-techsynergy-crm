const Users = require('../models/Users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const captcha = require('../lib/captcha');

const PRIVATE_FIELDS = ['password', 'failedLoginAttempts', 'lockUntil', 'lastLoginIp'];
const publicUser = (user) => {
	const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
	PRIVATE_FIELDS.forEach((k) => delete obj[k]);
	return obj;
};

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const escapeRx = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const passwordProblem = (pw = '') => {
	if (pw.length < 8) return 'Password must be at least 8 characters';
	if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain letters and numbers';
	return null;
};

/** GET /user/me — the signed-in user's own profile. */
const getMyProfile = async (req, res) => {
	try {
		const user = await Users.findById(req.user.id);
		if (!user) return res.status(404).json({ msg: 'User not found' });
		return res.json({ user: publicUser(user) });
	} catch (error) {
		console.error('Get Profile Error:', error);
		return res.status(500).json({ msg: 'Internal server error' });
	}
};

/** PUT /user/me — update own name, phone, designation and (with password) email. */
const updateMyProfile = async (req, res) => {
	try {
		const { name, phone, designation, email, currentPassword } = req.body || {};
		const user = await Users.findById(req.user.id);
		if (!user) return res.status(404).json({ msg: 'User not found' });

		if (name !== undefined) {
			if (!String(name).trim()) return res.status(400).json({ msg: 'Name is required' });
			user.name = String(name).trim();
		}
		if (phone !== undefined) {
			const p = String(phone).trim();
			if (!/^[+\d][\d\s-]{6,19}$/.test(p)) return res.status(400).json({ msg: 'Enter a valid phone number' });
			user.phone = p;
		}
		if (designation !== undefined) user.designation = String(designation).trim();

		if (email !== undefined && String(email).trim().toLowerCase() !== String(user.email).toLowerCase()) {
			const e = String(email).trim();
			if (!EMAIL_RX.test(e)) return res.status(400).json({ msg: 'Enter a valid email address' });
			if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
				return res.status(400).json({ msg: 'Enter your current password to change the email address' });
			}
			const taken = await Users.findOne({
				_id: { $ne: user._id },
				email: { $regex: `^${escapeRx(e)}$`, $options: 'i' },
			});
			if (taken) return res.status(409).json({ msg: 'This email is already used by another account' });
			user.email = e;
		}

		await user.save();
		return res.json({ msg: 'Profile updated', user: publicUser(user) });
	} catch (error) {
		console.error('Update Profile Error:', error);
		return res.status(500).json({ msg: 'Internal server error' });
	}
};

/** PUT /user/me/password — change own password (current password required). */
const changeMyPassword = async (req, res) => {
	try {
		const { currentPassword, newPassword } = req.body || {};
		if (!currentPassword || !newPassword) {
			return res.status(400).json({ msg: 'Current and new password are required' });
		}
		const problem = passwordProblem(newPassword);
		if (problem) return res.status(400).json({ msg: problem });

		const user = await Users.findById(req.user.id);
		if (!user) return res.status(404).json({ msg: 'User not found' });
		if (!(await bcrypt.compare(currentPassword, user.password))) {
			return res.status(400).json({ msg: 'Current password is incorrect' });
		}
		if (await bcrypt.compare(newPassword, user.password)) {
			return res.status(400).json({ msg: 'New password must be different from the current one' });
		}
		user.password = await bcrypt.hash(newPassword, 10);
		user.passwordChangedAt = new Date();
		await user.save();
		return res.json({ msg: 'Password changed successfully' });
	} catch (error) {
		console.error('Change Password Error:', error);
		return res.status(500).json({ msg: 'Internal server error' });
	}
};

const updateUser = async (req, res) => {
	try {
		const { name, email, phone, password } = req.body;

		const user = await Users.findById(req.user.id);

		if (!user) {
			return res.status(404).json({
				msg: 'User not found',
			});
		}

		// 3️⃣ Update only provided fields
		if (name !== undefined) user.name = name;
		if (email !== undefined) user.email = email;
		if (phone !== undefined) user.phone = phone;
		if (password !== undefined) {
			const hashedPassword = await bcrypt.hash(password, 10);

			user.password = hashedPassword;
		}
		await user.save();

		// 4️⃣ Remove password before sending response
		const userResponse = user.toObject();
		delete userResponse.password;

		return res.status(200).json({
			msg: 'User updated successfully',
			user: userResponse,
		});
	} catch (error) {
		console.error('Update User Error:', error);
		return res.status(500).json({
			msg: 'Internal server error',
		});
	}
};

const updateUserByAdmin = async (req, res) => {
	try {
		const { id } = req.params;
		const { isSuperUser, isActive, role } = req.body;

		if (req.user.id === id) {
			return res.status(400).json({
				msg: 'You cannot update your own account',
			});
		}

		const user = await Users.findById(id);

		if (!user) {
			return res.status(404).json({
				msg: 'User not found',
			});
		}

		if (isSuperUser !== undefined) user.isSuperUser = isSuperUser;
		if (isActive !== undefined) user.isActive = isActive;
		if (role !== undefined) {
			const allowed = ['admin', 'staff', 'operations', 'finance'];
			if (!allowed.includes(role)) {
				return res.status(400).json({ msg: 'Invalid role' });
			}
			user.role = role;
			user.isSuperUser = role === 'admin';
		} else if (isSuperUser !== undefined) {
			user.role = isSuperUser ? 'admin' : user.role === 'admin' ? 'staff' : user.role || 'staff';
		}

		await user.save();

		const userResponse = user.toObject();
		delete userResponse.password;

		return res.status(200).json({
			msg: 'User updated successfully',
			user: userResponse,
		});
	} catch (error) {
		console.error('Update User Error:', error);
		return res.status(500).json({
			msg: 'Internal server error',
		});
	}
};

const getAllUsers = async (req, res, next) => {
	try {
		const users = await Users.find()
			.select('-password')
			.sort({ createdAt: -1 });
		res.send(users);
	} catch (error) {
		console.log(error);
		res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const getCaptcha = async (req, res) => {
	res.set('Cache-Control', 'no-store');
	return res.json(captcha.challenge());
};

const loginUser = async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				msg: 'Email and password are required',
			});
		}

		const human = await captcha.verify(req.body, req.ip);
		if (!human) {
			return res.status(400).json({
				msg: 'Please complete the "I am not a robot" verification',
				code: 'CAPTCHA_FAILED',
			});
		}

		const normalizedEmail = String(email).trim();
		const user = await Users.findOne({
			email: { $regex: `^${escapeRx(normalizedEmail)}$`, $options: 'i' },
		});

		if (user?.lockUntil && user.lockUntil > new Date()) {
			const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
			return res.status(423).json({
				msg: `Too many failed attempts. This account is locked for ${mins} more minute${mins === 1 ? '' : 's'}.`,
				code: 'ACCOUNT_LOCKED',
			});
		}

		const isMatch = user ? await bcrypt.compare(password, user.password) : false;

		if (!user || !isMatch) {
			if (user) {
				const attempts = (user.failedLoginAttempts || 0) + 1;
				const update = { failedLoginAttempts: attempts };
				if (attempts >= MAX_FAILED_LOGINS) {
					update.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
					update.failedLoginAttempts = 0;
				}
				await Users.updateOne({ _id: user._id }, { $set: update });
			}
			return res.status(401).json({
				msg: 'Invalid email or password',
			});
		}

		if (!user.isActive) {
			return res
				.status(401)
				.json({ msg: 'Account is inactive, please contact the administrator' });
		}

		user.failedLoginAttempts = 0;
		user.lockUntil = undefined;
		user.lastLoginAt = new Date();
		user.lastLoginIp = req.ip;
		if (!user.role) {
			user.role = user.isSuperUser ? 'admin' : 'staff';
		}
		await user.save();

		const token = jwt.sign(
			{
				id: user._id,
				isSuperUser: user.role === 'admin',
				role: user.role,
			},
			process.env.JWT_SECRET,
			{
				expiresIn: '1d',
			}
		);

		const userResponse = publicUser(user);

		return res.status(200).json({
			msg: 'Login successful',
			token,
			user: userResponse,
		});
	} catch (error) {
		console.error('Login Error:', error);
		return res.status(500).json({
			msg: 'Internal server error',
		});
	}
};

const createUser = async (req, res) => {
	try {
		const { name, email, phone, password, role = 'staff' } = req.body;
		if (!name || !email || !phone || !password) {
			return res.status(400).json({
				msg: 'All fields are required',
			});
		}

		const allowed = ['admin', 'staff', 'operations', 'finance'];
		if (!allowed.includes(role)) {
			return res.status(400).json({ msg: 'Invalid role' });
		}
		const existingUser = await Users.findOne({ email });

		if (existingUser) {
			return res.status(409).json({
				msg: 'Email is already registered',
			});
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const user = await Users.create({
			name,
			email,
			phone,
			password: hashedPassword,
			role,
			isSuperUser: role === 'admin',
		});

		const userResponse = user.toObject();
		delete userResponse.password;

		return res.status(201).json({
			msg: 'User created successfully',
			user: userResponse,
		});
	} catch (error) {
		console.error('Create User Error:', error);
		return res.status(500).json({
			msg: 'Internal server error',
		});
	}
};

module.exports = {
	getCaptcha,
	getMyProfile,
	updateMyProfile,
	changeMyPassword,
	createUser,
	loginUser,
	getAllUsers,
	updateUserByAdmin,
	updateUser,
};

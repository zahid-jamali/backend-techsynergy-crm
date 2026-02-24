const Users = require('../models/Users');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
		const { isSuperUser, isActive } = req.body;

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

const loginUser = async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				msg: 'Email and password are required',
			});
		}

		const user = await Users.findOne({ email, isActive: true });

		if (!user) {
			return res.status(401).json({
				msg: 'Invalid email or password',
			});
		}

		const isMatch = await bcrypt.compare(password, user.password);

		if (!isMatch) {
			return res.status(401).json({
				msg: 'Invalid email or password',
			});
		}

		if (!user.isActive) {
			return res
				.status(401)
				.json({ msg: 'Accout is inactive, contact to administration' });
		}

		const token = jwt.sign(
			{
				id: user._id,
				isSuperUser: user.isSuperUser,
			},
			process.env.JWT_SECRET,
			{
				expiresIn: '1d',
			}
		);

		const userResponse = user.toObject();
		delete userResponse.password;

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
		const { name, email, phone, password } = req.body;
		if (!name || !email || !phone || !password) {
			return res.status(400).json({
				msg: 'All fields are required',
			});
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
	createUser,
	loginUser,
	getAllUsers,
	updateUserByAdmin,
	updateUser,
};

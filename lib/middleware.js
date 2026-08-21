const jwt = require('jsonwebtoken');

const resolveRole = (user = {}) => {
	if (user.role) return user.role;
	if (user.isSuperUser) return 'admin';
	return 'staff';
};

const verifyJWT = async (req, res, next) => {
	try {
		const authToken = req.headers.authorization;
		if (!authToken)
			return res.status(401).json({ msg: 'Please send auth token' });
		const token = authToken.split(' ')[1];
		const decode = jwt.verify(token, process.env.JWT_SECRET);
		if (!decode) {
			return res.status(401).json({ msg: 'Authorization Failed!' });
		}
		decode.role = resolveRole(decode);
		req.user = decode;
		next();
	} catch (err) {
		console.log(err);
		res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const requireRoles =
	(...roles) =>
	(req, res, next) => {
		const role = resolveRole(req.user);
		if (!roles.includes(role)) {
			return res.status(403).json({
				msg: 'You do not have permission to perform this action',
			});
		}
		next();
	};

const requireAdmin = requireRoles('admin');
const requireOperations = requireRoles('admin', 'operations');
const requireFinance = requireRoles('admin', 'finance');

const requireStaff = (req, res, next) => {
	if (resolveRole(req.user) !== 'staff') {
		return res.status(403).json({ msg: 'Staff Access Only!' });
	}
	next();
};

const requirePriceQuery = requireRoles('admin', 'staff', 'operations');

module.exports = {
	verifyJWT,
	requireStaff,
	requireAdmin,
	requireRoles,
	requireOperations,
	requireFinance,
	requirePriceQuery,
	resolveRole,
};

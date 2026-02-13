const jwt = require('jsonwebtoken');

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
		req.user = decode;
		next();
	} catch (err) {
		console.log(err);
		res.status(500).json({ msg: 'Internal server error!!!' });
	}
};

const requireAdmin = (req, res, next) => {
	if (!req.user.isSuperUser) {
		return res.status(403).json({ msg: 'Admin Access Only!' });
	}
	next();
};

const requireStaff = (req, res, next) => {
	if (req.user.isSuperUser) {
		return res.status(403).json({ msg: 'Staff Access Only!' });
	}
	next();
};

module.exports = { verifyJWT, requireStaff, requireAdmin };

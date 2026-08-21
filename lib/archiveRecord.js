const User = require('../models/Users');

const setArchived = async (Model, { id, user, ownerField, archived }) => {
	const usr = await User.findById(user.id);
	const query = usr?.isSuperUser
		? { _id: id, isActive: true }
		: { _id: id, isActive: true, [ownerField]: user.id };

	const doc = await Model.findOne(query);
	if (!doc) return null;

	doc.isArchived = Boolean(archived);
	doc.archivedAt = archived ? new Date() : undefined;
	doc.archivedBy = archived ? user.id : undefined;
	await doc.save();
	return doc;
};

module.exports = { setArchived };

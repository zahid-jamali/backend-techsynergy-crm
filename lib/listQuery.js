const escapeRegex = (value = '') =>
	String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseListQuery = (req, { defaultLimit = 20 } = {}) => {
	const page = Math.max(1, parseInt(req.query.page, 10) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
	const search = String(req.query.search || '').trim();
	const archived = String(req.query.archived || 'false');

	return {
		page,
		limit,
		skip: (page - 1) * limit,
		search,
		archived,
	};
};

const archiveMatch = (archived) => {
	if (archived === 'true') return { isArchived: true };
	if (archived === 'all') return {};
	return { isArchived: { $ne: true } };
};

const regex = (search) => ({ $regex: escapeRegex(search), $options: 'i' });

const sendPage = (res, data, { page, limit, total }) =>
	res.json({
		success: true,
		data,
		pagination: {
			page,
			limit,
			total,
			pages: Math.max(1, Math.ceil(total / limit) || 1),
			hasMore: page * limit < total,
		},
	});

const paginate = async (Model, { filter, populate = [], sort = { createdAt: -1 }, page, limit }) => {
	const skip = (page - 1) * limit;
	let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
	(Array.isArray(populate) ? populate : [populate]).filter(Boolean).forEach((p) => {
		query = query.populate(p);
	});
	const [data, total] = await Promise.all([query, Model.countDocuments(filter)]);
	return { data, total, page, limit, pages: Math.max(1, Math.ceil(total / limit) || 1), hasMore: skip + data.length < total };
};

module.exports = {
	escapeRegex,
	parseListQuery,
	archiveMatch,
	regex,
	sendPage,
	paginate,
};

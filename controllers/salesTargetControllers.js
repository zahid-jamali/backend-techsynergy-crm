const SalesTarget = require('../models/SalesTarget');

const upsertMonthlyTarget = async (req, res) => {
	try {
		const { user, month, year, targetAmount, forecastAmount } = req.body;
		if (!user || !month || !year || !targetAmount) {
			return res.status(400).json({
				success: false,
				message: 'User, month, year and targetAmount are required',
			});
		}
		const target = await SalesTarget.findOneAndUpdate(
			{ user, month, year },
			{ targetAmount, forecastAmount: forecastAmount || 0 },
			{ new: true, upsert: true, runValidators: true }
		);
		res.status(200).json({
			success: true,
			message: 'Sales target saved successfully',
			data: target,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
};

const getTargets = async (req, res) => {
	try {
		const { month, year } = req.query;
		const target = await SalesTarget.find({
			month: Number(month),
			year: Number(year),
		}).populate('user', 'name email');
		if (!target) {
			return res.status(404).json({
				success: false,
				message: 'No sales target found for this month',
			});
		}
		res.status(200).json({ success: true, data: target });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
};

const getUserMonthlyTarget = async (req, res) => {
	try {
		const { userId } = req.params;
		const { month, year } = req.query;
		const target = await SalesTarget.findOne({
			user: userId,
			month: Number(month),
			year: Number(year),
		}).populate('user', 'name email');
		if (!target) {
			return res.status(404).json({
				success: false,
				message: 'No sales target found for this month',
			});
		}
		res.status(200).json({ success: true, data: target });
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
};

const getUserTargets = async (req, res) => {
	try {
		const { userId } = req.params;
		const { year } = req.query;
		const filter = { user: userId };
		if (year) {
			filter.year = Number(year);
		}
		const targets = await SalesTarget.find(filter)
			.sort({ year: -1, month: -1 })
			.populate('user', 'name email');
		res.status(200).json({
			success: true,
			count: targets.length,
			data: targets,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
};

const deleteMonthlyTarget = async (req, res) => {
	try {
		const { id } = req.params;
		const target = await SalesTarget.findByIdAndDelete(id);
		if (!target) {
			return res
				.status(404)
				.json({ success: false, message: 'Target not found' });
		}
		res.status(200).json({
			success: true,
			message: 'Target deleted successfully',
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
};

const getTeamMonthlySummary = async (req, res) => {
	try {
		const { month, year } = req.query;
		const summary = await SalesTarget.aggregate([
			{ $match: { month: Number(month), year: Number(year) } },
			{
				$group: {
					_id: null,
					totalTarget: { $sum: '$targetAmount' },
					totalForecast: { $sum: '$forecastAmount' },
				},
			},
		]);
		res.status(200).json({
			success: true,
			data: summary[0] || { totalTarget: 0, totalForecast: 0 },
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ success: false, message: 'Server error' });
	}
};

module.exports = {
	upsertMonthlyTarget,
	getUserMonthlyTarget,
	getUserTargets,
	deleteMonthlyTarget,
	getTeamMonthlySummary,
	getTargets,
};

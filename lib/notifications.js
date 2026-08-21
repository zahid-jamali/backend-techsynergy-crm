const Quote = require('../models/Quotes');
const { notifyRoles, notifyUser, notifyAllUsers } = require('./mailer');

const escapeHtml = (value) =>
	String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

const money = (amount, currency = 'PKR') =>
	`${currency} ${Number(amount || 0).toLocaleString('en-PK')}`;

const actorId = (user) => user?.id || user?._id;

const notifyPriceQueryPosted = async (message, user) => {
	try {
		const sender = message.sender?.name || user?.name || 'A teammate';
		const preview = escapeHtml(message.body || '(attachment only)');
		const attachments = message.attachments?.length
			? `<p>${message.attachments.length} attachment(s) included.</p>`
			: '';
		const snippet = `<p><strong>${escapeHtml(sender)}</strong> posted a price query.</p>
				<p style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:8px">${preview}</p>
				${attachments}`;
		const role = message.senderRole || user?.role;
		if (role === 'staff') {
			const accountName = message.account?.accountName
				? ` for ${message.account.accountName}`
				: '';
			await notifyRoles(
				['operations', 'admin'],
				{
					subject: `Price query from ${sender}${accountName}`,
					title: 'New price query',
					text: `${sender} posted a price query${accountName}.`,
					body: snippet,
				},
				actorId(user)
			);
			return;
		}
		if (message.threadOwner) {
			await notifyUser(message.threadOwner, {
				subject: `Reply on your price query`,
				title: 'Price query reply',
				text: `${sender} replied to your price query.`,
				body: `<p><strong>${escapeHtml(sender)}</strong> replied to your price query.</p>
				<p style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:8px">${preview}</p>
				${attachments}`,
			});
		}
	} catch (error) {
		console.error('Notify failed:', error.message);
	}
};

const notifyQuoteConfirmed = async (quote, previousStage, user) => {
	try {
		if (String(previousStage) === 'Confirmed') return;
		if (String(quote.quoteStage) !== 'Confirmed') return;

		const populated = await Quote.findById(quote._id)
			.populate('account', 'accountName')
			.populate('quoteOwner', 'name');
		if (!populated) return;

		const subject = populated.subject || populated.quoteNumber || 'Quote';
		const account = populated.account?.accountName || 'an account';
		const owner = populated.quoteOwner?.name || 'Unknown';
		await notifyRoles(
			['operations', 'admin'],
			{
				subject: `Quote confirmed: ${subject}`,
				title: 'Quotation confirmed',
				text: `Quote ${subject} for ${account} is now Confirmed.`,
				body: `<p>Quote <strong>${escapeHtml(subject)}</strong> (${escapeHtml(
					populated.quoteNumber || ''
				)}) for <strong>${escapeHtml(account)}</strong> is now <strong>Confirmed</strong>.</p>
				<p>Owner: ${escapeHtml(owner)}</p>
				<p>Amount: ${escapeHtml(money(populated.grandTotal, populated.currency))}</p>`,
			},
			actorId(user)
		);
	} catch (error) {
		console.error('Notify failed:', error.message);
	}
};

const notifySellOrderCreated = async (order, quote, user) => {
	try {
		const populatedQuote =
			quote?.account?.accountName
				? quote
				: await Quote.findById(order.finalQuote || quote?._id).populate(
						'account',
						'accountName'
				  );
		const account = populatedQuote?.account?.accountName || 'an account';
		await notifyRoles(
			['operations', 'admin'],
			{
				subject: `Sell order created: ${order.orderNumber}`,
				title: 'New sell order',
				text: `Sell order ${order.orderNumber} was created.`,
				body: `<p>Sell order <strong>${escapeHtml(
					order.orderNumber
				)}</strong> was created for <strong>${escapeHtml(account)}</strong>.</p>
				<p>Amount: ${escapeHtml(money(order.grandTotal, order.currency))}</p>
				<p>Status: awaiting approval.</p>`,
			},
			actorId(user)
		);
	} catch (error) {
		console.error('Notify failed:', error.message);
	}
};

const notifySellOrderDecision = async (order, owner, status) => {
	try {
		if (!owner) return;
		const approved = status === 'Accepted';
		await notifyUser(owner, {
			subject: `Sell order ${order.orderNumber} ${approved ? 'approved' : String(status).toLowerCase()}`,
			title: approved ? 'Sell order approved' : `Sell order ${status}`,
			text: `Your sell order ${order.orderNumber} was ${status}.`,
			body: `<p>Your sell order <strong>${escapeHtml(
				order.orderNumber
			)}</strong> was <strong>${escapeHtml(status)}</strong>.</p>
			<p>Amount: ${escapeHtml(money(order.grandTotal, order.currency))}</p>`,
		});
	} catch (error) {
		console.error('Notify failed:', error.message);
	}
};

const notifyDeliveryCompleted = async (delivery, user) => {
	try {
		const order = delivery.order || {};
		const account = order.finalQuote?.account?.accountName || 'an account';
		await notifyRoles(
			['finance', 'admin'],
			{
				subject: `Delivery completed: ${delivery.deliveryNumber || order.orderNumber || ''}`,
				title: 'Order delivered',
				text: `Delivery ${delivery.deliveryNumber || ''} is marked delivered.`,
				body: `<p>Delivery <strong>${escapeHtml(
					delivery.deliveryNumber || ''
				)}</strong> for sell order <strong>${escapeHtml(
					order.orderNumber || ''
				)}</strong> (${escapeHtml(account)}) is marked delivered.</p>
				<p>Finance can now proceed with invoicing.</p>`,
			},
			actorId(user)
		);
	} catch (error) {
		console.error('Notify failed:', error.message);
	}
};

const notifyPublicNotebook = async (note, user) => {
	try {
		if (note.visibility !== 'public') return;
		const role = String(user?.role || '').toLowerCase();
		if (role !== 'admin' && !user?.isSuperUser) return;
		const author = note.createdBy?.name || user?.name || 'A teammate';
		await notifyAllUsers(
			{
				subject: `New public notebook: ${note.title}`,
				title: 'New public notebook',
				text: `${author} shared a public notebook: ${note.title}`,
				body: `<p><strong>${escapeHtml(author)}</strong> published a public notebook.</p>
				<p>Title: <strong>${escapeHtml(note.title)}</strong></p>`,
			},
			actorId(user)
		);
	} catch (error) {
		console.error('Notify failed:', error.message);
	}
};

module.exports = {
	notifyPriceQueryPosted,
	notifyQuoteConfirmed,
	notifySellOrderCreated,
	notifySellOrderDecision,
	notifyDeliveryCompleted,
	notifyPublicNotebook,
};

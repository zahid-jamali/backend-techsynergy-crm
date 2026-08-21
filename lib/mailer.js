const nodemailer = require("nodemailer");
const User = require("../models/Users");

const getTransport = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
};

const isMailConfigured = () =>
  Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

const wrapHtml = (title, body) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#021d54;color:#ffffff;padding:16px 20px;font-size:16px;font-weight:600">
        TechSynergy CRM
      </div>
      <div style="padding:20px;color:#111827;font-size:14px;line-height:1.55">
        <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
        ${body}
      </div>
    </div>
  </div>
`;

const uniqueEmails = (users = []) => [
  ...new Set(
    users
      .map((u) =>
        String(u.email || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  ),
];

const sendMail = async ({ to, subject, title, body, text }) => {
  const recipients = Array.isArray(to)
    ? to.filter(Boolean)
    : [to].filter(Boolean);
  if (!recipients.length) return;
  const transport = getTransport();
  if (!transport) {
    return;
  }
  const from = process.env.GMAIL_FROM || process.env.GMAIL_USER;
  const html = wrapHtml(title || subject, body || `<p>${text || ""}</p>`);
  try {
    await Promise.race([
      transport.sendMail({
        from: `TechSynergy CRM <${from}>`,
        to: from,
        bcc: recipients.join(","),
        subject,
        text: text || subject,
        html,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Email timeout")), 8000),
      ),
    ]);
  } catch (error) {
    console.error("Email send failed: ", error);
  }
};

const roleQuery = (roles) => {
  const or = [{ role: { $in: roles } }];
  if (roles.includes("admin")) or.push({ isSuperUser: true });
  return {
    isActive: { $ne: false },
    email: { $exists: true, $ne: "" },
    $or: or,
  };
};

const emailsForRoles = async (roles, excludeUserId) => {
  const filter = roleQuery(roles);
  if (excludeUserId) filter._id = { $ne: excludeUserId };
  const users = await User.find(filter).select("email");
  return uniqueEmails(users);
};

const notifyRoles = async (roles, payload, excludeUserId) => {
  if (!isMailConfigured()) {
    console.warn("Email skipped: set GMAIL_USER and GMAIL_APP_PASSWORD");
    return;
  }
  const to = await emailsForRoles(roles, excludeUserId);
  await sendMail({ ...payload, to });
};

const notifyUser = async (user, payload) => {
  if (!isMailConfigured()) return;
  const email =
    user?.email || (user && (await User.findById(user).select("email"))?.email);
  if (!email) return;
  await sendMail({ ...payload, to: [email] });
};

const notifyAllUsers = async (payload, excludeUserId) => {
  if (!isMailConfigured()) {
    console.warn("Email skipped: set GMAIL_USER and GMAIL_APP_PASSWORD");
    return;
  }
  const filter = {
    isActive: { $ne: false },
    email: { $exists: true, $ne: "" },
  };
  if (excludeUserId) filter._id = { $ne: excludeUserId };
  const users = await User.find(filter).select("email");
  await sendMail({ ...payload, to: uniqueEmails(users) });
};

const safeNotify = (fn) => {
  Promise.resolve()
    .then(fn)
    .catch((err) => console.error("Notify failed:", err.message));
};

module.exports = {
  sendMail,
  notifyRoles,
  notifyUser,
  notifyAllUsers,
  safeNotify,
};

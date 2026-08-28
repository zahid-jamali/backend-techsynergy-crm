import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  h,
  styles,
  COMPANY,
  capitalize,
  formatDate,
  formatMoney,
  DocHeader,
  InfoBoxes,
  DataTable,
  SnapshotBar,
  Totals,
  Footer,
  TermList,
} from "./shared.mjs";

const lineAmount = (p) => {
  const unit = Number(p.listPrice) || 0;
  const qty = Number(p.quantity) || 0;
  const amount = Number(p.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return Math.round(unit * qty * 100) / 100;
};

const lineTotal = (p) => {
  const total = Number(p.total);
  if (Number.isFinite(total) && total > 0) return total;
  const tax = Number(p.taxAmount) || 0;
  return Math.round((lineAmount(p) + tax) * 100) / 100;
};

const QuoteDocument = ({ quote }) => {
  const currency = quote.currency || "PKR";
  const money = (amount) => formatMoney(amount, currency);
  const products = quote.products || [];
  const otherTax = quote.otherTax || [];
  const contactName = [quote.contact?.firstName, quote.contact?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const qtySum = products.reduce(
    (sum, p) => sum + (Number(p.quantity) || 0),
    0,
  );
  const amountSum = products.reduce((sum, p) => sum + lineAmount(p), 0);
  const taxSum = products.reduce(
    (sum, p) => sum + (Number(p.taxAmount) || 0),
    0,
  );
  const lineTotalSum = products.reduce((sum, p) => sum + lineTotal(p), 0);
  const quoteSubtotal = Number(quote.subTotal) || lineTotalSum;

  const taxLines = otherTax.map((t) => {
    const amount =
      t.amount != null
        ? Number(t.amount)
        : (quoteSubtotal * Number(t.percent || 0)) / 100;
    return [
      `${String(t.tax || "").toUpperCase()} (${t.percent}%)`,
      money(amount),
    ];
  });

  const terms = [
    ...(quote.validUntil
      ? [`This quotation is valid until ${formatDate(quote.validUntil)}`]
      : []),
    ...(quote.termsAndConditions || []),
  ];

  const customerLines = [
    contactName ? `Attn: ${capitalize(contactName)}` : null,
    quote.contact?.email ? `Email: ${quote.contact.email}` : null,
    quote.contact?.phone ? `Phone: ${quote.contact.phone}` : null,
  ].filter(Boolean);

  return h(
    Document,
    null,
    h(
      Page,
      { size: "A4", style: styles.page },
      h(Text, { style: styles.watermark, fixed: true }, "QUOTATION"),
      h(DocHeader, {
        title: "QUOTATION",
        rows: [
          ["Quote No:", quote.quoteNumber || "-"],
          ["Date:", formatDate(quote.createdAt || new Date())],
          ["Valid Until:", formatDate(quote.validUntil)],
          ["Currency:", currency],
        ],
      }),
      h(InfoBoxes, {
        leftTitle: "COMPANY",
        leftLines: COMPANY.address,
        rightTitle: "CUSTOMER",
        rightHeading: quote.account?.accountName || "-",
        rightLines: customerLines.length
          ? customerLines
          : [capitalize(quote.contact?.email || "")],
      }),
      // h(SnapshotBar, {
      // 	items: [
      // 		['Items', String(products.length)],
      // 		['Total Qty', String(qtySum)],
      // 		['Amount (ex tax)', money(amountSum)],
      // 		['Grand Total', money(quote.grandTotal)],
      // 	],
      // }),
      h(
        Text,
        { style: styles.paragraph },
        `Dear ${capitalize(quote.contact?.firstName || "Sir/Madam")},`,
      ),
      h(
        Text,
        { style: styles.paragraph },
        "Please find our commercial quotation below. Each line amount is Unit Price × Quantity. Line Total includes product tax where applicable.",
      ),
      h(DataTable, {
        columns: [
          { label: "#", width: 22 },
          { label: "Product / Description", width: 140, wrap: true },
          { label: "Unit Price", width: 78, align: "right", compact: true },
          { label: "Qty", width: 32, align: "right", compact: true },
          { label: "Amount", width: 78, align: "right", compact: true, strong: true },
          { label: "Tax", width: 80, align: "right", compact: true },
          { label: "Line Total", width: 86, align: "right", compact: true, strong: true },
        ],
        rows: products.map((p, i) => {
          const unit = Number(p.listPrice) || 0;
          const qty = Number(p.quantity) || 0;
          const amount = lineAmount(p);
          const taxLabel = p.Tax?.length
            ? p.Tax.map((t) => `${t.tax} ${t.percent}%`).join(", ")
            : "-";
          return [
            i + 1,
            [
              p.productName || "-",
              p.description ? String(p.description) : null,
            ],
            money(unit),
            qty,
            money(amount),
            [taxLabel, Number(p.taxAmount) > 0 ? money(p.taxAmount) : null],
            money(lineTotal(p)),
          ];
        }),
        footer: [
          "",
          "Totals",
          "",
          qtySum,
          money(amountSum),
          taxSum > 0 ? money(taxSum) : "-",
          money(lineTotalSum),
        ],
        note: "Amount = Unit Price × Qty · Line Total = Amount + product tax",
      }),
      h(Totals, {
        lines: [
          ["Goods amount (ex tax)", money(amountSum)],
          ...(taxSum > 0 ? [["Product tax", money(taxSum)]] : []),
          ["Subtotal", money(quoteSubtotal)],
          ...taxLines,
        ],
        grandLabel: "Grand Total",
        grandValue: money(quote.grandTotal),
      }),
      h(TermList, {
        title: "Terms & Conditions:",
        items: terms,
        transform: false,
      }),
      h(
        View,
        { style: { marginTop: 16 }, wrap: false },
        h(Text, { style: styles.bold }, "Best Regards,"),
        h(
          Text,
          { style: styles.light },
          capitalize(quote.quoteOwner?.name || ""),
        ),
        h(Text, { style: styles.light }, quote.quoteOwner?.email || ""),
        h(Text, { style: styles.light }, "TechSynergy Innovations Pvt. Ltd."),
      ),
      h(Footer, null),
    ),
  );
};

export default QuoteDocument;

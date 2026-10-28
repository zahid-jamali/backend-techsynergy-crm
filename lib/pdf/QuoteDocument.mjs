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

const QuoteItemsTable = ({ columns, rows, footer, note }) => {
  const borderColor = "gray";
  const borderWidth = 0.5;

  const tableStyles = {
    table: {
      width: "100%",
      marginTop: 12,
      marginBottom: 8,
      fontSize: 7.5,
      color: "#1F2937",
      borderTopWidth: borderWidth,
      borderLeftWidth: borderWidth,
      borderColor,
    },
    header: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: "black",
      borderBottomWidth: borderWidth,
      borderColor,
    },
    headerCell: {
      paddingVertical: 7,
      paddingHorizontal: 2,
      fontSize: 7,
      fontWeight: "bold",
      color: "#FFFFFF",
      justifyContent: "center",
    },
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      borderBottomWidth: borderWidth,
      borderColor,
    },
    cell: {
      paddingVertical: 6,
      paddingHorizontal: 2,
      fontSize: 7.2,
      lineHeight: 1.3,
      justifyContent: "flex-start",
    },
    productName: {
      fontSize: 7.8,
      fontWeight: "bold",
      color: "#111827",
      marginBottom: 3,
      lineHeight: 1.3,
    },
    description: {
      fontSize: 7.2,
      lineHeight: 1.4,
      color: "#475569",
    },
    footer: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: "#E8EEF6",
      borderBottomWidth: borderWidth,
      borderColor,
    },
    footerCell: {
      paddingVertical: 7,
      paddingHorizontal: 2,
      fontSize: 7.1,
      fontWeight: "bold",
      color: "#111827",
    },
  };

  const cellStyle = (column, index, isHeader = false) => ({
    width: `${column.share}%`,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    ...(isHeader ? tableStyles.headerCell : tableStyles.cell),
    borderRightWidth: borderWidth,
    borderRightColor: borderColor,
    ...(column.align === "right" ? { alignItems: "flex-end" } : {}),
    ...(column.align === "center" ? { alignItems: "center" } : {}),
  });

  const renderCell = (value, column, index, isHeader = false) => {
    const isProduct = Array.isArray(value);

    return h(
      View,
      {
        key: `${column.label}-${index}`,
        style: cellStyle(column, index, isHeader),
      },
      isProduct
        ? h(
            View,
            null,
            value[0]
              ? h(
                  Text,
                  { style: tableStyles.productName, wrap: true },
                  String(value[0]),
                )
              : null,
            value[1]
              ? h(
                  Text,
                  { style: tableStyles.description, wrap: true },
                  String(value[1]),
                )
              : null,
          )
        : h(
            Text,
            {
              wrap: true,
              style: {
                color: isHeader ? "#FFFFFF" : "#1F2937",
                textAlign: column.align || "left",
                lineHeight: 1.3,
              },
            },
            value == null || value === "" ? "-" : String(value),
          ),
    );
  };

  return h(
    View,
    { style: tableStyles.table },
    h(
      View,
      { style: tableStyles.header, fixed: true },
      columns.map((column, index) =>
        renderCell(column.label, column, index, true),
      ),
    ),
    ...rows.map((row, rowIndex) =>
      h(
        View,
        {
          key: `product-row-${rowIndex}`,
          wrap: true,
          style: {
            ...tableStyles.row,
            backgroundColor: rowIndex % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
          },
        },
        row.map((value, index) => renderCell(value, columns[index], index)),
      ),
    ),
    footer
      ? h(
          View,
          { style: tableStyles.footer },
          footer.map((value, index) =>
            h(
              View,
              {
                key: `footer-${index}`,
                style: {
                  width: `${columns[index].share}%`,
                  flexGrow: 0,
                  flexShrink: 1,
                  minWidth: 0,
                  ...tableStyles.footerCell,
                  borderRightWidth: borderWidth,
                  borderRightColor: borderColor,
                  alignItems:
                    columns[index].align === "right"
                      ? "flex-end"
                      : columns[index].align === "center"
                        ? "center"
                        : "flex-start",
                },
              },
              h(
                Text,
                {
                  wrap: true,
                  style: {
                    textAlign: columns[index].align || "left",
                    lineHeight: 1.3,
                  },
                },
                value == null || value === "" ? "" : String(value),
              ),
            ),
          ),
        )
      : null,
    note
      ? h(
          Text,
          {
            style: {
              marginTop: 5,
              fontSize: 7,
              color: "#64748B",
              lineHeight: 1.3,
            },
          },
          note,
        )
      : null,
  );
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
          // ["Currency:", currency],
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

      h(QuoteItemsTable, {
        columns: [
          { label: "#", share: 4, align: "center" },
          { label: "Product / Description", share: 34 },
          { label: "Unit Price", share: 12, align: "right" },
          { label: "Qty", share: 6, align: "right" },
          { label: "Amount", share: 14, align: "right" },
          { label: "Tax", share: 12, align: "right" },
          { label: "Line Total", share: 18, align: "right" },
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
            [taxLabel, Number(p.taxAmount) > 0 ? money(p.taxAmount) : null]
              .filter(Boolean)
              .join("\n"),
            money(lineTotal(p)),
          ];
        }),

        footer: [
          "",
          "TOTAL",
          "",
          qtySum,
          money(amountSum),
          taxSum > 0 ? money(taxSum) : "-",
          money(lineTotalSum),
        ],

        note: "Amount = Unit Price × Qty · Line Total = Amount + product tax",
      }),

      // h(DataTable, {
      //   columns: [
      //     { label: "#", width: 22 },
      //     {
      //       label: "Product / Description",
      //       width: 170,
      //       wrap: true,
      //       compact: false,
      //     },
      //     { label: "Unit Price", width: 78, align: "right", compact: true },
      //     { label: "Qty", width: 32, align: "right", compact: true },
      //     {
      //       label: "Amount",
      //       width: 78,
      //       align: "right",
      //       compact: true,
      //       strong: true,
      //     },
      //     { label: "Tax", width: 80, align: "right", compact: true },
      //     {
      //       label: "Line Total",
      //       width: 86,
      //       align: "right",
      //       compact: true,
      //       strong: true,
      //     },
      //   ],
      //   rows: products.map((p, i) => {
      //     const unit = Number(p.listPrice) || 0;
      //     const qty = Number(p.quantity) || 0;
      //     const amount = lineAmount(p);
      //     const taxLabel = p.Tax?.length
      //       ? p.Tax.map((t) => `${t.tax} ${t.percent}%`).join(", ")
      //       : "-";
      //     return [
      //       i + 1,
      //       [
      //         p.productName || "-",
      //         p.description ? String(p.description) : null,
      //       ],
      //       money(unit),
      //       qty,
      //       money(amount),
      //       [taxLabel, Number(p.taxAmount) > 0 ? money(p.taxAmount) : null],
      //       money(lineTotal(p)),
      //     ];
      //   }),
      //   footer: [
      //     "",
      //     "Total",
      //     "",
      //     qtySum,
      //     money(amountSum),
      //     taxSum > 0 ? money(taxSum) : "-",
      //     money(lineTotalSum),
      //   ],
      //   note: "Amount = Unit Price × Qty · Line Total = Amount + product tax",
      // }),
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

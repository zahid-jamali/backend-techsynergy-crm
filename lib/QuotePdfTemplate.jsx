
const fs = require("fs");
const path = require("path");

const logoBase64 = fs.readFileSync(
  path.join(__dirname, "../assets/image.png"),
  "base64"
);

const logo = `data:image/png;base64,${logoBase64}`;


const fontBase64 = fs.readFileSync(
  path.join(__dirname, "../assets/myFont.ttf"),
  "base64"
);

const getQuoteHtml = (quote) => {
  const formatCurrency = (amount) =>
    `${quote.currency} ${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const capitalize = (value) => {
    if (!value || typeof value !== "string") return "";
    return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const otherTaxRows = (quote.otherTax || [])
    .map(
      (t) => `
<tr>
<td>${t.tax.toUpperCase()} (${t.percent}%)</td>
<td class="text-right">
${formatCurrency(
  (quote.subTotal - quote.discountTotal) *
    (Number(t.percent) / 100)
)}
</td>
</tr>
`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<style>

/* FONT */

@font-face {
  font-family: "CourierNewBold";
  src: url(data:font/ttf;base64,${fontBase64})
       format("truetype");
  font-weight: bold;
}

/* GLOBAL */

* {
  box-sizing: border-box;
}

body {
  font-family: "CourierNewBold";
  margin: 0;
  padding: 30px;
  font-size: 10px;
  color: #000;
}

/* WATERMARK */

.watermark {
  position: fixed;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 90px;
  color: rgba(0,0,0,0.06);
  z-index: 0;
  white-space: nowrap;
}



/* HEADER */

.container {
  width: 100%;
  max-width: 900px;
  margin: auto;
  position: relative;
  z-index: 1;
}

.header {
  display: flex;
  justify-content: space-between;
}


.logo img {
  width: 260px;
}

.doc-title {
  background: #000;
  color: #fff;
  padding: 10px 50px;
  font-weight: bold;
  display: inline-block;
}

.info td {
  padding: 2px 8px;
}

.section {
  display: flex;
  justify-content: space-between;
  margin-top: 25px;
}

.box {
  width: 48%;
}

.box-title {
  background: #000;
  color: #fff;
  padding: 6px;
  text-align: center;
  font-weight: bold;
  margin-bottom: 10px;
}

/* TABLE */

table {
  width: 100%;
  border-collapse: collapse;
}

.items {
  margin-top: 25px;
}

.items th {
  text-align: left;
  padding: 8px;
  border-bottom: 2px solid #000;
}

.items td {
  padding: 10px 8px;
  border-bottom: 1px solid #ddd;
}

.text-right {
  text-align: right;
}

thead {
  display: table-header-group;
}

tr {
  page-break-inside: avoid;
}

/* TOTALS */

.totals-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.totals {
  width: 320px;
}

.totals td {
  padding: 6px;
}

.grand {
  font-weight: bold;
  border-top: 2px solid #000;
}

/* FINAL SECTION — CRITICAL */

.final-section {
  margin-top: 40px;

  page-break-inside: avoid;
  break-inside: avoid;
}

/* SIGNATURE */

.signature {
  margin-top: 20px;
}

/* FOOTER */

.footer {
  margin-top: 30px;
  padding-top: 10px;
  border-top: 1px solid #000;
  text-align: center;
  font-size: 11px;
  color: #444;
}

</style>

</head>

<body>

<!-- WATERMARK -->

<div class="watermark">
QUOTATION
</div>



<div class="container">

<!-- HEADER -->

<div class="header">

<div class="logo">
<img src="${logo}" alt="ALT" />
</div>

<div>

<div class="doc-title">
QUOTATION
</div>

<table class="info">

<tr>
<td>Quote No:</td>
<td>${quote.quoteNumber}</td>
</tr>

<tr>
<td>Date:</td>
<td>${new Date(
  quote.createdAt
).toLocaleDateString()}</td>
</tr>

<tr>
<td>Valid Until:</td>
<td>${
  quote.validUntil
    ? new Date(quote.validUntil).toLocaleDateString()
    : "-"
}</td>
</tr>

</table>

</div>

</div>

<!-- COMPANY + CUSTOMER -->

<div class="section">

<div class="box">

<div class="box-title">
COMPANY
</div>

<b>TECHSYNERGY INNOVATIONS (PRIVATE) LIMITED</b>

<p>
Plot 47-C, Mezzanine Floor, 21st Street<br/>
Phase II Extension, DHA, Karachi<br/>
Website: www.techsynergypk.com<br/>
Email: sales@techsynergypk.com<br/>
NTN: G141420
</p>

</div>

<div class="box">

<div class="box-title">
CUSTOMER
</div>

<b>
${capitalize(
  quote.account?.accountName || ""
)}
</b>

<p>
${capitalize(
  quote.contact?.email || ""
)}
</p>

</div>

</div>

<p>
Dear ${capitalize(
  quote.contact?.firstName || "Sir/Madam"
)},
</p>

<p>
We are pleased to submit our formal quotation.
</p>

<!-- ITEMS -->

<table class="items">

<thead>

<tr>
<th style="width:5%">S.No</th>
<th style="width:20%">Product</th>
<th>Description</th>
<th style="width:15%">Unit Price</th>
<th style="width:10%">Qty</th>
<th style="width:15%">Line Total</th>
</tr>

</thead>

<tbody>

${quote.products
  .map(
    (p, i) => `
<tr>

<td>${i + 1}</td>

<td>
${capitalize(p.productName)}
</td>

<td>
${p.description}
</td>

<td class="text-right">
${formatCurrency(p.listPrice)}
</td>

<td class="text-right">
${p.quantity}
</td>

<td class="text-right">
${formatCurrency(p.total)}
</td>

</tr>
`
  )
  .join("")}

</tbody>

</table>

<!-- TOTALS -->

<div class="totals-wrapper">

<table class="totals">

<tr>
<td>Subtotal</td>
<td class="text-right">
${formatCurrency(quote.subTotal)}
</td>
</tr>

${
  quote.discountTotal
    ? `
<tr>
<td>Discount</td>
<td class="text-right">
${formatCurrency(quote.discountTotal)}
</td>
</tr>
`
    : ""
}

${
  quote.isGstApplied
    ? `
<tr>
<td>GST (18%)</td>
<td class="text-right">
${formatCurrency(quote.gstAmount)}
</td>
</tr>
`
    : ""
}

${otherTaxRows}

<tr class="grand">
<td>Total</td>
<td class="text-right">
${formatCurrency(quote.grandTotal)}
</td>
</tr>

</table>

</div>

<!-- FINAL SECTION -->

<div class="final-section">

<div class="terms">

<b>Terms & Conditions:</b>

<ul>

${
  quote.validUntil
    ? `
<li>
This quotation is valid until
${new Date(
  quote.validUntil
).toLocaleDateString()}
</li>
`
    : ""
}

${(quote.termsAndConditions || [])
  .map((t) => `<li>${capitalize(t)}</li>`)
  .join("")}

</ul>

</div>

<div class="signature">

<b>Best Regards,</b><br/>

${capitalize(
  quote.quoteOwner?.name || ""
)}<br/>

${quote.quoteOwner?.email || ""}<br/>

TechSynergy Innovations Pvt. Ltd.

</div>

<div class="footer">

47-C, Mezz Floor, DHA Phase II Ext, Karachi<br/>

www.techsynergypk.com |
info@techsynergypk.com |
0337-8328310

</div>

</div>

</div>

</body>

</html>
`;
};

module.exports = getQuoteHtml;
const fs = require("fs");
const path = require("path");

const logoBase64 = fs.readFileSync(
  path.join(__dirname, "../assets/image.jpeg"),
  "base64"
);

const logo = `data:image/png;base64,${logoBase64}`;


const fontBase64 = fs.readFileSync(
  path.join(__dirname, "../assets/myFont.ttf"),
  "base64"
);

const getPOToVendorHtml = (po) => {
  const formatCurrency = (amount) =>
    `PKR ${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const capitalize = (value) => {
    if (!value || typeof value !== "string") return "";
    return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const taxRows =
    Array.isArray(po?.Tax) && po.Tax.length > 0
      ? po.Tax.map(
          (t) => `
<tr>
<td>${t.tax.toUpperCase()} (${t.percent}%)</td>
<td class="text-right">
${formatCurrency(t.amount)}
</td>
</tr>
`
        ).join("")
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<style>

/* PAGE SETTINGS — CRITICAL */

@page {
  size: A4;
  margin: 40px 40px 150px 40px;
}

/* FONT */

@font-face {
  font-family: "CourierNewBold";
  src: url(data:font/ttf;base64,${fontBase64})
       format("truetype");
}

/* BASE */

body {
  font-family: "CourierNewBold";
  margin: 0;
  padding: 0;
  font-size: 10px;
}

.container {
  width: 100%;
  max-width: 900px;
  margin: auto;
}

/* HEADER */

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.logo img {
  width: 260px;
}

.doc-title {
  background: #000;
  color: #fff;
  padding: 10px 60px;
  font-weight: bold;
  margin-bottom: 10px;
  display: inline-block;
}

.info td {
  padding: 2px 10px;
}

.light {
  font-size: 10px;
  color: #444;
}

/* BOXES */

.section {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
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
  margin-top: 30px;
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

/* TOTALS */

.totals {
  margin-top: 10px;
  width: 320px;
  float: right;
}

.totals td {
  padding: 6px;
}

.totals .grand {
  font-weight: bold;
  border-top: 2px solid #000;
}

/* TERMS */

.terms {
  margin-top: 60px;
}

/* FOOTER SYSTEM — PRODUCTION SAFE */

.footer-space {
  height: 150px;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;

  height: 130px;

  text-align: center;

  border-top: 1px solid #000;

  font-size: 11px;
  color: #444;

  background: #fff;

  padding-top: 10px;
}

/* PAGE BREAK SAFETY */

thead {
  display: table-header-group;
}

tr {
  page-break-inside: avoid;
}

.items {
  page-break-inside: auto;
}

.totals {
  page-break-inside: avoid;
}

.terms {
  page-break-inside: avoid;
}

</style>

</head>

<body>

<div class="container">

<!-- HEADER -->

<div class="header">

<div class="logo">
<img src="${logo}" />
</div>

<div>

<br/><br/>

<div class="doc-title">
PURCHASE ORDER TO VENDOR
</div>

<table class="info light">

<tr>
<td>PO No:</td>
<td>${po.poToNumber}</td>
</tr>

<tr>
<td>Date:</td>
<td>${new Date(po.createdAt).toLocaleDateString()}</td>
</tr>

<tr>
<td>Reference Quote:</td>
<td>${po.refQuote?.quoteNumber || "-"}</td>
</tr>

</table>

</div>

</div>

<!-- COMPANY + VENDOR -->

<div class="section">

<div class="box">

<div class="box-title">
COMPANY
</div>

<b>TECHSYNERGY INNOVATIONS (PRIVATE) LIMITED</b>

<p class="light">
Plot 47-C, Mezzanine Floor<br/>
Phase II Extension, DHA Karachi<br/>
NTN: G141420
</p>

</div>

<div class="box">

<div class="box-title">
VENDOR
</div>

<b>
${capitalize(po.vendor?.name || "")}
</b>

<p class="light">
Status: ${po.vendor?.status || "-"}
</p>

</div>

</div>

<!-- SUBJECT -->

<br/>

<p>
<strong>Subject:</strong>
${po.subject || ""}
</p>

<!-- ITEMS -->

<table class="items">

<thead>

<tr>
<th style="width:5%">S.No</th>
<th>Product Description</th>
<th style="width:10%">Qty</th>
<th style="width:15%">Unit Price</th>
<th style="width:15%">Line Total</th>
</tr>

</thead>

<tbody class="light">

${
  Array.isArray(po?.products) && po.products.length > 0
    ? po.products
        .map(
          (p, i) => `
<tr>
<td>${i + 1}</td>
<td>${capitalize(p.productName)}</td>
<td class="text-right">${p.quantity}</td>
<td class="text-right">${formatCurrency(p.listPrice)}</td>
<td class="text-right">${formatCurrency(p.amount)}</td>
</tr>
`
        )
        .join("")
    : `
<tr>
<td colspan="5" style="text-align:center;">
No products available
</td>
</tr>
`
}

</tbody>

</table>

<!-- TOTALS -->

<table class="totals">

<tr>
<td>Subtotal</td>
<td class="text-right">
${formatCurrency(po.subTotal)}
</td>
</tr>

${taxRows}

<tr class="grand">
<td>Total</td>
<td class="text-right">
${formatCurrency(po.grandTotal)}
</td>
</tr>

</table>

<!-- TERMS -->

${
  po.termsAndConditions?.length
    ? `
<div class="terms">

<b>Terms & Conditions:</b>

<ul>

${po.termsAndConditions
  .map((t) => `<li>${capitalize(t)}</li>`)
  .join("")}

</ul>

</div>
`
    : ""
}

<!-- FOOTER SPACER -->

<div class="footer-space"></div>

</div>

<!-- FOOTER -->

<div class="footer">

47-C, Mezz Floor, DHA Phase II Ext, Karachi
<br/>

www.techsynergypk.com |
info@techsynergypk.com |
0337-8328310

</div>

</body>
</html>
`;
};

module.exports = getPOToVendorHtml;
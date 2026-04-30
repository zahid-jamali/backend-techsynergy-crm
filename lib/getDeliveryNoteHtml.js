const fs = require("fs");
const path = require("path");

const fontBase64 = fs.readFileSync(
  path.join(__dirname, "../assets/myFont.ttf"),
  "base64"
);

const logoBase64 = fs.readFileSync(
  path.join(__dirname, "../assets/image.jpeg"),
  "base64"
);

const logo = `data:image/png;base64,${logoBase64}`;


const getDeliveryNoteHtml = (order) => {
  const capitalize = (value) => {
    if (!value || typeof value !== "string") return "";
    return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const quote = order.finalQuote || {};
  const account = quote.account || {};
  const contact = quote.contact || {};

  const billingAddress = account.billingAddress
    ? `${account.billingAddress.street || ""}, 
       ${account.billingAddress.city || ""}, 
       ${account.billingAddress.state || ""}, 
       ${account.billingAddress.country || ""}`
    : "-";

  return `
<!DOCTYPE html>
<html>

<head>
<meta charset="UTF-8">

<style>

@font-face {
  font-family: "CourierNewBold";
  src: url(data:font/ttf;base64,${fontBase64})
       format("truetype");
  font-weight: bold;
}

body {
  font-family: "CourierNewBold";
  margin: 0;
  padding: 30px;
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
  display: inline-block;
}

.info td {
  padding: 2px 10px;
}

.light {
  font-size: 10px;
  color: #444;
}

/* COMPANY + CUSTOMER */

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

/* SIGNATURE */

.signature {
  margin-top: 60px;
  display: flex;
  justify-content: space-between;
}

.sign {
  width: 40%;
  text-align: center;
}

.line {
  margin-top: 40px;
  border-top: 1px solid #000;
}

/* FOOTER */

.footer {
  margin-top: 40px;
  text-align: center;
  font-size: 11px;
  color: #444;
}

/* PRINT STABILITY */

thead {
  display: table-header-group;
}

tr {
  page-break-inside: avoid;
}

.items {
  page-break-inside: auto;
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

    <br/>
    <br/>

    <div class="doc-title">
      DELIVERY NOTE
    </div>

    <table class="info light">

      <tr>
        <td>Delivery No:</td>
        <td>${order.orderNumber || order._id}</td>
      </tr>

      <tr>
        <td>Date:</td>
        <td>${new Date(
          order.confirmedDate || order.createdAt
        ).toLocaleDateString()}</td>
      </tr>

      <tr>
        <td>Status:</td>
        <td>${order.status}</td>
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

    <p class="light">
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
      ${capitalize(account.accountName || "")}
    </b>

    <p class="light">
      ${billingAddress}
      <br/>
      Phone: ${contact.phone || "-"}
      <br/>
      Email: ${contact.email || "-"}
    </p>

  </div>

</div>

<!-- ITEMS -->

<table class="items">

<thead>

<tr>

<th style="width:5%">
S.No
</th>

<th style="width:55%">
Description
</th>

<th style="width:15%">
Quantity
</th>

<th style="width:25%">
Remarks
</th>

</tr>

</thead>

<tbody class="light">

${order.products
  ?.map(
    (p, i) => `
<tr>

<td>
${i + 1}
</td>

<td>
${capitalize(p.productName)}
</td>

<td>
${p.quantity}
</td>

<td>
Received in good condition
</td>

</tr>
`
  )
  .join("")}

</tbody>

</table>



<div>
	<p style="align:justify; padding: 10px 20px;">
<b>Note:</b>
<span  class="light">
This Delivery Note serves as proof of receipt. The recipient must thoroughly inspect all delivered 
items at the time of delivery. Any discrepancies, damages, or shortages must be clearly stated on the 
Delivery Note and acknowledged by the delivery representative. The company shall not be liable for any 
claims submitted after delivery completion.
</span>	</p>
</div>






<!-- SIGNATURE -->

<div class="signature">

<div class="sign">

Prepared By

<div class="line"></div>

</div>

<div class="sign">

Received By

<div class="line"></div>

</div>

</div>

<!-- FOOTER -->

<div class="footer">

47-C, Mezz Floor, DHA Phase II Ext, Karachi
<br/>

www.techsynergypk.com
|
info@techsynergypk.com
|
0337-8328310

</div>

</div>

</body>

</html>
`;
};

module.exports = getDeliveryNoteHtml;
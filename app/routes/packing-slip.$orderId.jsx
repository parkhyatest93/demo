// app/routes/packing-slip.$orderId.tsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import puppeteer from "puppeteer";

export const loader = async ({ params, request }) => {
  const { admin } = await authenticate.admin(request);
  const orderId = params.orderId;

  const resp = await admin.rest.get(`/admin/api/2024-10/orders/${orderId}.json`);
  console.log(resp,"resp slip");
  const order = (await resp.json()).order;

//   const html = `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="utf-8">
//   <title>Packing Slip - ${order.name}</title>
//   <style>
//     body { font-family: Arial, sans-serif; margin: 2cm; }
//     .header { text-align: center; margin-bottom: 1.5cm; }
//     table { width: 100%; border-collapse: collapse; margin-top: 1cm; }
//     th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
//     th { background-color: #f2f2f2; }
//   </style>
// </head>
// <body>
//   <div class="header">
//     <h1>Packing Slip</h1>
//     <p><strong>Order:</strong> ${order.name} | <strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
//   </div>

//   <h3>Ship To:</h3>
//   <p>
//     ${order.shipping_address?.name}<br>
//     ${order.shipping_address?.address1}<br>
//     ${order.shipping_address?.city}, ${order.shipping_address?.province} ${order.shipping_address?.zip}
//   </p>

//   <table>
//     <thead><tr><th>Item</th><th>SKU</th><th>Qty</th></tr></thead>
//     <tbody>
//       ${order.line_items.map(item => `
//         <tr><td>${item.title}</td><td>${item.sku || '—'}</td><td>${item.quantity}</td></tr>
//       `).join('')}
//     </tbody>
//   </table>
// </body>
// </html>
//   `;

//   const browser = await puppeteer.launch({
//     headless: true,
//     args: ["--no-sandbox", "--disable-setuid-sandbox"],
//   });
//   const page = await browser.newPage();
//   await page.setContent(html, { waitUntil: "networkidle0" });
//   const pdf = await page.pdf({ format: "A4", printBackground: true });
//   await browser.close();

//   return new Response(pdf, {
//     headers: {
//       "Content-Type": "application/pdf",
//       "Content-Disposition": `inline; filename="packing-slip-${order.name}.pdf"`,
//     },
//   });
};
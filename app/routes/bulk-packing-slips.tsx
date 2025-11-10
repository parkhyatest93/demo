import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Liquid } from "liquidjs";
import puppeteer from "puppeteer";
import { authenticate } from "../shopify.server";
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// ✅ Global CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store",
};

// 🩵 Handle Remix loader requests (GET + OPTIONS)
export async function loader({ request }: LoaderFunctionArgs) {
  // Handle CORS preflight (OPTIONS)
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Optional: Health check endpoint
  if (request.method === "GET") {
    return json({ ok: true, route: "/bulk-packing-slips" }, { headers: CORS_HEADERS });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: CORS_HEADERS,
  });
}

// 🧾 Shopify Order Interface
interface ShopifyOrder {
  id: string;
  name: string;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
  };
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        quantity: number;
        variant: {
          id: string;
          sku?: string;
          image?: { url: string };
          product: { id: string; title: string; description?: string };
        };
      };
    }>;
  };
  shippingAddress: {
    address1: string;
    city: string;
    provinceCode: string;
    countryCode: string;
    zip?: string;
  };
  subtotalPriceSet: { shopMoney: { amount: string } };
  totalTaxSet: { shopMoney: { amount: string } };
  fulfillmentOrders?: {
    edges: Array<{
      node: {
        lineItems: {
          edges: Array<{
            node: {
              id: string;
              totalQuantity: number;
              lineItem: { id: string; title: string };
            };
          }>;
        };
      };
    }>;
  };
}

// GraphQL Response Interface
interface GraphQLResponse {
  data?: {
    nodes: Array<any>;
  };
  errors?: Array<{
    message: string;
  }>;
}

// 🧩 Liquid Template Setup
const engine = new Liquid({
  extname: ".liquid",
  cache: true,
});

// 🧾 Packing Slip Template
const PACKING_SLIP_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Packing Slip - {{ order.name }}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .customer { margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; }
    .image { width: 50px; height: auto; }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Packing Slip</h1>
    <p>Order: {{ order.name }} | Date: {{ order.createdAt | date: "%B %d, %Y" }}</p>
  </div>

  <div class="customer">
    <h2>Ship To:</h2>
    <p>{{ order.customer.firstName | default: 'N/A' }} {{ order.customer.lastName | default: '' }}</p>
    <p>{{ order.shippingAddress.address1 | default: 'N/A' }}</p>
    <p>{{ order.shippingAddress.city | default: 'N/A' }}, {{ order.shippingAddress.provinceCode | default: '' }} {{ order.shippingAddress.zip | default: '' }}</p>
    <p>{{ order.shippingAddress.countryCode | default: 'N/A' }}</p>
    <p>Email: {{ order.customer.email | default: 'N/A' }}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>SKU</th>
        <th>Qty</th>
        <th>Image</th>
      </tr>
    </thead>
    <tbody>
      {% for line_item in order.lineItems.edges %}
        {% assign item = line_item.node %}
        <tr>
          <td><strong>{{ item.variant.product.title | default: item.title }}</strong><br>{{ item.title }}</td>
          <td>{{ item.variant.sku | default: 'N/A' }}</td>
          <td>{{ item.quantity }}</td>
          <td>
            {% if item.variant.image %}
              <img src="{{ item.variant.image.url }}" alt="{{ item.title }}" class="image">
            {% else %}
              N/A
            {% endif %}
          </td>
        </tr>
      {% endfor %}
    </tbody>
  </table>

  <p style="text-align: center; margin-top: 40px;">Thank you for your order!</p>
  <div class="page-break"></div>
</body>
</html>
` as const;

// 🧠 Main Action Function (POST)
export async function action({ request }: ActionFunctionArgs) {
  // ✅ Handle CORS preflight if sent here (safety)
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return json({ message: "Only POST allowed for bulk packing slips." }, { headers: CORS_HEADERS });
  }

  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.json();
    console.log("bulk order ids", body.orders);
    const orderIds: string[] = body.orders || [];
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return json({ error: "No orders provided" }, { status: 400, headers: CORS_HEADERS });
    }

    console.log("Executing GraphQL query for", orderIds.length, "orders");

    const response = await admin.graphql(
      `#graphql
      query getOrders($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Order {
            id
            name
            createdAt
            customer {
              firstName
              lastName
              email
            }
            lineItems(first: 100) {
              edges {
                node {
                  id
                  title
                  quantity
                  variant {
                    id
                    sku
                    image {
                      url(transform: {maxWidth: 100, crop: CENTER})
                    }
                    product {
                      id
                      title
                      description
                    }
                  }
                }
              }
            }
            shippingAddress {
              address1
              city
              provinceCode
              countryCode
              zip
            }
            subtotalPriceSet {
              shopMoney {
                amount
              }
            }
            totalTaxSet {
              shopMoney {
                amount
              }
            }
            fulfillmentOrders(first: 10) {
              edges {
                node {
                  lineItems(first: 100) {
                    edges {
                      node {
                        id
                        totalQuantity
                        lineItem {
                          id
                          title
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      {
        variables: {
          ids: orderIds,
        },
      }
    );

    const data: GraphQLResponse = await response.json();
    console.log("GraphQL response:", data);

    if (data.errors || !data.data) {
      throw new Error("Failed to fetch orders: " + JSON.stringify(data.errors || "Unknown error"));
    }

    // Log node details for debugging
    console.log("Node typenames:", data.data.nodes.map((node: any) => node?.__typename));
    console.log("Node counts with id:", data.data.nodes.filter((node: any) => node?.id).length);

    // Filter out null nodes and ensure they have id (since ... on Order guarantees type)
    const orders: ShopifyOrder[] = (data.data?.nodes || []).filter((node: any) => node !== null && node.id);
    console.log("Fetched orders count after filter:", orders.length);
    if (orders.length > 0) {
      console.log("Sample order keys:", Object.keys(orders[0]));
      console.log("Sample order id:", orders[0].id);
    }

    if (orders.length === 0) {
      return json({ error: "No valid orders found. Check order IDs and permissions." }, { status: 400, headers: CORS_HEADERS });
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Puppeteer browser launched successfully");

    // Generate combined HTML for all orders
    let combinedHtml = '';
    for (const order of orders) {
      console.log(`Rendering HTML for order: ${order.name}`);
      const html = await engine.parseAndRender(PACKING_SLIP_TEMPLATE, { order });
      combinedHtml += html;
    }
    console.log(`Combined HTML generated for ${orders.length} orders`);

    const page = await browser.newPage();
    await page.setContent(combinedHtml, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ 
      format: "A4",
      printBackground: true 
    });
    console.log(`Single PDF generated for ${orders.length} orders, size: ${pdfBuffer.length}`);
    await page.close();

    console.log("Browser closed");

    // Create 'pdfs' directory if it doesn't exist
    const pdfsDir = path.join(process.cwd(), 'pdfs');
    await mkdir(pdfsDir, { recursive: true });

    // Generate timestamped filename
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('Z')[0]; // e.g., 2025-11-10T11-09-00
    const filename = `packing-slips-${timestamp}.pdf`;
    const filePath = path.join(pdfsDir, filename);
    await writeFile(filePath, pdfBuffer);
    console.log(`PDF saved to file: ${filePath}`);

    // Return success response with file path
    return json({ 
      success: true, 
      message: `Single PDF with ${orders.length} packing slips generated and saved successfully`,
      filePath,
      filename
    }, { status: 200, headers: CORS_HEADERS });

  } catch (error) {
    console.error("❌ Bulk packing slips error details:", error);
    return json({ error: "Failed to generate packing slips: " + (error as Error).message }, { status: 500, headers: CORS_HEADERS });
  }
}
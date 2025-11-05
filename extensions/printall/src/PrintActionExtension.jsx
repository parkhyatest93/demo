import {
  reactExtension,
  useApi,
  AdminPrintAction,
  Banner,
  BlockStack,
  Text,
  Button,
} from "@shopify/ui-extensions-react/admin";
import { useEffect, useState } from "react";

const TARGET = "admin.order-index.selection-print-action.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data, navigate } = useApi(TARGET); // navigate is from Shopify, not Remix
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [tagsAdded, setTagsAdded] = useState(false);

  // Add Himanshu Tag to selected orders
  const addHimanshuTags = async () => {
    setLoading(true);
    setError(null);
    setTagsAdded(false);

    try {
      const selectedOrders = data?.selected || data?.selection || [];
      if (selectedOrders.length === 0) {
        setError("No orders selected");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const order of selectedOrders) {
        try {
          const currentTags = order.tags || [];
          const updatedTags = Array.isArray(currentTags)
            ? [...currentTags, "himanshu-tag"]
            : ["himanshu-tag"];
          const uniqueTags = [...new Set(updatedTags)];

          const res = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `
                mutation UpdateOrderTags($id: ID!, $tags: [String!]!) {
                  orderUpdate(input: { id: $id, tags: $tags }) {
                    order { id tags }
                    userErrors { field message }
                  }
                }
              `,
              variables: { id: order.id, tags: uniqueTags },
            }),
          });

          const result = await res.json();
          if (result?.data?.orderUpdate?.userErrors?.length > 0) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error("Tag error for order:", order.name, err);
          errorCount++;
        }
      }

      setTagsAdded(true);
      if (errorCount === 0) setSuccess(true);
      else setError(`Tags: ${successCount} success, ${errorCount} failed`);
    } catch (e) {
      setError("Tag error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF URLs for selected orders (for bulk print)
  const generatePdfUrls = async (orders) => {
    const urls = [];
    for (const order of orders) {
      const orderId = order.id.split("/").pop();
      const pdfUrl = `/packing-slip/${orderId}`; // Relative URL
      urls.push(pdfUrl);
    }
    return urls;
  };

  // Main: Add Tag + Show PDF in Print Modal
  const processBulkOrders = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setSrc(null);

    try {
      const selectedOrders = data?.selected || data?.selection || [];
      if (selectedOrders.length === 0) {
        setError("No orders selected");
        return;
      }

      // Step 1: Add tag
      await addHimanshuTags();

      // Step 2: Generate PDF URLs
      const pdfUrls = await generatePdfUrls(selectedOrders);

      if (pdfUrls.length === 1) {
        // Single order → show in modal
        setSrc(pdfUrls[0]);
      } else {
        // Multiple → navigate to first, or show list
        setSrc(pdfUrls[0]); // Show first PDF
        // Optionally: navigate to a bulk print page
      }

      setSuccess(true);
    } catch (err) {
      setError("PDF error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const count = data?.selected?.length || data?.selection?.length || 0;

  return (
    <AdminPrintAction src={src}>
      <BlockStack gap="base">
        {loading && (
          <Banner tone="info">
            <Text>Processing {count} orders...</Text>
          </Banner>
        )}
        {error && (
          <Banner tone="critical">
            <Text>{error}</Text>
          </Banner>
        )}
        {success && (
          <Banner tone="success">
            <Text>Done! {count} orders processed.</Text>
          </Banner>
        )}
        {tagsAdded && (
          <Banner tone="success">
            <Text>himanshu-tag added!</Text>
          </Banner>
        )}

        <Text fontWeight="bold">Bulk Processing ({count} selected)</Text>

        <Button
          kind="primary"
          onPress={processBulkOrders}
          disabled={loading || count === 0}
        >
          {loading ? "Working..." : `Add Tag & Print (${count})`}
        </Button>

        <Button
          kind="secondary"
          onPress={addHimanshuTags}
          disabled={loading || count === 0}
        >
          Add Tag Only
        </Button>

        {/* Optional: Open first PDF in new tab (allowed) */}
        {src && count === 1 && (
          <Button
            kind="plain"
            onPress={() => navigate(src, { target: "new" })}
          >
            Open in New Tab
          </Button>
        )}
      </BlockStack>
    </AdminPrintAction>
  );
}
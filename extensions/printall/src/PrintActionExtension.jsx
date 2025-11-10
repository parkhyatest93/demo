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
  const { data, navigate } = useApi(TARGET);
  const [src, setSrc] = useState(null); // Re-added for single PDF modal
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [tagsAdded, setTagsAdded] = useState(false);
  const [progress, setProgress] = useState(0); // For bulk progress
  const [downloadUrl, setDownloadUrl] = useState(null); // For ZIP download

  // Add Himanshu Tag to selected orders
  const addHimanshuTags = async () => {
    setLoading(true);
    setError(null);
    setTagsAdded(false);

    try {
      const selectedOrders = data?.selected || data?.selection || [];
      console.log("selectedOrders", selectedOrders);
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

  // Generate bulk packing slips via backend (POST to /api/bulk-packing-slips)
  const generateBulkPackingSlips = async (orderIds) => {
    try {
      const res = await fetch("/bulk-packing-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: orderIds }),
      });

      console.log("Response status:", res.status, res.statusText);
      console.log("Response headers:", Object.fromEntries(res.headers.entries()));
      console.log("Response ok:", res.ok);

      if (!res.ok) {
        // For errors, read as text to avoid json parse error on binary
        const errorText = await res.text();
        throw new Error(`Backend error ${res.status}: ${res.statusText} - ${errorText.substring(0, 500)}`);
      }

      // For success, it's binary ZIP or PDF
      const data = await res.json();

      // const blob = await res.blob();
      console.log("resssss", data);
      const url = data.shopifyUrl;

      setProgress(100);
      return url;
    } catch (err) {
      console.error("Fetch error details:", err);
      throw new Error(`PDF generation failed: ${err.message}`);
    }
  };

  // Main: Add Tag + Bulk PDF Generation
  const processBulkOrders = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setSrc(null);
    setProgress(0);
    setDownloadUrl(null);

    try {
      const selectedOrders = data?.selected || data?.selection || [];
      if (selectedOrders.length === 0) {
        setError("No orders selected");
        return;
      }

      const orderIds = selectedOrders.map(order => order.id);

      // Step 1: Add tag (async, but wait for it)
      await addHimanshuTags();

      // Step 3: Generate bulk PDFs (server-side for 50+)
      setProgress(60);
      const url = await generateBulkPackingSlips(orderIds);

      // For single order, use AdminPrintAction; for bulk, provide download
      if (orderIds.length === 1) {
        setSrc(url);
      } else {
        // Bulk: Set download URL for ZIP
        setDownloadUrl(url);
      }

      setSuccess(true);
    } catch (err) {
      setError("Process error: " + err.message);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const count = data?.selected?.length || data?.selection?.length || 0;

  return (
    <AdminPrintAction src={src || undefined}> {/* Only use src for single PDF, not ZIP */}
      <BlockStack gap="base">
        {loading && (
          <Banner tone="info">
            <BlockStack gap="tight">
              <Text>Processing {count} orders...</Text>

            </BlockStack>
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
          {loading ? "Working..." : `Add Tag & Print Bulk (${count})`}
        </Button>

        <Button
          kind="secondary"
          onPress={addHimanshuTags}
          disabled={loading || count === 0}
        >
          Add Tag Only
        </Button>
        {downloadUrl && (
          <><s-text> {count} Slips Generate Download Link: </s-text><s-link href={downloadUrl}> {downloadUrl}</s-link></>

        )}


        {/* Single: Open in New Tab */}
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
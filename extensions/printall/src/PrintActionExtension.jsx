import {
  reactExtension,
  useApi,
  AdminPrintAction,
  Banner,
  BlockStack,
  Text,
  Button,
} from "@shopify/ui-extensions-react/admin";
import { useEffect, useRef, useState } from "react";

const TARGET = "admin.order-index.selection-print-action.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data, navigate } = useApi(TARGET);
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [tagsAdded, setTagsAdded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const blobUrlRef = useRef(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      try {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      } catch (err) {
        console.warn("Error cleaning blob URL:", err);
      }
    };
  }, []);

  // --- Step 1: Add tag to orders ---
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
            console.error("Tag update error:", result.data.orderUpdate.userErrors);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error("Tag error for order:", order?.name, err);
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

  // --- Step 2: Generate ZIP of packing slips ---
const generateBulkPackingSlips = async (orderIds) => {
  try {
    console.log("Sending order IDs to backend:", orderIds);

    const res = await fetch(
      "https://championships-metric-wrapped-voting.trycloudflare.com/bulk-packing-slips",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: orderIds }),
      }
    );

    if (!res.ok) {
      throw new Error(`Backend error: ${res.statusText}`);
    }

    // ✅ Expecting backend to respond with: { downloadUrl: "https://..." }
    const { downloadUrl } = await res.json();
    if (!downloadUrl) throw new Error("Backend did not return a download URL");

    console.log("✅ Got ZIP download URL:", downloadUrl);
    setDownloadUrl(downloadUrl);

    return downloadUrl;
  } catch (err) {
    console.error("ZIP generation failed:", err);
    throw new Error("Failed to generate ZIP: " + err.message);
  }
};

  // --- Step 3: Trigger browser download safely ---
  const startDownloadFromBlobUrl = (blobUrl) => {
    try {
      if (!blobUrl || blobUrl.startsWith("blob:null")) {
        console.error("Invalid blob URL:", blobUrl);
        alert("Download not available. Please regenerate the ZIP.");
        return;
      }

      // hidden iframe triggers download without <a>
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      // cleanup iframe
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 5000);
    } catch (err) {
      console.error("Failed to start download:", err);
      alert("Download failed to start.");
    }
  };

  // --- Step 4: Combine everything ---
  const processBulkOrders = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setSrc(null);
    setProgress(0);

    try {
      const selectedOrders = data?.selected || data?.selection || [];
      if (!selectedOrders || selectedOrders.length === 0) {
        setError("No orders selected");
        return;
      }

      const orderIds = selectedOrders.map((o) => o.id);
      console.log("Selected order IDs:", orderIds);

      // Add tag first
      await addHimanshuTags();

      // Generate ZIP file
      setProgress(20);
      const blobUrl = await generateBulkPackingSlips(orderIds);
      setProgress(100);

      // Auto-download
      startDownloadFromBlobUrl(blobUrl);

      setSuccess(true);
    } catch (err) {
      console.error("Process error:", err);
      setError("Process error: " + err.message);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const count = data?.selected?.length || data?.selection?.length || 0;

  return (
    <AdminPrintAction src={src || undefined}>
      <BlockStack gap="base">
        {loading && (
          <Banner tone="info">
            <BlockStack gap="tight">
              <Text>Processing {count} orders...</Text>
              <Text>Progress: {Math.round(progress)}%</Text>
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

        {/* Download button when ZIP ready */}
        {downloadUrl && (
            <Button
              kind="plain"
              onPress={() => {
                // open direct HTTPS file in new tab
                window.open(downloadUrl, "_blank");
              }}
            >
              Download ZIP ({count} Slips)
            </Button>
          )}


        {/* Debug info (optional) */}
        {downloadUrl && (
          <Text>
            Debug blob URL: <br />
            {downloadUrl}
          </Text>
        )}
      </BlockStack>
    </AdminPrintAction>
  );
}

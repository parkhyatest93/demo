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
  const [src, setSrc] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [tagsAdded, setTagsAdded] = useState(false);
  const [progress, setProgress] = useState(0); // For bulk progress
  const [downloadUrl, setDownloadUrl] = useState(null); // For ZIP download
  const [fullOrders, setFullOrders] = useState([]); // Full fetched orders for "All"
  const [isFetching, setIsFetching] = useState(false); // Fetch loading

  // UPDATED: Fetch full orders if "All" (optional, fallback partial)
  const fetchFullOrders = async () => {
    if (!data?.selection || isFetching) return;
    const selection = data.selection;
    const partialOrders = data?.selected || [];
    const partialIds = selection.ids || [];
    const count = selection.count || 0;

    console.log('Selection data:', { count, partialIdsLength: partialIds.length, type: selection.type }); // Debug full selection

    // Detect "All": high count but low partial
    if (selection.type === 'all' || (count > partialIds.length && count > 10)) {
      console.log(`All detected (count: ${count}, partial: ${partialIds.length}) – trying full fetch...`);
      setIsFetching(true);
      setError(null); // Clear error for fetch

      try {
        let allOrders = [...partialOrders]; // Start with partial
        let cursor = null;
        const queryFilter = 'status:unfulfilled financial_status:paid'; // Adjust filter if needed (e.g., add created_at:>2025-10-29)

        do {
          const response = await fetch("shopify:admin/api/graphql.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `
                query getBulkOrders($first: Int!, $after: String, $query: String!) {
                  orders(first: $first, after: $after, query: $query) {
                    edges {
                      node {
                        id
                        name
                        tags
                        legacyResourceId
                      }
                    }
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                  }
                }
              `,
              variables: {
                first: 250,
                ...(cursor && { after: cursor }),
                query: queryFilter
              }
            }),
          });

          const result = await response.json();
          console.log('GraphQL response status:', response.status, 'data/errors:', result.errors ? 'ERROR' : 'OK'); // Debug response
          if (result.errors) {
            console.warn('GraphQL errors (fallback to partial):', result.errors);
            break; // Don't throw – fallback
          }

          allOrders = [...allOrders, ...result.data.orders.edges.map(edge => edge.node)];
          cursor = result.data.orders.pageInfo.hasNextPage ? result.data.orders.pageInfo.endCursor : null;
        } while (cursor);

        console.log(`Full fetch complete: ${allOrders.length} orders (target ${count})`);
        setFullOrders(allOrders);
      } catch (err) {
        console.error('Fetch failed (using partial):', err);
        setError(`Full fetch skipped (using partial ${partialOrders.length}): ${err.message}. Add read_orders scope?`);
        setFullOrders(partialOrders); // Fallback no disable
      } finally {
        setIsFetching(false);
      }
    } else {
      // Normal: Use partial
      console.log('Normal selection: using partial', partialOrders.length);
      setFullOrders(partialOrders);
    }
  };

  // Listen to changes
  useEffect(() => {
    fetchFullOrders();
  }, [data?.selection]);

  // UPDATED: Add Tags (batch, use fullOrders)
  const addHimanshuTags = async () => {
    setLoading(true);
    setError(null);
    setTagsAdded(false);

    try {
      const orders = fullOrders.length > 0 ? fullOrders : (data?.selected || []);
      console.log("Tagging orders:", orders.length);
      if (orders.length === 0) {
        setError("No orders");
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const batchSize = 100; // Increased for speed

      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        await Promise.all(batch.map(async (order) => {
          try {
            const currentTags = order.tags || [];
            const updatedTags = [...new Set([...currentTags, "himanshu-tag"])];
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
                variables: { id: order.id, tags: updatedTags },
              }),
            });

            const result = await res.json();
            if (result?.data?.orderUpdate?.userErrors?.length > 0) {
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            console.error("Tag error:", order.name || order.id, err);
            errorCount++;
          }
        }));
        setProgress((i / orders.length) * 30 + 30); // Progress update
      }

      setTagsAdded(true);
      if (errorCount === 0) setSuccess(true);
      else setError(`Tags: ${successCount} OK, ${errorCount} failed`);
    } catch (e) {
      setError("Tag error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Bulk PDF (use full orderIds)
  const generateBulkPackingSlips = async (orderIds) => {
    try {
      const res = await fetch("/bulk-packing-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: orderIds }),
      });

      console.log("Backend response:", res.status, res.ok);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Backend ${res.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await res.json();
      console.log("Backend data:", data);
      const url = data.shopifyUrl;
      setProgress(100);
      return url;
    } catch (err) {
      console.error("PDF error:", err);
      throw new Error(`PDF failed: ${err.message}`);
    }
  };

  // UPDATED: Main process
  const processBulkOrders = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setSrc(null);
    setProgress(0);
    setDownloadUrl(null);

    try {
      const orders = fullOrders.length > 0 ? fullOrders : (data?.selected || []);
      if (orders.length === 0) {
        setError("No orders");
        return;
      }

      const orderIds = orders.map(order => order.id || order.legacyResourceId);
      console.log("Processing IDs:", orderIds.length);

      // Tag
      await addHimanshuTags();

      // PDF
      setProgress(60);
      const url = await generateBulkPackingSlips(orderIds);

      if (orderIds.length === 1) {
        setSrc(url);
      } else {
        setDownloadUrl(url);
        setSrc(url);
      }

      setSuccess(true);
    } catch (err) {
      setError("Process fail: " + err.message);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Count from selection.count (enable on count >0)
  const count = data?.selection?.count || data?.selected?.length || 0;
  const isDisabled = loading || count === 0; // No fetch check – always enable if selected

  return (
    <AdminPrintAction src={src || undefined}>  
      <BlockStack gap="base">
        {(loading || isFetching) && (
          <Banner tone="info">
            <BlockStack gap="tight">
              <Text>Handling {count} orders{isFetching ? ' (fetching...)' : ''}</Text>
              {progress > 0 && <Text>Progress: {progress}%</Text>}
            </BlockStack>
          </Banner>
        )}
        {error && <Banner tone="critical"><Text>{error}</Text></Banner>}
        {success && <Banner tone="success"><Text>Done! {count} processed.</Text></Banner>}
        {tagsAdded && <Banner tone="success"><Text>himanshu-tag added!</Text></Banner>}

        <Text fontWeight="bold">Bulk ({count} selected)</Text>

        <Button
          kind="primary"
          onPress={processBulkOrders}
          disabled={isDisabled}
        >
          {loading ? "Working..." : `Tag & Print (${count})`}
        </Button>

        <Button
          kind="secondary"
          onPress={addHimanshuTags}
          disabled={isDisabled}
        >
          Tag Only
        </Button>

        {downloadUrl && (
          <Button
            kind="plain"
            onPress={() => navigate(downloadUrl, { target: "new" })}
          >
            Download ZIP ({count} slips)
          </Button>
        )}

        {src   && (
          <Button
            kind="plain"
            onPress={() => navigate(src, { target: "new" })}
          >
            Open PDF
          </Button>
        )}
      </BlockStack>
    </AdminPrintAction>
  );
}
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  DataTable,
  Pagination,
  InlineStack,
  Link,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useLoaderData, useSubmit, useActionData, Form } from "react-router-dom";
import { useEffect, useState } from "react";
import { ViewIcon, EditIcon, DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || null;

  let variables = { first: 10 };
  if (direction === "next" && cursor) {
    variables = { first: 10, after: cursor };
  } else if (direction === "prev" && cursor) {
    variables = { last: 10, before: cursor };
  }

  const response = await admin.graphql(
    `#graphql
      query PageList($first: Int, $last: Int, $after: String, $before: String) {
        pages(first: $first, last: $last, after: $after, before: $before) {
          pageInfo {
            hasPreviousPage
            hasNextPage
            startCursor
            endCursor
          }
          edges {
            cursor
            node {
              id
              title
              handle
            }
          }
        }
      }
    `,
    { variables }
  );

  const jsonData = await response.json();
  const pages = jsonData.data.pages.edges;
  const pageInfo = jsonData.data.pages.pageInfo;

  return { pages, pageInfo, session };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const pageId = formData.get("pageId");

  const response = await admin.graphql(
    `#graphql
      mutation DeletePage($id: ID!) {
        pageDelete(id: $id) {
          deletedPageId
          userErrors {
            code
            field
            message
          }
        }
      }
    `,
    { variables: { id: pageId } }
  );
  const data = await response.json();
  return { deleted: data };
};

export default function AllCreatedPages() {
  const { pages, pageInfo, session } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const [pagesData, setPagesData] = useState(pages);
  const [pageInfoData, setPageInfoData] = useState(pageInfo);

  useEffect(() => {
    setPagesData(pages);
    setPageInfoData(pageInfo);
  }, [pages, pageInfo]);

  useEffect(() => {
    if (actionData?.deleted) {
      setPagesData((prev) =>
        prev.filter((page) => page.node.id !== actionData.deleted.data.pageDelete.deletedPageId)
      );
    }
  }, [actionData]);

  const deletePageFun = (pageId) => {
    const formData = new FormData();
    formData.append("pageId", pageId);
    submit(formData, { method: "post" });
  };

  const nextPagesData = () => {
    const searchParams = new URLSearchParams({
      cursor: pageInfoData?.endCursor || "",
      direction: "next",
    });
    submit(searchParams, { method: "get" });
  };

  const prevPagesData = () => {
    const searchParams = new URLSearchParams({
      cursor: pageInfoData?.startCursor || "",
      direction: "prev",
    });
    submit(searchParams, { method: "get" });
  };

  const rows = pagesData.map((page) => [
    page.node.title,
    page.node.handle,
    page.node.id,
    <InlineStack key={page.node.id} gap="200">
      <Link url={`https://${session.shop}/pages/${page.node.handle}`} target="_blank">
        <Button icon={ViewIcon} />
      </Link>
    <Link url={`https://${session.shop}/apps/transform-5/app/updatePage/${page.node.id.split('/')[4]}`} >
        <Button icon={EditIcon} />
      </Link>

      <s-link href={`/app/updatePage/${page.node.id.split('/')[4]}`} >fufilling orders</s-link>
      <Button onClick={() => deletePageFun(page.node.id)} icon={DeleteIcon} />
    </InlineStack>,
  ]);

  return (
    <Page title="All Pages">
      <TitleBar title="All Pages" />
      <Layout>
        <Layout.Section>
          <div style={{ textAlign: "end", marginBottom: "20px" }}>
            <Link url="/app/createPage" removeUnderline>
              <Button variant="primary">Create new store Page</Button>
            </Link>
          </div>
          <Card>
            <Text variant="headingLg" as="h2" alignment="start" padding="400">
              Pages List
            </Text>
            <DataTable
              columnContentTypes={["text", "text", "text", "text"]}
              headings={["Title", "Handle", "Id", "Action"]}
              rows={rows}
              verticalAlign="middle"
            />
            <InlineStack align="center" gap="400" blockAlign="center">
              <Button
                onClick={prevPagesData}
                disabled={!pageInfoData?.hasPreviousPage}
                variant="secondary"
              >
                ⬅ Previous
              </Button>
              <Button
                onClick={nextPagesData}
                disabled={!pageInfoData?.hasNextPage}
                variant="secondary"
              >
                Next ➡
              </Button>
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
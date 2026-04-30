import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getProductsWithNotes {
      products(first: 50, sortKey: TITLE) {
        edges {
          node {
            id
            title
            handle
            status
            featuredImage {
              url
              altText
            }
            notesEnabled: metafield(namespace: "$app", key: "notes_enabled") {
              id
              value
            }
            notesLabel: metafield(namespace: "$app", key: "notes_label") {
              id
              value
            }
            notesPrice: metafield(namespace: "$app", key: "notes_price") {
              id
              value
            }
          }
        }
      }
    }`
  );

  const { data } = await response.json();
  const products = data.products.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    image: node.featuredImage?.url || null,
    imageAlt: node.featuredImage?.altText || node.title,
    notesEnabled: node.notesEnabled?.value === "true",
    notesLabel: node.notesLabel?.value || "",
    notesPrice: node.notesPrice?.value || "0",
  }));

  return { products };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const productId = formData.get("productId");
  const notesEnabled = formData.get("notesEnabled") === "true";
  const notesLabel = formData.get("notesLabel") || "Add a note";
  const notesPrice = formData.get("notesPrice") || "0";

  const response = await admin.graphql(
    `#graphql
    mutation setProductNotes($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
            namespace: "$app",
            key: "notes_enabled",
            type: "boolean",
            value: String(notesEnabled),
          },
          {
            ownerId: productId,
            namespace: "$app",
            key: "notes_label",
            type: "single_line_text_field",
            value: notesLabel,
          },
          {
            ownerId: productId,
            namespace: "$app",
            key: "notes_price",
            type: "number_decimal",
            value: notesPrice,
          },
        ],
      },
    }
  );

  const result = await response.json();
  const errors = result.data?.metafieldsSet?.userErrors || [];

  return {
    success: errors.length === 0,
    productId,
    errors,
  };
};

export default function ProductNotesPage() {
  const { products } = useLoaderData();
  const shopify = useAppBridge();
  const fetcher = useFetcher();

  const [productStates, setProductStates] = useState(() => {
    const states = {};
    products.forEach((p) => {
      states[p.id] = {
        notesEnabled: p.notesEnabled,
        notesLabel: p.notesLabel || "Add a note",
        notesPrice: p.notesPrice || "0",
        dirty: false,
      };
    });
    return states;
  });

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Product notes updated!");
      const pid = fetcher.data.productId;
      setProductStates((prev) => ({
        ...prev,
        [pid]: { ...prev[pid], dirty: false },
      }));
    } else if (fetcher.data && !fetcher.data.success) {
      shopify.toast.show("Error saving notes settings", { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleToggle = (productId) => {
    setProductStates((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        notesEnabled: !prev[productId].notesEnabled,
        dirty: true,
      },
    }));
  };

  const handleLabelChange = (productId, value) => {
    setProductStates((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        notesLabel: value,
        dirty: true,
      },
    }));
  };

  const handlePriceChange = (productId, value) => {
    // Only allow valid decimal numbers
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setProductStates((prev) => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          notesPrice: value,
          dirty: true,
        },
      }));
    }
  };

  const handleSave = (productId) => {
    const state = productStates[productId];
    fetcher.submit(
      {
        productId,
        notesEnabled: String(state.notesEnabled),
        notesLabel: state.notesLabel,
        notesPrice: state.notesPrice || "0",
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Product Notes">
      <s-section heading="Add notes to your products">
        <s-paragraph>
          Enable a customer-facing notes field on any product. When a customer
          adds a note, it travels with the item through <strong>cart</strong>,{" "}
          <strong>checkout</strong>, and appears on the{" "}
          <strong>order details</strong>. You can also charge an extra fee for
          notes (e.g., personalization, gift wrapping).
        </s-paragraph>
      </s-section>

      {products.length === 0 ? (
        <s-section heading="No products yet">
          <s-paragraph>
            Create some products in your Shopify admin first, then come back
            here to enable notes on them.
          </s-paragraph>
        </s-section>
      ) : (
        products.map((product) => {
          const state = productStates[product.id] || {
            notesEnabled: false,
            notesLabel: "Add a note",
            notesPrice: "0",
            dirty: false,
          };

          return (
            <s-section key={product.id}>
              <s-stack direction="block" gap="base">
                {/* Product info row */}
                <s-stack direction="inline" gap="base">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.imageAlt}
                      style={{
                        width: "52px",
                        height: "52px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid #e3e3e3",
                      }}
                    />
                  )}
                  <s-stack direction="block" gap="tight">
                    <s-heading>{product.title}</s-heading>
                    <s-text>
                      {state.notesEnabled
                        ? `✅ Notes enabled${
                            parseFloat(state.notesPrice) > 0
                              ? ` (+$${parseFloat(state.notesPrice).toFixed(2)})`
                              : " (free)"
                          }`
                        : "⬜ Notes disabled"}
                    </s-text>
                  </s-stack>
                </s-stack>

                {/* Toggle button */}
                <s-stack direction="inline" gap="base">
                  <s-button
                    onClick={() => handleToggle(product.id)}
                    variant={state.notesEnabled ? "tertiary" : "primary"}
                  >
                    {state.notesEnabled ? "Disable Notes" : "Enable Notes"}
                  </s-button>
                </s-stack>

                {/* Settings — shown when notes are enabled */}
                {state.notesEnabled && (
                  <s-stack direction="block" gap="base">
                    <s-text-field
                      label="Notes field label"
                      value={state.notesLabel}
                      onChange={(e) =>
                        handleLabelChange(product.id, e.currentTarget.value)
                      }
                      details='Customers see this label on the product page (e.g. "Gift message", "Personalization instructions")'
                    />

                    <s-text-field
                      label="Note price (surcharge)"
                      value={state.notesPrice}
                      onChange={(e) =>
                        handlePriceChange(product.id, e.currentTarget.value)
                      }
                      details="Extra charge added to the product price when a note is included. Set to 0 for free notes. Uses your store's currency."
                    />
                  </s-stack>
                )}

                {/* Save button — shown when there are unsaved changes */}
                {state.dirty && (
                  <s-button
                    onClick={() => handleSave(product.id)}
                    variant="primary"
                    {...(isSaving ? { loading: true } : {})}
                  >
                    Save Changes
                  </s-button>
                )}
              </s-stack>
            </s-section>
          );
        })
      )}

      {/* Sidebar */}
      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>
            Enable notes on your desired products using the toggles
          </s-list-item>
          <s-list-item>
            Customize the label customers see (e.g. "Gift message")
          </s-list-item>
          <s-list-item>
            Set a price surcharge for notes (or leave at 0 for free)
          </s-list-item>
          <s-list-item>
            Add the <strong>Product Notes</strong> app block to your theme's
            product page via Theme Editor
          </s-list-item>
          <s-list-item>
            The Cart Transform function automatically adjusts prices in
            cart & checkout
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Price adjustment">
        <s-paragraph>
          When a note price is set, the <strong>Notes Price Adjustment</strong>{" "}
          Cart Transform function automatically adds the surcharge to the
          product price in cart and checkout. Deploy the app to activate it.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// ── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { shopDomain: session.shop };
};

// ── Error boundary ───────────────────────────────────────────────────────────

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => boundary.headers(headersArgs);

// ── Component (Phase 0 – TODO) ───────────────────────────────────────────────

export default function InContextEditor() {
  const { shopDomain } = useLoaderData();

  return (
    <div style={{ padding: "2rem" }}>
      <h2>In-Context Visual Editor</h2>
      <p>Shop: {shopDomain}</p>
      <p style={{ color: "#666" }}>Phase 0 implementation pending.</p>
    </div>
  );
}

import { authenticate } from "../shopify.server";
import { SHOPIFYQL_MUTATION, parseTableData } from "../utils/shopifyql-queries";

/**
 * POST /api/analytics
 * Body (FormData): query — a ShopifyQL query string
 * Returns: { rows: object[], columns: object[] }
 */
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const query = formData.get("query");

  if (!query || typeof query !== "string") {
    return Response.json(
      { error: "query parameter is required" },
      { status: 400 },
    );
  }

  const response = await admin.graphql(SHOPIFYQL_MUTATION, {
    variables: { query },
  });

  const json = await response.json();

  if (json.errors) {
    return Response.json({ error: json.errors }, { status: 400 });
  }

  const parseErrors = json.data?.shopifyqlQuery?.parseErrors;
  if (parseErrors?.length > 0) {
    return Response.json(
      { error: parseErrors.map((e) => e.message).join("; ") },
      { status: 400 },
    );
  }

  const { rows, columns } = parseTableData(json.data);
  return Response.json({ rows, columns });
};

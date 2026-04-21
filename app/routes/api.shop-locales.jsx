import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query ShopLocales {
      shopLocales {
        locale
        primary
        published
      }
    }`
  );

  const { data } = await response.json();

  return Response.json({ locales: data.shopLocales });
};

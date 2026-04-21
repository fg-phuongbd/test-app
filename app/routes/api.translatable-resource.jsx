import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const resourceId = url.searchParams.get("resourceId");
  const locale = url.searchParams.get("locale");

  if (!resourceId || !locale) {
    return Response.json(
      { error: "resourceId and locale are required" },
      { status: 400 }
    );
  }

  const response = await admin.graphql(
    `#graphql
    query TranslatableResource($resourceId: ID!, $locale: String!) {
      translatableResource(resourceId: $resourceId) {
        resourceId
        translatableContent {
          key
          value
          digest
          locale
        }
        translations(locale: $locale) {
          key
          value
          locale
          outdated
        }
      }
    }`,
    { variables: { resourceId, locale } }
  );

  const { data, errors } = await response.json();

  if (errors) {
    return Response.json({ error: errors[0].message }, { status: 500 });
  }

  return Response.json({ resource: data.translatableResource });
};

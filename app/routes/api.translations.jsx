import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.admin(request);

  const body = await request.json();
  const { resourceId, locale, translations } = body;

  if (!resourceId || !locale || !Array.isArray(translations)) {
    return Response.json(
      { error: "resourceId, locale, and translations are required" },
      { status: 400 }
    );
  }

  const translationInputs = translations.map(({ key, value, digest }) => ({
    locale,
    key,
    value,
    translatableContentDigest: digest,
  }));

  const response = await admin.graphql(
    `#graphql
    mutation TranslationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
      translationsRegister(resourceId: $resourceId, translations: $translations) {
        translations {
          key
          value
          locale
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { variables: { resourceId, translations: translationInputs } }
  );

  const { data, errors } = await response.json();

  if (errors) {
    return Response.json({ error: errors[0].message }, { status: 500 });
  }

  const { userErrors, translations: saved } =
    data.translationsRegister;

  if (userErrors.length > 0) {
    return Response.json({ errors: userErrors }, { status: 422 });
  }

  return Response.json({ success: true, translations: saved });
};

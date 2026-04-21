import crypto from "crypto";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");
  const shop = url.searchParams.get("shop");
  const token = url.searchParams.get("token");
  const ts = url.searchParams.get("ts");
  const locale = url.searchParams.get("locale");

  if (!targetUrl || !shop || !token || !ts) {
    return new Response("Missing parameters", { status: 400 });
  }

  // Validate timestamp (max 2 hours)
  const timestamp = parseInt(ts, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 7_200_000) {
    return new Response("Token expired", { status: 403 });
  }

  // Validate HMAC (shop + timestamp signed with API secret)
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const expectedToken = crypto
    .createHmac("sha256", secret)
    .update(`${shop}:${ts}`)
    .digest("hex");

  let tokensMatch = false;
  try {
    tokensMatch = crypto.timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expectedToken, "hex")
    );
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  if (!tokensMatch) {
    return new Response("Forbidden", { status: 403 });
  }

  // Validate target URL domain matches shop (SSRF prevention)
  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (parsedTarget.hostname !== shop) {
    return new Response("Domain mismatch", { status: 403 });
  }

  if (parsedTarget.protocol !== "https:") {
    return new Response("HTTPS only", { status: 400 });
  }

  let html;
  try {
    const proxyResponse = await fetch(parsedTarget.toString(), {
      headers: locale ? { "Accept-Language": locale } : {},
    });

    if (!proxyResponse.ok) {
      return new Response(
        `Upstream returned ${proxyResponse.status} for URL: ${parsedTarget.toString()}`,
        { status: 502 }
      );
    }

    html = await proxyResponse.text();
  } catch {
    return new Response("Failed to fetch storefront page", { status: 502 });
  }

  // Inject <base> tag so relative assets resolve to the shop domain
  const baseTag = `<base href="https://${shop}/">`;
  html = html.replace(/(<head[^>]*>)/i, `$1${baseTag}`);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=30",
    },
  });
};

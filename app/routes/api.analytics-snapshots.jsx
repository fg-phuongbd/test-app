import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * GET /api/analytics-snapshots?type=revenue_trend
 * Returns the most recent snapshots for this shop (optionally filtered by type).
 */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  const where = { shop: session.shop };
  if (type) where.type = type;

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return Response.json({ snapshots });
};

/**
 * POST /api/analytics-snapshots
 * Body (JSON): { type: string, data: object }
 * Saves a new analytics snapshot for this shop.
 */
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const body = await request.json();
  const { type, data } = body;

  if (!type || !data) {
    return Response.json(
      { error: "type and data are required" },
      { status: 400 },
    );
  }

  const snapshot = await prisma.analyticsSnapshot.create({
    data: {
      id: crypto.randomUUID(),
      shop: session.shop,
      type,
      data: JSON.stringify(data),
    },
  });

  return Response.json({ snapshot });
};

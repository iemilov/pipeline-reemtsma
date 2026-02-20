import { getAllTags } from '../lib/db.js';

// GET /api/tags
export async function onRequestGet(context) {
  const tags = await getAllTags(context.env.DB);
  return Response.json(tags);
}

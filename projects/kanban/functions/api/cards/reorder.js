import { reorderCards } from '../../lib/db.js';

// PUT /api/cards/reorder
export async function onRequestPut(context) {
  const { columns } = await context.request.json();
  if (!columns || typeof columns !== 'object') {
    return Response.json({ error: 'columns object is required' }, { status: 400 });
  }
  await reorderCards(context.env.DB, columns);
  return Response.json({ ok: true });
}

import { updateCard, deleteCard } from '../../lib/db.js';

// PATCH /api/cards/:id
export async function onRequestPatch(context) {
  const { title, description, priority, tags, subtasks } = await context.request.json();
  const card = await updateCard(context.env.DB, context.params.id, {
    title: title?.trim(),
    description: description?.trim(),
    priority,
    tags,
    subtasks,
  });
  if (!card) return Response.json({ error: 'Card not found' }, { status: 404 });
  return Response.json(card);
}

// DELETE /api/cards/:id
export async function onRequestDelete(context) {
  const deleted = await deleteCard(context.env.DB, context.params.id);
  if (!deleted) return Response.json({ error: 'Card not found' }, { status: 404 });
  return new Response(null, { status: 204 });
}

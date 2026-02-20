import { getAllCards, createCard } from '../lib/db.js';

// GET /api/cards
export async function onRequestGet(context) {
  const columns = await getAllCards(context.env.DB);
  return Response.json(columns);
}

// POST /api/cards
export async function onRequestPost(context) {
  const { id, title, description, columnId, priority, tags, subtasks } = await context.request.json();
  if (!id || !title?.trim()) {
    return Response.json({ error: 'id and title are required' }, { status: 400 });
  }
  const card = await createCard(
    context.env.DB, id, title.trim(), description?.trim() || '', columnId || 'backlog', priority, tags, subtasks
  );
  return Response.json(card, { status: 201 });
}

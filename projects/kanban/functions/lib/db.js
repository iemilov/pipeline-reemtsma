const VALID_COLUMNS = ['backlog', 'todo', 'inprogress', 'done'];

// --- Helpers ---

async function getOrCreateTag(db, name) {
  const existing = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(name).first();
  if (existing) return existing.id;
  const result = await db.prepare('INSERT INTO tags (name) VALUES (?)').bind(name).run();
  return result.meta.last_row_id;
}

async function getTagsForCard(db, cardId) {
  const { results } = await db.prepare(
    'SELECT t.name FROM tags t JOIN card_tags ct ON t.id = ct.tag_id WHERE ct.card_id = ? ORDER BY t.name'
  ).bind(cardId).all();
  return results.map((r) => r.name);
}

async function setCardTags(db, cardId, tagNames) {
  const stmts = [db.prepare('DELETE FROM card_tags WHERE card_id = ?').bind(cardId)];
  if (tagNames && tagNames.length > 0) {
    for (const name of tagNames) {
      const tagId = await getOrCreateTag(db, name.trim());
      stmts.push(
        db.prepare('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)').bind(cardId, tagId)
      );
    }
  }
  await db.batch(stmts);
}

async function getSubtasksForCard(db, cardId) {
  const { results } = await db.prepare(
    'SELECT id, title, done, position FROM subtasks WHERE card_id = ? ORDER BY position ASC'
  ).bind(cardId).all();
  return results.map((r) => ({ id: r.id, title: r.title, done: !!r.done }));
}

async function setCardSubtasks(db, cardId, subtasks) {
  const stmts = [db.prepare('DELETE FROM subtasks WHERE card_id = ?').bind(cardId)];
  if (subtasks && subtasks.length > 0) {
    for (let i = 0; i < subtasks.length; i++) {
      stmts.push(
        db.prepare('INSERT INTO subtasks (card_id, title, done, position) VALUES (?, ?, ?, ?)')
          .bind(cardId, subtasks[i].title, subtasks[i].done ? 1 : 0, i)
      );
    }
  }
  await db.batch(stmts);
}

// --- Exported queries ---

export async function getAllTags(db) {
  const { results } = await db.prepare('SELECT name FROM tags ORDER BY name').all();
  return results.map((r) => r.name);
}

export async function getAllCards(db) {
  const { results: rows } = await db.prepare(
    'SELECT id, title, description, column_id, position, created_at, priority FROM cards ORDER BY position ASC'
  ).all();

  const grouped = { backlog: [], todo: [], inprogress: [], done: [] };
  for (const row of rows) {
    const col = grouped[row.column_id];
    if (col) {
      col.push({
        id: row.id,
        title: row.title,
        description: row.description,
        createdAt: row.created_at,
        priority: row.priority || 'medium',
        tags: await getTagsForCard(db, row.id),
        subtasks: await getSubtasksForCard(db, row.id),
      });
    }
  }
  return grouped;
}

export async function createCard(db, id, title, description, columnId, priority, tags, subtasks) {
  if (!VALID_COLUMNS.includes(columnId)) columnId = 'backlog';
  const maxPos = await db.prepare(
    'SELECT COALESCE(MAX(position), -1) as max_pos FROM cards WHERE column_id = ?'
  ).bind(columnId).first();
  const position = (maxPos?.max_pos ?? -1) + 1;
  const createdAt = Date.now();

  const stmts = [
    db.prepare(
      'INSERT INTO cards (id, title, description, column_id, position, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, title, description || '', columnId, position, createdAt, priority || 'medium'),
  ];
  await db.batch(stmts);

  if (tags && tags.length > 0) await setCardTags(db, id, tags);
  if (subtasks && subtasks.length > 0) await setCardSubtasks(db, id, subtasks);

  return { id, title, description: description || '', createdAt, priority: priority || 'medium', tags: tags || [], subtasks: subtasks || [] };
}

export async function updateCard(db, id, fields) {
  const card = await db.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first();
  if (!card) return null;

  const title = fields.title !== undefined ? fields.title : card.title;
  const description = fields.description !== undefined ? fields.description : card.description;
  const priority = fields.priority !== undefined ? fields.priority : card.priority;

  await db.prepare('UPDATE cards SET title = ?, description = ?, priority = ? WHERE id = ?')
    .bind(title, description, priority, id).run();

  if (fields.tags !== undefined) await setCardTags(db, id, fields.tags);
  if (fields.subtasks !== undefined) await setCardSubtasks(db, id, fields.subtasks);

  return {
    id, title, description, createdAt: card.created_at, priority,
    tags: await getTagsForCard(db, id),
    subtasks: await getSubtasksForCard(db, id),
  };
}

export async function deleteCard(db, id) {
  const result = await db.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

export async function reorderCards(db, columns) {
  const stmts = [];
  for (const [columnId, cardIds] of Object.entries(columns)) {
    if (!VALID_COLUMNS.includes(columnId)) continue;
    for (let i = 0; i < cardIds.length; i++) {
      stmts.push(
        db.prepare('UPDATE cards SET column_id = ?, position = ? WHERE id = ?').bind(columnId, i, cardIds[i])
      );
    }
  }
  if (stmts.length > 0) await db.batch(stmts);
}

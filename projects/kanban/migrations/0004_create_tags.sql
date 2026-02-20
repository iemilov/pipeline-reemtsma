CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE card_tags (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

-- Migrate existing category data into the new tables
INSERT OR IGNORE INTO tags (name)
  SELECT DISTINCT category FROM cards WHERE category != '';

INSERT OR IGNORE INTO card_tags (card_id, tag_id)
  SELECT c.id, t.id FROM cards c JOIN tags t ON c.category = t.name
  WHERE c.category != '';

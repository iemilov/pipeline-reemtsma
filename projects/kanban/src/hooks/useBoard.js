import { useState, useEffect, useCallback, useRef } from 'react';

const INITIAL_STATE = {
  backlog: [],
  todo: [],
  inprogress: [],
  done: [],
};

function generateId() {
  return 'card-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`API error: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function useBoard() {
  const [columns, setColumns] = useState(INITIAL_STATE);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const reorderTimeout = useRef(null);

  // Fetch all cards and tags on mount
  useEffect(() => {
    Promise.all([api('/cards'), api('/tags')])
      .then(([cardData, tagData]) => {
        setColumns(cardData);
        setAllTags(tagData);
      })
      .catch((err) => console.error('Failed to fetch data:', err))
      .finally(() => setLoading(false));
  }, []);

  const refreshTags = useCallback(() => {
    api('/tags').then(setAllTags).catch(() => {});
  }, []);

  // Add a new card
  const addCard = useCallback((columnId, cardData) => {
    const id = generateId();
    const newCard = { id, ...cardData, createdAt: Date.now() };

    // Optimistic update
    setColumns((prev) => ({
      ...prev,
      [columnId]: [...prev[columnId], newCard],
    }));

    api('/cards', {
      method: 'POST',
      body: JSON.stringify({ id, title: cardData.title, description: cardData.description, columnId, priority: cardData.priority, tags: cardData.tags, subtasks: cardData.subtasks }),
    }).then(() => refreshTags())
      .catch((err) => console.error('Failed to create card:', err));
  }, [refreshTags]);

  // Update an existing card
  const updateCard = useCallback((columnId, cardData) => {
    // Optimistic update
    setColumns((prev) => ({
      ...prev,
      [columnId]: prev[columnId].map((c) =>
        c.id === cardData.id ? { ...c, ...cardData } : c
      ),
    }));

    api(`/cards/${cardData.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: cardData.title, description: cardData.description, priority: cardData.priority, tags: cardData.tags, subtasks: cardData.subtasks }),
    }).then(() => refreshTags())
      .catch((err) => console.error('Failed to update card:', err));
  }, [refreshTags]);

  // Delete a card
  const deleteCard = useCallback((columnId, cardId) => {
    // Optimistic update
    setColumns((prev) => ({
      ...prev,
      [columnId]: prev[columnId].filter((c) => c.id !== cardId),
    }));

    api(`/cards/${cardId}`, { method: 'DELETE' }).catch((err) =>
      console.error('Failed to delete card:', err)
    );
  }, []);

  // Persist column ordering (debounced — called after drag operations)
  const persistOrder = useCallback((newColumns) => {
    if (reorderTimeout.current) clearTimeout(reorderTimeout.current);
    reorderTimeout.current = setTimeout(() => {
      const order = {};
      for (const [colId, cards] of Object.entries(newColumns)) {
        order[colId] = cards.map((c) => c.id);
      }
      api('/cards/reorder', {
        method: 'PUT',
        body: JSON.stringify({ columns: order }),
      }).catch((err) => console.error('Failed to reorder:', err));
    }, 300);
  }, []);

  // Set columns with automatic order persistence
  const setColumnsAndPersist = useCallback(
    (updater) => {
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        persistOrder(next);
        return next;
      });
    },
    [persistOrder],
  );

  return { columns, setColumns: setColumnsAndPersist, loading, allTags, addCard, updateCard, deleteCard };
}

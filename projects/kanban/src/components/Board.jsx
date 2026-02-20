import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useBoard } from '../hooks/useBoard';
import Column from './Column';
import Card from './Card';
import CardModal from './CardModal';
import './Board.css';

const COLUMNS = [
  { id: 'backlog', title: 'Backlog', color: '#9ca3af' },
  { id: 'todo', title: 'To Do', color: '#244582' },
  { id: 'inprogress', title: 'In Progress', color: '#3BDE83' },
  { id: 'done', title: 'Done', color: '#22c55e' },
];

// Pointer-first collision detection: use actual pointer position to find the
// target column, falling back to closest-center for edge cases (e.g. gap).
function collisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCenter(args);
}

export default function Board() {
  const { columns, setColumns, loading, allTags, addCard, updateCard, deleteCard } = useBoard();
  const [activeCard, setActiveCard] = useState(null);
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: 'add',
    columnId: null,
    card: null,
  });

  // Snapshot for drag cancellation
  const columnsSnapshot = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Find which column a card belongs to
  const findColumn = useCallback(
    (cardId) => {
      for (const colId of Object.keys(columns)) {
        if (columns[colId].some((c) => c.id === cardId)) {
          return colId;
        }
      }
      return null;
    },
    [columns],
  );

  // --- Drag handlers ---
  const handleDragStart = useCallback(
    (event) => {
      const { active } = event;
      const colId = findColumn(active.id);
      if (!colId) return;
      const card = columns[colId].find((c) => c.id === active.id);
      setActiveCard(card);
      columnsSnapshot.current = columns;
    },
    [columns, findColumn],
  );

  const handleDragOver = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over) return;

      setColumns((prev) => {
        // Find columns using prev state to avoid stale closure issues
        let activeColId = null;
        let overColId = null;
        for (const colId of Object.keys(prev)) {
          if (prev[colId].some((c) => c.id === active.id)) activeColId = colId;
          if (prev[colId].some((c) => c.id === over.id)) overColId = colId;
        }
        if (!overColId) {
          overColId = COLUMNS.find((c) => c.id === over.id)?.id;
        }
        if (!activeColId || !overColId || activeColId === overColId) return prev;

        const activeItems = [...prev[activeColId]];
        const overItems = [...prev[overColId]];
        const activeIndex = activeItems.findIndex((c) => c.id === active.id);
        if (activeIndex === -1) return prev;
        const overIndex = overItems.findIndex((c) => c.id === over.id);

        const [movedCard] = activeItems.splice(activeIndex, 1);
        const insertIndex = overIndex >= 0 ? overIndex : overItems.length;
        overItems.splice(insertIndex, 0, movedCard);

        return { ...prev, [activeColId]: activeItems, [overColId]: overItems };
      });
    },
    [setColumns],
  );

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveCard(null);
      columnsSnapshot.current = null;

      if (!over) return;

      setColumns((prev) => {
        // Find columns using prev state to avoid stale closure issues
        let activeColId = null;
        let overColId = null;
        for (const colId of Object.keys(prev)) {
          if (prev[colId].some((c) => c.id === active.id)) activeColId = colId;
          if (prev[colId].some((c) => c.id === over.id)) overColId = colId;
        }
        if (!overColId) {
          overColId = COLUMNS.find((c) => c.id === over.id)?.id;
        }
        if (!activeColId || !overColId) return prev;

        if (activeColId === overColId) {
          // Same column reorder
          if (active.id === over.id) return prev;
          const items = [...prev[activeColId]];
          const oldIndex = items.findIndex((c) => c.id === active.id);
          const newIndex = items.findIndex((c) => c.id === over.id);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return { ...prev, [activeColId]: arrayMove(items, oldIndex, newIndex) };
        } else {
          // Cross-column move (in case handleDragOver didn't fire)
          const activeItems = [...prev[activeColId]];
          const overItems = [...prev[overColId]];
          const activeIndex = activeItems.findIndex((c) => c.id === active.id);
          if (activeIndex === -1) return prev;
          const overIndex = overItems.findIndex((c) => c.id === over.id);
          const [movedCard] = activeItems.splice(activeIndex, 1);
          const insertIndex = overIndex >= 0 ? overIndex : overItems.length;
          overItems.splice(insertIndex, 0, movedCard);
          return { ...prev, [activeColId]: activeItems, [overColId]: overItems };
        }
      });
    },
    [setColumns],
  );

  const handleDragCancel = useCallback(() => {
    setActiveCard(null);
    if (columnsSnapshot.current) {
      setColumns(columnsSnapshot.current);
      columnsSnapshot.current = null;
    }
  }, [setColumns]);

  // --- Card CRUD ---
  const openAddModal = useCallback((columnId) => {
    setModalState({ isOpen: true, mode: 'add', columnId, card: null });
  }, []);

  const openEditModal = useCallback((columnId, card) => {
    setModalState({ isOpen: true, mode: 'edit', columnId, card });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ isOpen: false, mode: 'add', columnId: null, card: null });
  }, []);

  const saveCard = useCallback(
    (columnId, cardData) => {
      if (cardData.id) {
        updateCard(columnId, cardData);
      } else {
        addCard(columnId, cardData);
      }
      closeModal();
    },
    [addCard, updateCard, closeModal],
  );

  const handleDeleteCard = useCallback(
    (columnId, cardId) => {
      deleteCard(columnId, cardId);
      closeModal();
    },
    [deleteCard, closeModal],
  );

  if (loading) {
    return <div className="board-loading">Loading...</div>;
  }

  return (
    <div className="board">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            cards={columns[col.id] || []}
            onAddCard={() => openAddModal(col.id)}
            onEditCard={(card) => openEditModal(col.id, card)}
          />
        ))}
        <DragOverlay dropAnimation={null}>
          {activeCard ? <Card card={activeCard} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
      <CardModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        columnId={modalState.columnId}
        card={modalState.card}
        allTags={allTags}
        onSave={saveCard}
        onDelete={handleDeleteCard}
        onClose={closeModal}
      />
    </div>
  );
}

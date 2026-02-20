import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';
import './Column.css';

export default function Column({ id, title, color, cards, onAddCard, onEditCard }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const cardIds = cards.map((c) => c.id);

  return (
    <div className={`column ${isOver ? 'column--over' : ''}`}>
      <div className="column-header">
        <div className="column-header-left">
          <span className="column-dot" style={{ background: color }} />
          <h2 className="column-title">{title}</h2>
          <span className="column-count">{cards.length}</span>
        </div>
        <button className="column-add-btn" onClick={onAddCard} title="Add task">
          +
        </button>
      </div>
      <div className="column-cards" ref={setNodeRef}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card key={card.id} card={card} onClick={() => onEditCard(card)} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="column-empty">
            <span>No tasks</span>
          </div>
        )}
      </div>
    </div>
  );
}

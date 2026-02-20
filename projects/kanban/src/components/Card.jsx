import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './Card.css';

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

export default function Card({ card, onClick, isOverlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: isOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tags = card.tags || [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card ${isDragging ? 'card--dragging' : ''} ${isOverlay ? 'card--overlay' : ''}`}
      onClick={!isDragging ? onClick : undefined}
      {...attributes}
      {...listeners}
    >
      {(tags.length > 0 || (card.priority && card.priority !== 'medium')) && (
        <div className="card-tags">
          {tags.map((tag) => (
            <span key={tag} className="card-tag card-tag--category">{tag}</span>
          ))}
          {card.priority && card.priority !== 'medium' && (
            <span
              className="card-tag card-tag--priority"
              style={{ background: PRIORITY_COLORS[card.priority] || PRIORITY_COLORS.medium }}
            >
              {card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
            </span>
          )}
        </div>
      )}
      <p className="card-title">{card.title}</p>
      {card.description && (
        <p className="card-description">{card.description}</p>
      )}
      {card.subtasks && card.subtasks.length > 0 && (
        <div className="card-subtasks">
          <span className="card-subtasks-icon">&#9745;</span>
          <span className="card-subtasks-count">
            {card.subtasks.filter((st) => st.done).length}/{card.subtasks.length}
          </span>
        </div>
      )}
    </div>
  );
}

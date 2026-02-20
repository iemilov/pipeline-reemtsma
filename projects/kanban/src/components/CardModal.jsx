import { useState, useEffect, useRef } from 'react';
import './CardModal.css';

export default function CardModal({ isOpen, mode, columnId, card, allTags, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(card?.title || '');
      setDescription(card?.description || '');
      setPriority(card?.priority || 'medium');
      setTags(card?.tags || []);
      setNewTag('');
      setSubtasks(card?.subtasks || []);
      setNewSubtask('');
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen, card]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleTag = (tagName) => {
    setTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const addNewTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setNewTag('');
  };

  const handleNewTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewTag();
    }
  };

  const removeTag = (tagName) => {
    setTags((prev) => prev.filter((t) => t !== tagName));
  };

  const addSubtask = () => {
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [...prev, { title: trimmed, done: false }]);
    setNewSubtask('');
  };

  const toggleSubtask = (index) => {
    setSubtasks((prev) =>
      prev.map((st, i) => (i === index ? { ...st, done: !st.done } : st))
    );
  };

  const deleteSubtask = (index) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubtaskKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtask();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onSave(columnId, {
      ...(card?.id ? { id: card.id } : {}),
      title: trimmedTitle,
      description: description.trim(),
      priority,
      tags,
      subtasks,
    });
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Tags available to pick (not already selected)
  const availableTags = (allTags || []).filter((t) => !tags.includes(t));

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal">
        <h3 className="modal-heading">
          {mode === 'add' ? 'New Task' : 'Edit Task'}
        </h3>
        <form onSubmit={handleSubmit}>
          <label className="modal-label">
            Title
            <input
              ref={titleRef}
              type="text"
              className="modal-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </label>
          <label className="modal-label">
            Description
            <textarea
              className="modal-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details (optional)"
              rows={3}
            />
          </label>
          <div className="modal-row">
            <label className="modal-label modal-label--half">
              Priority
              <select
                className="modal-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <div className="modal-label">
            Tags
            {tags.length > 0 && (
              <div className="tag-picker-selected">
                {tags.map((tag) => (
                  <span key={tag} className="tag-chip tag-chip--selected">
                    {tag}
                    <button type="button" className="tag-chip-remove" onClick={() => removeTag(tag)}>
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            {availableTags.length > 0 && (
              <div className="tag-picker-available">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-chip tag-chip--available"
                    onClick={() => toggleTag(tag)}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
            <div className="tag-picker-new">
              <input
                type="text"
                className="modal-input tag-picker-input"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleNewTagKeyDown}
                placeholder="New tag name..."
              />
              <button
                type="button"
                className="modal-btn modal-btn--secondary tag-picker-add"
                onClick={addNewTag}
                disabled={!newTag.trim()}
              >
                Add
              </button>
            </div>
          </div>
          <div className="modal-label">
            Subtasks
            {subtasks.length > 0 && (
              <ul className="subtask-list">
                {subtasks.map((st, index) => (
                  <li key={index} className={`subtask-item${st.done ? ' subtask-item--done' : ''}`}>
                    <label className="subtask-checkbox-label">
                      <input
                        type="checkbox"
                        checked={st.done}
                        onChange={() => toggleSubtask(index)}
                        className="subtask-checkbox"
                      />
                      <span className="subtask-title">{st.title}</span>
                    </label>
                    <button
                      type="button"
                      className="subtask-remove"
                      onClick={() => deleteSubtask(index)}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="subtask-add">
              <input
                type="text"
                className="modal-input subtask-add-input"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={handleSubtaskKeyDown}
                placeholder="Add a subtask..."
              />
              <button
                type="button"
                className="modal-btn modal-btn--secondary subtask-add-btn"
                onClick={addSubtask}
                disabled={!newSubtask.trim()}
              >
                Add
              </button>
            </div>
          </div>
          <div className="modal-actions">
            {mode === 'edit' && (
              <button
                type="button"
                className="modal-btn modal-btn--danger"
                onClick={() => onDelete(columnId, card.id)}
              >
                Delete
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="modal-btn modal-btn--secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="modal-btn modal-btn--primary">
                {mode === 'add' ? 'Add' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

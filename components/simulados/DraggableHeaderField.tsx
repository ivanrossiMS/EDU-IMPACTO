import React, { useRef, useState, useEffect } from 'react';

export function DraggableHeaderField({
  fieldKey,
  field,
  isEditMode,
  onChange,
  pageRef
}: {
  fieldKey: string;
  field: any;
  isEditMode: boolean;
  onChange: (key: string, newField: any) => void;
  pageRef: React.RefObject<HTMLDivElement>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [localPos, setLocalPos] = useState({ x: field.x, y: field.y });
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEditMode) {
      setIsDragging(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!isDragging) {
      setLocalPos({ x: field.x, y: field.y });
    }
  }, [field.x, field.y, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditMode || !pageRef.current) return;
    
    // Removido e.preventDefault() para permitir o focus() nativo
    e.stopPropagation();
    setIsDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialXPercent = field.x;
    const initialYPercent = field.y;
    
    const pageRect = pageRef.current.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const deltaXPercent = (deltaX / pageRect.width) * 100;
      const deltaYPercent = (deltaY / pageRect.height) * 100;

      let newX = initialXPercent + deltaXPercent;
      let newY = initialYPercent + deltaYPercent;

      newX = Math.max(0, Math.min(newX, 100 - (field.width || 10)));
      newY = Math.max(0, Math.min(newY, 100));

      setLocalPos({ x: newX, y: newY });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const deltaX = upEvent.clientX - startX;
      const deltaY = upEvent.clientY - startY;

      const deltaXPercent = (deltaX / pageRect.width) * 100;
      const deltaYPercent = (deltaY / pageRect.height) * 100;

      let newX = initialXPercent + deltaXPercent;
      let newY = initialYPercent + deltaYPercent;

      newX = Math.max(0, Math.min(newX, 100 - (field.width || 10)));
      newY = Math.max(0, Math.min(newY, 100));

      onChange(fieldKey, { ...field, x: newX, y: newY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditMode) return;
    
    const step = e.shiftKey ? 0.5 : 0.1;
    let newX = field.x;
    let newY = field.y;

    if (e.key === 'ArrowUp') newY -= step;
    else if (e.key === 'ArrowDown') newY += step;
    else if (e.key === 'ArrowLeft') newX -= step;
    else if (e.key === 'ArrowRight') newX += step;
    else return;

    e.preventDefault();
    
    newX = Math.max(0, Math.min(newX, 100 - (field.width || 10)));
    newY = Math.max(0, Math.min(newY, 100));
    
    onChange(fieldKey, { ...field, x: newX, y: newY });
  };

  const renderX = isDragging ? localPos.x : field.x;
  const renderY = isDragging ? localPos.y : field.y;

  return (
    <div
      ref={fieldRef}
      className={`header-field ${isEditMode ? 'editable' : ''} ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={isEditMode ? 0 : -1}
      style={{
        position: 'absolute',
        left: `${renderX}%`,
        top: `${renderY}%`,
        width: `${field.width || 10}%`,
        fontSize: `${field.fontSize}pt`,
        textAlign: field.align as any,
        transform: 'translateY(-50%)',
        whiteSpace: 'nowrap',
        cursor: isEditMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
        pointerEvents: isEditMode ? 'auto' : 'none',
        zIndex: isEditMode ? 10 : 2
      }}
      title={isEditMode ? field.label : undefined}
    >
      {isEditMode && (
        <div className="field-label-tag">
          {field.label}
        </div>
      )}
      {field.value}
    </div>
  );
}

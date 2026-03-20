import { fabric } from 'fabric';

export interface StickyNoteOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  text?: string;
  id?: string;
}

const STICKY_COLORS: Record<string, { bg: string; border: string }> = {
  yellow: { bg: '#fef3c7', border: '#f59e0b' },
  pink: { bg: '#fce7f3', border: '#ec4899' },
  blue: { bg: '#dbeafe', border: '#3b82f6' },
  green: { bg: '#dcfce7', border: '#22c55e' },
};

export const STICKY_COLOR_LIST = Object.keys(STICKY_COLORS) as Array<keyof typeof STICKY_COLORS>;

/**
 * Creates a sticky note as a fabric.Group and adds it to the canvas.
 * Returns the group object.
 */
export function createStickyNote(
  canvas: fabric.Canvas,
  options: StickyNoteOptions = {}
): fabric.Group {
  const {
    x = 100,
    y = 100,
    width = 160,
    height = 120,
    color = 'yellow',
    text = 'Note...',
    id = `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  } = options;

  const colorDef = STICKY_COLORS[color] || STICKY_COLORS.yellow;

  const rect = new fabric.Rect({
    width,
    height,
    fill: colorDef.bg,
    stroke: colorDef.border,
    strokeWidth: 1,
    rx: 6,
    ry: 6,
    shadow: new fabric.Shadow({
      color: 'rgba(0,0,0,0.15)',
      blur: 8,
      offsetX: 2,
      offsetY: 3,
    }),
    originX: 'center',
    originY: 'center',
  });

  const textObj = new fabric.Textbox(text, {
    width: width - 16,
    fontSize: 13,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fill: '#1e1e1e',
    textAlign: 'left',
    lineHeight: 1.3,
    originX: 'center',
    originY: 'center',
    editable: true,
    splitByGrapheme: false,
  });

  // Header bar (small colored strip at top)
  const header = new fabric.Rect({
    width: width - 2,
    height: 6,
    fill: colorDef.border,
    rx: 4,
    ry: 4,
    originX: 'center',
    originY: 'center',
    top: -(height / 2) + 3,
  });

  const group = new fabric.Group([rect, header, textObj], {
    left: x,
    top: y,
    subTargetCheck: true,
    hasControls: true,
    hasBorders: true,
    lockRotation: true,
    cornerColor: '#5b9fd6',
    cornerStrokeColor: '#5b9fd6',
    cornerSize: 7,
    transparentCorners: false,
    borderColor: '#5b9fd6',
    padding: 4,
  });

  // Store metadata on the group
  (group as fabric.Group & { stickyId?: string; stickyColor?: string }).stickyId = id;
  (group as fabric.Group & { stickyColor?: string }).stickyColor = color;

  // Enable editing text on double-click
  group.on('mousedblclick', () => {
    // Ungroup, edit text, regroup
    const items = group.getObjects();
    const textItem = items.find((o) => o.type === 'textbox') as fabric.Textbox | undefined;
    if (textItem) {
      // Remove group, add individual objects
      const groupLeft = group.left || 0;
      const groupTop = group.top || 0;

      canvas.remove(group);

      textItem.set({
        left: groupLeft + (width - textItem.width!) / 2,
        top: groupTop + (height - (textItem.height || 40)) / 2,
        selectable: true,
        editable: true,
      });
      canvas.add(textItem);
      canvas.setActiveObject(textItem);
      textItem.enterEditing();
      canvas.renderAll();

      const handleDeselect = () => {
        textItem.exitEditing();
        canvas.remove(textItem);

        // Re-read text
        const newTextObj = new fabric.Textbox(textItem.text || 'Note...', {
          width: width - 16,
          fontSize: 13,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fill: '#1e1e1e',
          textAlign: 'left',
          lineHeight: 1.3,
          originX: 'center',
          originY: 'center',
          editable: true,
        });

        // Re-create rect and header (fabric v5 clone() is async/callback-based)
        const newRect = new fabric.Rect({
          width,
          height,
          fill: colorDef.bg,
          stroke: colorDef.border,
          strokeWidth: 1,
          rx: 6,
          ry: 6,
          shadow: new fabric.Shadow({
            color: 'rgba(0,0,0,0.15)',
            blur: 8,
            offsetX: 2,
            offsetY: 3,
          }),
          originX: 'center',
          originY: 'center',
        });
        const newHeader = new fabric.Rect({
          width: width - 2,
          height: 6,
          fill: colorDef.border,
          rx: 4,
          ry: 4,
          originX: 'center',
          originY: 'center',
          top: -(height / 2) + 3,
        });

        const newGroup = new fabric.Group(
          [newRect, newHeader, newTextObj],
          {
            left: groupLeft,
            top: groupTop,
            subTargetCheck: true,
            hasControls: true,
            hasBorders: true,
            lockRotation: true,
            cornerColor: '#5b9fd6',
            cornerStrokeColor: '#5b9fd6',
            cornerSize: 7,
            transparentCorners: false,
            borderColor: '#5b9fd6',
            padding: 4,
          }
        );

        (newGroup as fabric.Group & { stickyId?: string }).stickyId = id;
        (newGroup as fabric.Group & { stickyColor?: string }).stickyColor = color;

        canvas.add(newGroup);
        canvas.setActiveObject(newGroup);
        canvas.renderAll();

        canvas.off('selection:cleared', handleDeselect);
      };

      canvas.on('selection:cleared', handleDeselect);
    }
  });

  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.renderAll();

  return group;
}

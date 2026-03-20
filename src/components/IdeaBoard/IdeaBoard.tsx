import React, { useRef, useEffect, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { AnimatePresence } from 'motion/react';
import { Toolbar } from './Toolbar';
import { ContextMenu } from './ContextMenu';
import { createStickyNote } from './StickyNote';
import { useIdeaBoardStore } from '../../store/ideaboard-store';
import { useMarkerStore } from '../../store/marker-store';
import { cepBridge } from '../../bridge/cep-bridge';

interface IdeaBoardProps {
  markerId: string | null;
}

interface HistoryEntry {
  json: string;
}

const DOT_SPACING = 20;
const DOT_RADIUS = 0.8;
const DOT_COLOR = 'rgba(255,255,255,0.06)';

function drawDotGrid(canvas: fabric.Canvas, show: boolean) {
  // Remove old grid objects
  const objects = canvas.getObjects();
  objects.forEach((obj) => {
    if ((obj as fabric.Object & { _isGrid?: boolean })._isGrid) {
      canvas.remove(obj);
    }
  });

  if (!show) {
    canvas.renderAll();
    return;
  }

  const zoom = canvas.getZoom();
  const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
  const panX = vpt[4];
  const panY = vpt[5];

  const w = canvas.getWidth();
  const h = canvas.getHeight();

  // Calculate visible area in canvas coords
  const startX = -panX / zoom;
  const startY = -panY / zoom;
  const endX = startX + w / zoom;
  const endY = startY + h / zoom;

  const spacing = DOT_SPACING;
  const gridStartX = Math.floor(startX / spacing) * spacing;
  const gridStartY = Math.floor(startY / spacing) * spacing;

  const dots: fabric.Circle[] = [];
  for (let x = gridStartX; x < endX; x += spacing) {
    for (let y = gridStartY; y < endY; y += spacing) {
      const dot = new fabric.Circle({
        left: x - DOT_RADIUS,
        top: y - DOT_RADIUS,
        radius: DOT_RADIUS,
        fill: DOT_COLOR,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        objectCaching: false,
      });
      (dot as fabric.Circle & { _isGrid?: boolean })._isGrid = true;
      dots.push(dot);
    }
  }

  // Batch add
  dots.forEach((d) => canvas.add(d));
  // Move grid dots behind all other objects
  dots.forEach((d) => canvas.sendToBack(d));
  canvas.renderAll();
}

export const IdeaBoard: React.FC<IdeaBoardProps> = ({ markerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clipboardRef = useRef<fabric.Object | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [isSelectedLocked, setIsSelectedLocked] = useState(false);

  // History (undo/redo)
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const activeTool = useIdeaBoardStore((s) => s.activeTool);
  const zoom = useIdeaBoardStore((s) => s.zoom);
  const setZoom = useIdeaBoardStore((s) => s.setZoom);
  const showGrid = useIdeaBoardStore((s) => s.showGrid);
  const locked = useIdeaBoardStore((s) => s.locked);
  const lockObject = useIdeaBoardStore((s) => s.lockObject);
  const unlockObject = useIdeaBoardStore((s) => s.unlockObject);
  const updateMarker = useMarkerStore((s) => s.updateMarker);

  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);

  // Save canvas state to marker
  const saveToMarker = useCallback(() => {
    if (!fabricRef.current || !markerId) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    updateMarker(markerId, { ideaBoardData: json });
  }, [markerId, updateMarker]);

  // Push history state
  const pushHistory = useCallback(() => {
    if (isUndoRedoRef.current || !fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    const index = historyIndexRef.current;
    // Discard redo states
    historyRef.current = historyRef.current.slice(0, index + 1);
    historyRef.current.push({ json });
    historyIndexRef.current = historyRef.current.length - 1;
    // Keep max 50 states
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0 || !fabricRef.current) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    const entry = historyRef.current[historyIndexRef.current];
    fabricRef.current.loadFromJSON(entry.json, () => {
      fabricRef.current?.renderAll();
      isUndoRedoRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      saveToMarker();
    });
  }, [saveToMarker]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1 || !fabricRef.current) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    const entry = historyRef.current[historyIndexRef.current];
    fabricRef.current.loadFromJSON(entry.json, () => {
      fabricRef.current?.renderAll();
      isUndoRedoRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      saveToMarker();
    });
  }, [saveToMarker]);

  // Initialize fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#1e1e1e',
      width: container.clientWidth,
      height: container.clientHeight,
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
    });

    fabricRef.current = canvas;

    // Load saved data
    if (markerId) {
      const marker = useMarkerStore.getState().markers.find((m) => m.id === markerId);
      if (marker?.ideaBoardData) {
        try {
          canvas.loadFromJSON(marker.ideaBoardData, () => {
            canvas.renderAll();
            pushHistory();
          });
        } catch {
          pushHistory();
        }
      } else {
        pushHistory();
      }
    } else {
      pushHistory();
    }

    // Track selection
    canvas.on('selection:created', () => {
      setHasSelection(true);
      const active = canvas.getActiveObject();
      if (active) {
        const id = (active as fabric.Object & { stickyId?: string }).stickyId || active.toString();
        setIsSelectedLocked(locked.has(id));
      }
    });
    canvas.on('selection:updated', () => {
      setHasSelection(true);
      const active = canvas.getActiveObject();
      if (active) {
        const id = (active as fabric.Object & { stickyId?: string }).stickyId || active.toString();
        setIsSelectedLocked(locked.has(id));
      }
    });
    canvas.on('selection:cleared', () => {
      setHasSelection(false);
      setIsSelectedLocked(false);
    });

    // Object modification -> save
    const onModified = () => {
      pushHistory();
      saveToMarker();
    };
    canvas.on('object:modified', onModified);
    canvas.on('object:added', onModified);
    canvas.on('object:removed', onModified);

    // Right-click context menu
    canvas.on('mouse:down', (opt) => {
      if (opt.button === 3) {
        const pointer = canvas.getPointer(opt.e, true);
        setContextMenu({ x: pointer.x, y: pointer.y });
        opt.e.preventDefault();
        opt.e.stopPropagation();
      } else {
        setContextMenu(null);
      }
    });

    // Pan with middle mouse
    canvas.on('mouse:down', (opt) => {
      const me = opt.e as MouseEvent;
      if (opt.button === 2 || spaceHeldRef.current) {
        isPanningRef.current = true;
        lastPanPosRef.current = { x: me.clientX, y: me.clientY };
        canvas.selection = false;
        canvas.setCursor('grab');
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanningRef.current) {
        const me = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += me.clientX - lastPanPosRef.current.x;
          vpt[5] += me.clientY - lastPanPosRef.current.y;
          canvas.requestRenderAll();
          lastPanPosRef.current = { x: me.clientX, y: me.clientY };
        }
      }
    });

    canvas.on('mouse:up', () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        canvas.selection = true;
        canvas.setCursor('default');
        if (showGrid) drawDotGrid(canvas, true);
      }
    });

    // Zoom with mouse wheel
    canvas.on('mouse:wheel', (opt) => {
      const we = opt.e as WheelEvent;
      const delta = we.deltaY;
      let newZoom = canvas.getZoom() * (1 - delta / 300);
      newZoom = Math.max(0.1, Math.min(5, newZoom));
      const pointer = canvas.getPointer(opt.e, true);
      canvas.zoomToPoint(new fabric.Point(pointer.x, pointer.y), newZoom);
      setZoom(newZoom);
      if (showGrid) drawDotGrid(canvas, true);
      we.preventDefault();
      we.stopPropagation();
    });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.setWidth(entry.contentRect.width);
        canvas.setHeight(entry.contentRect.height);
        canvas.renderAll();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerId]);

  // Apply grid
  useEffect(() => {
    if (fabricRef.current) {
      drawDotGrid(fabricRef.current, showGrid);
    }
  }, [showGrid, zoom]);

  // Apply zoom changes from toolbar
  useEffect(() => {
    if (fabricRef.current) {
      const center = fabricRef.current.getCenter();
      fabricRef.current.zoomToPoint(new fabric.Point(center.left, center.top), zoom);
      fabricRef.current.renderAll();
    }
  }, [zoom]);

  // Apply tool changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Reset
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';

    switch (activeTool) {
      case 'select':
        canvas.defaultCursor = 'default';
        break;
      case 'pen': {
        canvas.isDrawingMode = true;
        const brush = new fabric.PencilBrush(canvas);
        brush.color = '#5b9fd6';
        brush.width = 2;
        canvas.freeDrawingBrush = brush;
        break;
      }
      case 'eraser':
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
        canvas.selection = false;
        break;
      case 'rectangle':
      case 'circle':
      case 'text':
      case 'lasso':
        canvas.defaultCursor = 'crosshair';
        canvas.selection = false;
        break;
      case 'sticky':
        canvas.defaultCursor = 'crosshair';
        canvas.selection = false;
        break;
    }
    canvas.renderAll();
  }, [activeTool]);

  // Drawing shapes (rectangle, circle, text, sticky, eraser)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let drawingObj: fabric.Object | null = null;

    const onMouseDown = (opt: fabric.IEvent<Event>) => {
      if (isPanningRef.current || opt.button === 2 || opt.button === 3) return;
      const pointer = canvas.getPointer(opt.e);

      if (activeTool === 'eraser') {
        const target = canvas.findTarget(opt.e, false);
        if (target && !(target as fabric.Object & { _isGrid?: boolean })._isGrid) {
          canvas.remove(target);
          canvas.renderAll();
          pushHistory();
          saveToMarker();
        }
        return;
      }

      if (activeTool === 'sticky') {
        createStickyNote(canvas, { x: pointer.x, y: pointer.y });
        pushHistory();
        saveToMarker();
        return;
      }

      if (activeTool === 'text') {
        const text = new fabric.IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 16,
          fill: '#d8d8d8',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          editable: true,
          cornerColor: '#5b9fd6',
          cornerStrokeColor: '#5b9fd6',
          cornerSize: 7,
          transparentCorners: false,
          borderColor: '#5b9fd6',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        canvas.renderAll();
        return;
      }

      if (activeTool === 'rectangle' || activeTool === 'circle') {
        isDrawing = true;
        startX = pointer.x;
        startY = pointer.y;

        if (activeTool === 'rectangle') {
          drawingObj = new fabric.Rect({
            left: startX,
            top: startY,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: '#5b9fd6',
            strokeWidth: 2,
            cornerColor: '#5b9fd6',
            cornerStrokeColor: '#5b9fd6',
            cornerSize: 7,
            transparentCorners: false,
            borderColor: '#5b9fd6',
          });
        } else {
          drawingObj = new fabric.Ellipse({
            left: startX,
            top: startY,
            rx: 0,
            ry: 0,
            fill: 'transparent',
            stroke: '#5b9fd6',
            strokeWidth: 2,
            cornerColor: '#5b9fd6',
            cornerStrokeColor: '#5b9fd6',
            cornerSize: 7,
            transparentCorners: false,
            borderColor: '#5b9fd6',
          });
        }
        canvas.add(drawingObj);
      }

      if (activeTool === 'lasso') {
        isDrawing = true;
        startX = pointer.x;
        startY = pointer.y;
      }
    };

    const onMouseMove = (opt: fabric.IEvent<Event>) => {
      if (!isDrawing || !drawingObj) return;
      const pointer = canvas.getPointer(opt.e);

      if (activeTool === 'rectangle') {
        const left = Math.min(startX, pointer.x);
        const top = Math.min(startY, pointer.y);
        (drawingObj as fabric.Rect).set({
          left,
          top,
          width: Math.abs(pointer.x - startX),
          height: Math.abs(pointer.y - startY),
        });
      } else if (activeTool === 'circle') {
        const rx = Math.abs(pointer.x - startX) / 2;
        const ry = Math.abs(pointer.y - startY) / 2;
        (drawingObj as fabric.Ellipse).set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          rx,
          ry,
        });
      }

      canvas.renderAll();
    };

    const onMouseUp = () => {
      if (isDrawing) {
        isDrawing = false;
        if (drawingObj) {
          canvas.setActiveObject(drawingObj);
          drawingObj = null;
          pushHistory();
          saveToMarker();
        }
      }
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [activeTool, pushHistory, saveToMarker]);

  // Keyboard shortcuts
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for pan
      if (e.code === 'Space' && !spaceHeldRef.current) {
        spaceHeldRef.current = true;
        canvas.defaultCursor = 'grab';
        canvas.renderAll();
        e.preventDefault();
        return;
      }

      const active = canvas.getActiveObject();

      // Skip shortcuts when editing text
      if (active && (active as fabric.IText).isEditing) return;

      const isCtrl = e.ctrlKey || e.metaKey;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (active) {
          if ((active as fabric.ActiveSelection).type === 'activeSelection') {
            (active as fabric.ActiveSelection).forEachObject((obj: fabric.Object) => canvas.remove(obj));
            canvas.discardActiveObject();
          } else {
            canvas.remove(active);
          }
          canvas.renderAll();
          pushHistory();
          saveToMarker();
        }
        e.preventDefault();
      }

      // Ctrl+Z undo
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        handleUndo();
        e.preventDefault();
      }

      // Ctrl+Shift+Z redo
      if (isCtrl && e.key === 'z' && e.shiftKey) {
        handleRedo();
        e.preventDefault();
      }

      // Ctrl+D duplicate
      if (isCtrl && e.key === 'd') {
        if (active) {
          active.clone((cloned: fabric.Object) => {
            cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
            pushHistory();
            saveToMarker();
          });
        }
        e.preventDefault();
      }

      // Ctrl+A select all
      if (isCtrl && e.key === 'a') {
        const objs = canvas.getObjects().filter(
          (o) => !(o as fabric.Object & { _isGrid?: boolean })._isGrid
        );
        if (objs.length) {
          const sel = new fabric.ActiveSelection(objs, { canvas });
          canvas.setActiveObject(sel);
          canvas.renderAll();
        }
        e.preventDefault();
      }

      // Ctrl+L lock/unlock
      if (isCtrl && e.key === 'l') {
        if (active) {
          const id = (active as fabric.Object & { stickyId?: string }).stickyId || active.toString();
          if (locked.has(id)) {
            unlockObject(id);
            active.set({ selectable: true, evented: true });
            setIsSelectedLocked(false);
          } else {
            lockObject(id);
            active.set({ selectable: false, evented: false });
            canvas.discardActiveObject();
            setIsSelectedLocked(true);
          }
          canvas.renderAll();
        }
        e.preventDefault();
      }

      // Ctrl+C copy
      if (isCtrl && e.key === 'c') {
        if (active) {
          active.clone((cloned: fabric.Object) => {
            clipboardRef.current = cloned;
          });
        }
        e.preventDefault();
      }

      // Ctrl+X cut
      if (isCtrl && e.key === 'x') {
        if (active) {
          active.clone((cloned: fabric.Object) => {
            clipboardRef.current = cloned;
          });
          canvas.remove(active);
          canvas.renderAll();
          pushHistory();
          saveToMarker();
        }
        e.preventDefault();
      }

      // Ctrl+V paste
      if (isCtrl && e.key === 'v') {
        if (clipboardRef.current) {
          clipboardRef.current.clone((cloned: fabric.Object) => {
            cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
            clipboardRef.current = cloned;
            pushHistory();
            saveToMarker();
          });
        }
        e.preventDefault();
      }

      // Tool shortcuts
      if (!isCtrl) {
        const toolMap: Record<string, typeof activeTool> = {
          v: 'select',
          p: 'pen',
          r: 'rectangle',
          c: 'circle',
          t: 'text',
          s: 'sticky',
          e: 'eraser',
          l: 'lasso',
        };
        const tool = toolMap[e.key.toLowerCase()];
        if (tool) {
          useIdeaBoardStore.getState().setTool(tool);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        if (canvas) {
          canvas.defaultCursor = activeTool === 'select' ? 'default' : 'crosshair';
          canvas.renderAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool, handleUndo, handleRedo, locked, lockObject, unlockObject, pushHistory, saveToMarker]);

  // Context menu actions
  const handleCut = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    active.clone((cloned: fabric.Object) => {
      clipboardRef.current = cloned;
    });
    canvas.remove(active);
    canvas.renderAll();
    pushHistory();
    saveToMarker();
  }, [pushHistory, saveToMarker]);

  const handleCopy = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active) return;
    active.clone((cloned: fabric.Object) => {
      clipboardRef.current = cloned;
    });
  }, []);

  const handlePaste = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !clipboardRef.current) return;
    clipboardRef.current.clone((cloned: fabric.Object) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      clipboardRef.current = cloned;
      pushHistory();
      saveToMarker();
    });
  }, [pushHistory, saveToMarker]);

  const handleDuplicate = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    active.clone((cloned: fabric.Object) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      pushHistory();
      saveToMarker();
    });
  }, [pushHistory, saveToMarker]);

  const handleDelete = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    if ((active as fabric.ActiveSelection).type === 'activeSelection') {
      (active as fabric.ActiveSelection).forEachObject((obj: fabric.Object) => canvas.remove(obj));
      canvas.discardActiveObject();
    } else {
      canvas.remove(active);
    }
    canvas.renderAll();
    pushHistory();
    saveToMarker();
  }, [pushHistory, saveToMarker]);

  const handleToggleLock = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    const id = (active as fabric.Object & { stickyId?: string }).stickyId || active.toString();
    if (locked.has(id)) {
      unlockObject(id);
      active.set({ selectable: true, evented: true });
      setIsSelectedLocked(false);
    } else {
      lockObject(id);
      active.set({ selectable: false, evented: false });
      canvas.discardActiveObject();
      setIsSelectedLocked(true);
    }
    canvas.renderAll();
  }, [locked, lockObject, unlockObject]);

  const handleBringToFront = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    canvas.bringToFront(active);
    canvas.renderAll();
    pushHistory();
    saveToMarker();
  }, [pushHistory, saveToMarker]);

  const handleSendToBack = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    canvas.sendToBack(active);
    canvas.renderAll();
    pushHistory();
    saveToMarker();
  }, [pushHistory, saveToMarker]);

  const handleAddStickyNote = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const center = canvas.getCenter();
    createStickyNote(canvas, {
      x: center.left - 80,
      y: center.top - 60,
    });
    pushHistory();
    saveToMarker();
  }, [pushHistory, saveToMarker]);

  const handleAddImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !fabricRef.current) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        fabric.Image.fromURL(dataUrl, (img) => {
          const canvas = fabricRef.current!;
          // Scale down large images
          const maxDim = 300;
          if (img.width && img.width > maxDim) {
            img.scaleToWidth(maxDim);
          }
          if (img.height && (img.height * (img.scaleX || 1)) > maxDim) {
            img.scaleToHeight(maxDim);
          }
          img.set({
            left: canvas.getCenter().left - (img.width || 100) / 2 * (img.scaleX || 1),
            top: canvas.getCenter().top - (img.height || 100) / 2 * (img.scaleY || 1),
            cornerColor: '#5b9fd6',
            cornerStrokeColor: '#5b9fd6',
            cornerSize: 7,
            transparentCorners: false,
            borderColor: '#5b9fd6',
          });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          pushHistory();
          saveToMarker();
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [pushHistory, saveToMarker]);

  const handlePushToAE = useCallback(() => {
    if (!fabricRef.current || !markerId) return;
    const dataUrl = fabricRef.current.toDataURL({ format: 'png', multiplier: 2 });
    cepBridge.pushIdeaBoardToAE(markerId, dataUrl);
  }, [markerId]);

  if (!markerId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[11px] text-[#d8d8d8]/30">
          Select a marker to open its Idea Board
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-12">
      <Toolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPushToAE={handlePushToAE}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} />
        <AnimatePresence>
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              hasSelection={hasSelection}
              isLocked={isSelectedLocked}
              onClose={() => setContextMenu(null)}
              onCut={handleCut}
              onCopy={handleCopy}
              onPaste={handlePaste}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onToggleLock={handleToggleLock}
              onBringToFront={handleBringToFront}
              onSendToBack={handleSendToBack}
              onAddStickyNote={handleAddStickyNote}
              onAddImage={handleAddImage}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

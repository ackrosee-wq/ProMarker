// ProMarker Keyboard Shortcuts Hook
// Handles keyboard shortcuts for the idea board canvas.

import { useEffect, useRef } from 'react';
import { useIdeaBoardStore } from '../store/ideaboard-store';
import type { IdeaBoardTool } from '../store/ideaboard-store';

interface ClipboardData {
  objects: any[];
}

export function useKeyboardShortcuts(
  canvasRef: React.RefObject<fabric.Canvas | null>
) {
  const clipboardRef = useRef<ClipboardData | null>(null);
  const spaceHeldRef = useRef(false);
  const previousToolRef = useRef<IdeaBoardTool>('select');

  useEffect(() => {
    const store = useIdeaBoardStore.getState();

    const handleKeyDown = (e: KeyboardEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Ignore shortcuts when typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();

      // ------------------------------------------------------------------
      // Ctrl/Cmd shortcuts
      // ------------------------------------------------------------------
      if (isCtrl) {
        switch (key) {
          case 'z': {
            e.preventDefault();
            if (isShift) {
              // Ctrl+Shift+Z: Redo
              const state = useIdeaBoardStore.getState().redo();
              if (state) {
                canvas.loadFromJSON(state, () => canvas.renderAll());
              }
            } else {
              // Ctrl+Z: Undo
              const state = useIdeaBoardStore.getState().undo();
              if (state) {
                canvas.loadFromJSON(state, () => canvas.renderAll());
              } else {
                // Undo to blank canvas
                canvas.clear();
                canvas.renderAll();
              }
            }
            break;
          }

          case 'y': {
            // Ctrl+Y: Redo (alternative)
            e.preventDefault();
            const state = useIdeaBoardStore.getState().redo();
            if (state) {
              canvas.loadFromJSON(state, () => canvas.renderAll());
            }
            break;
          }

          case 'd': {
            // Ctrl+D: Duplicate selected objects
            e.preventDefault();
            const activeObj = canvas.getActiveObject();
            if (!activeObj) break;

            activeObj.clone((cloned: fabric.Object) => {
              cloned.set({
                left: (cloned.left || 0) + 20,
                top: (cloned.top || 0) + 20,
              });
              if (cloned.type === 'activeSelection' && canvas) {
                (cloned as fabric.ActiveSelection).forEachObject(
                  (obj: fabric.Object) => {
                    canvas.add(obj);
                  }
                );
                cloned.setCoords();
              } else {
                canvas.add(cloned);
              }
              canvas.setActiveObject(cloned);
              canvas.requestRenderAll();
            });
            break;
          }

          case 'a': {
            // Ctrl+A: Select all
            e.preventDefault();
            const allObjects = canvas.getObjects().filter((obj) => {
              const id = (obj as any).id as string | undefined;
              return !id || !useIdeaBoardStore.getState().locked.has(id);
            });
            if (allObjects.length > 0) {
              const selection = new (window as any).fabric.ActiveSelection(
                allObjects,
                { canvas }
              );
              canvas.setActiveObject(selection);
              canvas.requestRenderAll();
            }
            break;
          }

          case 'l': {
            // Ctrl+L: Lock/unlock selected
            e.preventDefault();
            const active = canvas.getActiveObject();
            if (!active) break;

            const id = (active as any).id as string | undefined;
            if (!id) break;

            const { locked, lockObject, unlockObject } =
              useIdeaBoardStore.getState();
            if (locked.has(id)) {
              unlockObject(id);
              active.set({
                selectable: true,
                evented: true,
                hasControls: true,
              });
            } else {
              lockObject(id);
              active.set({
                selectable: false,
                evented: false,
                hasControls: false,
              });
              canvas.discardActiveObject();
            }
            canvas.requestRenderAll();
            break;
          }

          case 'c': {
            // Ctrl+C: Copy
            e.preventDefault();
            const activeForCopy = canvas.getActiveObject();
            if (!activeForCopy) break;

            activeForCopy.clone((cloned: fabric.Object) => {
              clipboardRef.current = {
                objects: [cloned],
              };
            });
            break;
          }

          case 'v': {
            // Ctrl+V: Paste
            e.preventDefault();
            if (!clipboardRef.current || clipboardRef.current.objects.length === 0)
              break;

            const src = clipboardRef.current.objects[0];
            src.clone((cloned: fabric.Object) => {
              cloned.set({
                left: (cloned.left || 0) + 20,
                top: (cloned.top || 0) + 20,
              });
              if (cloned.type === 'activeSelection' && canvas) {
                (cloned as fabric.ActiveSelection).forEachObject(
                  (obj: fabric.Object) => {
                    canvas.add(obj);
                  }
                );
                cloned.setCoords();
              } else {
                canvas.add(cloned);
              }
              canvas.setActiveObject(cloned);
              canvas.requestRenderAll();

              // Update clipboard position for subsequent pastes
              clipboardRef.current = { objects: [cloned] };
            });
            break;
          }

          case 'x': {
            // Ctrl+X: Cut
            e.preventDefault();
            const activeToCut = canvas.getActiveObject();
            if (!activeToCut) break;

            activeToCut.clone((cloned: fabric.Object) => {
              clipboardRef.current = { objects: [cloned] };
            });

            if (activeToCut.type === 'activeSelection') {
              (activeToCut as fabric.ActiveSelection).forEachObject(
                (obj: fabric.Object) => {
                  canvas.remove(obj);
                }
              );
              canvas.discardActiveObject();
            } else {
              canvas.remove(activeToCut);
            }
            canvas.requestRenderAll();
            break;
          }
        }
        return;
      }

      // ------------------------------------------------------------------
      // Non-modifier key shortcuts
      // ------------------------------------------------------------------
      switch (key) {
        case 'delete':
        case 'backspace': {
          // Delete selected objects
          e.preventDefault();
          const active = canvas.getActiveObject();
          if (!active) break;

          if (active.type === 'activeSelection') {
            (active as fabric.ActiveSelection).forEachObject(
              (obj: fabric.Object) => {
                const id = (obj as any).id as string | undefined;
                if (id && useIdeaBoardStore.getState().locked.has(id)) return;
                canvas.remove(obj);
              }
            );
            canvas.discardActiveObject();
          } else {
            const id = (active as any).id as string | undefined;
            if (id && useIdeaBoardStore.getState().locked.has(id)) break;
            canvas.remove(active);
          }
          canvas.requestRenderAll();
          break;
        }

        case 'escape': {
          // Deselect all, cancel current tool
          e.preventDefault();
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          useIdeaBoardStore.getState().setTool('select');
          break;
        }

        case ' ': {
          // Space (hold): pan mode
          if (!spaceHeldRef.current) {
            e.preventDefault();
            spaceHeldRef.current = true;
            previousToolRef.current = useIdeaBoardStore.getState().activeTool;
            useIdeaBoardStore.getState().setTool('pan');
            canvas.defaultCursor = 'grab';
            canvas.hoverCursor = 'grab';
          }
          break;
        }

        // Tool shortcuts (single letter)
        case 'v': {
          useIdeaBoardStore.getState().setTool('select');
          break;
        }
        case 'p': {
          useIdeaBoardStore.getState().setTool('pen');
          break;
        }
        case 'r': {
          useIdeaBoardStore.getState().setTool('rectangle');
          break;
        }
        case 'o': {
          useIdeaBoardStore.getState().setTool('circle');
          break;
        }
        case 't': {
          useIdeaBoardStore.getState().setTool('text');
          break;
        }
        case 'e': {
          useIdeaBoardStore.getState().setTool('eraser');
          break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const canvas = canvasRef.current;

      if (key === ' ' && spaceHeldRef.current) {
        spaceHeldRef.current = false;
        useIdeaBoardStore.getState().setTool(previousToolRef.current);
        if (canvas) {
          canvas.defaultCursor = 'default';
          canvas.hoverCursor = 'move';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvasRef]);
}

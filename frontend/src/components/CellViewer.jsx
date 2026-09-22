import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CellScene } from '../three/CellScene.js';

/**
 * React wrapper around the Three.js stage. React owns *what* is shown
 * (cell, selection, toggles); CellScene owns *how* it is drawn and animated.
 */
const CellViewer = forwardRef(function CellViewer(
  {
    cell,
    definitions,
    mode = 'viewer',
    selectedId = null,
    autoRotate = true,
    open = true,
    insetRight = 0,
    insetBottom = 0,
    onSelect,
    onCounts,
  },
  ref,
) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const callbacks = useRef({ onSelect, onCounts });
  callbacks.current = { onSelect, onCounts };
  const [failed, setFailed] = useState(false);

  // Create the stage once per mode.
  useEffect(() => {
    let stage;
    try {
      stage = new CellScene(containerRef.current, {
        mode,
        onSelect: (id) => callbacks.current.onSelect?.(id),
        onReady: (model) => {
          const counts = {};
          model.entries.forEach((entry, id) => {
            counts[id] = entry.count;
          });
          callbacks.current.onCounts?.(counts);
        },
      });
    } catch (error) {
      console.error('WebGL kon niet worden gestart', error);
      setFailed(true);
      return undefined;
    }
    stageRef.current = stage;
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [mode]);

  // (Re)build the model when the cell changes.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !cell) return;
    stage.loadCell(cell, definitions);
    stage.setAutoRotate(autoRotate);
    stage.setOpen(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, definitions, mode]);

  useEffect(() => stageRef.current?.setAutoRotate(autoRotate), [autoRotate]);
  useEffect(() => stageRef.current?.setOpen(open), [open]);
  // Part of the canvas is covered by the explanation panel: keep the organelle in the free part.
  useEffect(
    () => stageRef.current?.setViewInsets({ right: insetRight, bottom: insetBottom }),
    [insetRight, insetBottom, mode],
  );

  // Selection made in the UI (buttons, panel) -> tell the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || stage.selectedId === selectedId) return;
    if (selectedId) stage.select(selectedId);
    else stage.clearSelection();
  }, [selectedId, cell]);

  useImperativeHandle(ref, () => ({ resetCamera: () => stageRef.current?.resetCamera() }), []);

  if (failed) {
    return (
      <div className="viewer-error" role="alert">
        <h2>3D kan hier niet starten</h2>
        <p>
          Deze browser of computer ondersteunt geen WebGL. Probeer een recente versie van Chrome, Edge of Firefox en
          zet hardwareversnelling aan.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className={`cell-viewer cell-viewer--${mode}`} />;
});

export default CellViewer;

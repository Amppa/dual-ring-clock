/**
 * TimeMapper - Pointer Drag & Reorder Controller
 *
 * Provides smooth pointer-based vertical reordering with real-time displacement,
 * sibling sliding animations, edge auto-scroll, and drop transitions.
 */

export const DragReorderController = {
  _drag: null,
  _scrollRaf: null,

  /**
   * Check if a drag operation is currently in progress.
   */
  isDragging() {
    return this._drag !== null;
  },

  /**
   * Start a pointer-based vertical drag-and-drop reorder.
   *
   * @param {Object} options
   * @param {PointerEvent} options.event - The pointerdown event.
   * @param {HTMLElement} options.container - The parent list container element.
   * @param {HTMLElement} options.item - The active item being dragged.
   * @param {HTMLElement[]} options.items - All draggable sibling items in order.
   * @param {HTMLElement} options.handle - The handle element capturing pointer events.
   * @param {number} options.startIndex - The initial index of item within items.
   * @param {Function} options.onReorder - Called when reordering is committed: (fromIndex, toIndex) => void.
   */
  begin(options) {
    const { event, container, item, items, handle, startIndex, onReorder } = options;

    if (this._drag || !event.isPrimary) return false;
    if (event.pointerType === "mouse" && event.button !== 0) return false;
    if (!items || items.length <= 1 || startIndex < 0) return false;
    if (!handle) return false;

    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);

    const slotHeight = items.length > 1
      ? (items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().top)
      : (item.offsetHeight + 6);

    const drag = {
      pointerId: event.pointerId,
      container,
      item,
      items,
      handle,
      startIndex,
      targetIndex: startIndex,
      startY: event.clientY,
      lastY: event.clientY,
      slotHeight,
      onReorder,
      onMove: (e) => this._onPointerMove(e),
      onEnd: (e) => this._onPointerEnd(e)
    };

    this._drag = drag;
    item.classList.add("is-dragging");
    container?.classList.add("is-dragging-active");

    document.addEventListener("pointermove", drag.onMove);
    document.addEventListener("pointerup", drag.onEnd);
    document.addEventListener("pointercancel", drag.onEnd);

    this._startAutoScroll();
    return true;
  },

  _onPointerMove(e) {
    const drag = this._drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (e.cancelable) e.preventDefault();

    drag.lastY = e.clientY;
    this._applyDragOffset(drag);
  },

  _onPointerEnd(e) {
    const drag = this._drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this._finishDrag(e.type === "pointercancel");
  },

  _applyDragOffset(drag) {
    const deltaY = drag.lastY - drag.startY;
    drag.item.style.transform = `translateY(${deltaY}px)`;

    const offsetSlots = Math.round(deltaY / drag.slotHeight);
    const targetIndex = Math.max(0, Math.min(drag.items.length - 1, drag.startIndex + offsetSlots));

    if (targetIndex !== drag.targetIndex) {
      drag.targetIndex = targetIndex;
      this._shiftSiblings(drag);
    }
  },

  _shiftSiblings(drag) {
    const { items, startIndex, targetIndex, slotHeight } = drag;
    items.forEach((sibling, i) => {
      if (i === startIndex) return;

      let shift = 0;
      if (startIndex < targetIndex) {
        if (i > startIndex && i <= targetIndex) shift = -slotHeight;
      } else if (startIndex > targetIndex) {
        if (i >= targetIndex && i < startIndex) shift = slotHeight;
      }
      sibling.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  },

  _startAutoScroll() {
    if (this._scrollRaf !== null) return;

    const EDGE = 72;
    const MAX_STEP = 16;

    const tick = () => {
      const drag = this._drag;
      if (!drag) {
        this._scrollRaf = null;
        return;
      }

      const y = drag.lastY;
      let delta = 0;
      if (y < EDGE) {
        delta = -Math.ceil(((EDGE - y) / EDGE) * MAX_STEP);
      } else if (y > window.innerHeight - EDGE) {
        delta = Math.ceil(((y - (window.innerHeight - EDGE)) / EDGE) * MAX_STEP);
      }

      if (delta !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, delta);
        const scrolled = window.scrollY - before;
        if (scrolled !== 0) {
          drag.startY -= scrolled;
          this._applyDragOffset(drag);
        }
      }

      this._scrollRaf = requestAnimationFrame(tick);
    };

    this._scrollRaf = requestAnimationFrame(tick);
  },

  _stopAutoScroll() {
    if (this._scrollRaf !== null) {
      cancelAnimationFrame(this._scrollRaf);
      this._scrollRaf = null;
    }
  },

  _finishDrag(cancelled) {
    const drag = this._drag;
    if (!drag) return;

    document.removeEventListener("pointermove", drag.onMove);
    document.removeEventListener("pointerup", drag.onEnd);
    document.removeEventListener("pointercancel", drag.onEnd);
    this._stopAutoScroll();

    if (drag.handle?.hasPointerCapture?.(drag.pointerId)) {
      try {
        drag.handle.releasePointerCapture(drag.pointerId);
      } catch { }
    }

    this._drag = null;
    const { container, item, items, startIndex, targetIndex, slotHeight, onReorder } = drag;

    if (cancelled || targetIndex === startIndex) {
      item.style.transition = "transform 0.15s ease-out";
      item.style.transform = "";
      setTimeout(() => {
        this._cleanupStyles(container, items);
      }, 150);
      return;
    }

    const finalShift = (targetIndex - startIndex) * slotHeight;
    item.style.transition = "transform 0.15s cubic-bezier(0.2, 0, 0, 1)";
    item.style.transform = `translateY(${finalShift}px)`;

    setTimeout(() => {
      this._cleanupStyles(container, items);
      if (typeof onReorder === "function") {
        onReorder(startIndex, targetIndex);
      }
    }, 150);
  },

  _cleanupStyles(container, items) {
    if (items) {
      items.forEach((sibling) => {
        sibling.classList.remove("is-dragging");
        sibling.style.transform = "";
        sibling.style.transition = "";
      });
    }
    container?.classList.remove("is-dragging-active");
  },

  cancel() {
    if (this._drag) {
      this._finishDrag(true);
    }
  }
};

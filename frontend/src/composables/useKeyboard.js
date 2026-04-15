import { onMounted, onUnmounted } from 'vue';

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditableTarget(target) {
  if (!target) return false;
  if (INPUT_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Bind a set of keyboard shortcuts while the owning component is mounted.
 *
 * @param {Record<string, (event: KeyboardEvent) => void>} bindings
 *   Key format: "c", "Escape", "mod+k" (mod = Ctrl or Meta), "shift+c"
 *   Shortcuts are ignored while the user is typing in an input / textarea,
 *   unless explicitly prefixed with "!" (e.g. "!Escape").
 */
export function useKeyboard(bindings) {
  function handler(event) {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('mod');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    parts.push(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    const combo = parts.join('+');

    const forced = `!${combo}`;
    if (bindings[forced]) {
      bindings[forced](event);
      return;
    }
    if (isEditableTarget(event.target)) return;

    if (bindings[combo]) {
      bindings[combo](event);
    }
  }

  onMounted(() => window.addEventListener('keydown', handler));
  onUnmounted(() => window.removeEventListener('keydown', handler));
}

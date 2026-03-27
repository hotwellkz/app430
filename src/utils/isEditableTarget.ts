export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  // direct editable elements
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled;
  }

  // contenteditable containers and custom textbox-like controls
  const editableAncestor = target.closest(
    '[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"]'
  );
  if (editableAncestor) return true;

  // nested inside input-like wrappers
  const nativeAncestor = target.closest('input, textarea');
  if (nativeAncestor instanceof HTMLInputElement || nativeAncestor instanceof HTMLTextAreaElement) {
    return !nativeAncestor.readOnly && !nativeAncestor.disabled;
  }

  return false;
}


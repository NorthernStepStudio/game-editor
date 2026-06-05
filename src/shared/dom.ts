/**
 * Helper to create an element with classes and attributes.
 */
export function createEl<T extends HTMLElement>(tag: string, className?: string, props?: Partial<T>): T {
  const el = document.createElement(tag) as T;
  if (className) el.className = className;
  if (props) Object.assign(el, props);
  return el;
}

/**
 * Safely get an element by ID or throw.
 */
export function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element with id "${id}" not found.`);
  return el as T;
}

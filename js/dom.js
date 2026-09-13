/** Tiny DOM helpers. Text always goes through textContent — never innerHTML. */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {string} tag
 * @param {Record<string, unknown>} props `class`, `text`, `dataset`, `on*` handlers and attributes
 * @param {Node|string|Array<Node|string|null>|null} children
 */
export function el(tag, props = {}, children = null) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') throw new Error('el() does not accept raw HTML');
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }

  if (children !== null && children !== undefined) {
    for (const child of Array.isArray(children) ? children : [children]) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child);
    }
  }

  return node;
}

/** An icon from the inline sprite in index.html. */
export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${name}`);
  svg.appendChild(use);

  return svg;
}

/** Square icon-only button with a required accessible name. */
export function iconButton({ iconName, label, className = 'icon-btn', onClick }) {
  return el('button', { class: className, type: 'button', 'aria-label': label, title: label, onClick }, icon(iconName));
}

/** Labelled button with a leading icon. */
export function button({ label, iconName, className = 'btn', onClick, type = 'button' }) {
  return el(
    'button',
    { class: className, type, onClick },
    [iconName ? icon(iconName) : null, el('span', { text: label })],
  );
}

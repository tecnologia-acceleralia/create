/**
 * Utilidades para sanitización de HTML
 * Elimina código malicioso pero permite HTML seguro para contenido enriquecido
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Configuración de sanitización para campos HTML de contenido (description_html, intro_html)
 * Permite HTML seguro para contenido enriquecido pero elimina scripts y código malicioso
 */
const CONTENT_HTML_OPTIONS = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'strike', 'del',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span',
    'hr', 'hr',
    'sub', 'sup',
    'iframe', // Para videos embebidos (YouTube, etc.)
    'style', // Para estilos CSS embebidos en el contenido
    'section', // Para secciones con clases como .uic-task
    'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g', 'defs', 'use' // Para iconos SVG inline
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel', 'class'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'class', 'style'],
    'iframe': ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title', 'class'],
    'div': ['class'],
    'span': ['class', 'aria-hidden'],
    'svg': ['xmlns', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'class', 'xmlns:xlink'],
    'path': ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
    'circle': ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
    'rect': ['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width'],
    'line': ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
    'polyline': ['points', 'fill', 'stroke', 'stroke-width'],
    'polygon': ['points', 'fill', 'stroke', 'stroke-width'],
    'ellipse': ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width'],
    'g': ['fill', 'stroke', 'stroke-width'],
    'p': ['class'],
    'h1': ['class'],
    'h2': ['class'],
    'h3': ['class'],
    'h4': ['class'],
    'h5': ['class'],
    'h6': ['class'],
    'table': ['class'],
    'td': ['class', 'colspan', 'rowspan'],
    'th': ['class', 'colspan', 'rowspan'],
    'section': ['class'], // Para secciones con clases como .uic-task
    'style': ['type'] // Para tags <style>
  },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesByTag: {
    'img': ['http', 'https', 'data'],
    'iframe': ['http', 'https']
  },
  allowedIframeHostnames: [
    'www.youtube.com',
    'youtube.com',
    'youtu.be',
    'www.youtu.be',
    'player.vimeo.com',
    'vimeo.com'
  ],
  // Permitir estilos inline solo para casos específicos (se puede restringir más)
  allowedStyles: {
    '*': {
      'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
      'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      'font-size': [/^\d+(?:px|em|rem|%)$/],
      'font-weight': [/^normal$/, /^bold$/, /^\d+$/],
      'font-style': [/^normal$/, /^italic$/],
      'text-decoration': [/^none$/, /^underline$/, /^line-through$/],
      'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
      'margin': [/^\d+(?:px|em|rem|%)$/],
      'padding': [/^\d+(?:px|em|rem|%)$/]
    },
    'img': {
      'width': [/^\d+(?:px|em|rem|%)$/],
      'max-width': [/^\d+(?:px|em|rem|%)$/],
      'height': [/^(?:auto|\d+(?:px|em|rem|%)?)$/],
      'object-fit': [/^(?:contain|cover|fill|none|scale-down)$/]
    }
  },
  // Transformar atributos para seguridad adicional
  transformTags: {
    'a': (tagName, attribs) => {
      // Asegurar que los enlaces externos tengan target="_blank" y rel="noopener noreferrer"
      if (attribs.href && !attribs.href.startsWith('#')) {
        attribs.target = attribs.target || '_blank';
        attribs.rel = 'noopener noreferrer';
      }
      return { tagName, attribs };
    }
  },
  // Eliminar scripts, estilos peligrosos, eventos inline, etc.
  disallowedTagsMode: 'discard'
};

/**
 * Sanitiza un string HTML eliminando código malicioso
 * @param {string|null|undefined} html - HTML a sanitizar
 * @returns {string|null} HTML sanitizado o null si está vacío
 */
export function sanitizeHtmlContent(html) {
  if (html === null || html === undefined) {
    return null;
  }

  if (typeof html !== 'string') {
    return null;
  }

  const trimmed = html.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Sanitizar el HTML
  const sanitized = sanitizeHtml(trimmed, CONTENT_HTML_OPTIONS);

  // Si después de sanitizar está vacío, retornar null
  return sanitized.trim().length > 0 ? sanitized : null;
}

/**
 * Sanitiza un objeto multiidioma con campos HTML
 * @param {object|null|undefined} multilingualHtml - Objeto con campos HTML por idioma
 * @returns {object|null} Objeto sanitizado o null si está vacío
 */
export function sanitizeMultilingualHtml(multilingualHtml) {
  if (multilingualHtml === null || multilingualHtml === undefined) {
    return null;
  }

  if (typeof multilingualHtml === 'string') {
    // Si es string, sanitizar y convertir a objeto multiidioma
    const sanitized = sanitizeHtmlContent(multilingualHtml);
    return sanitized ? { es: sanitized } : null;
  }

  if (typeof multilingualHtml === 'object' && !Array.isArray(multilingualHtml)) {
    const sanitized = {};
    for (const [lang, content] of Object.entries(multilingualHtml)) {
      if (content && typeof content === 'string') {
        const cleaned = sanitizeHtmlContent(content);
        if (cleaned) {
          sanitized[lang] = cleaned;
        }
      }
    }
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  return null;
}


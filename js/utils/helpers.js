// js/utils/helpers.js

/**
 * Convierte texto en formato básico de Markdown a etiquetas HTML seguras.
 * @export
 */
export function formatMarkdownText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\n/g, '<br>');
}
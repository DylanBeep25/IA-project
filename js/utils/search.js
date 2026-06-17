// js/utils/search.js
import { dbTableros } from '../data/tableros.js';
import { dbSinonimos } from '../data/sinonimos.js';

/**
 * Analiza un texto de entrada y devuelve los 2 tableros con mayor puntuación
 * basándose en tokens y en el diccionario de sinónimos.
 * @export
 */
export function getLocalRecommendations(prompt) {
  let query = prompt.toLowerCase();

  // Aplicar diccionario de sinónimos
  dbSinonimos.forEach(sin => {
    if (query.includes(sin.termino.toLowerCase())) {
      query += " " + sin.significado.toLowerCase();
    }
  });

  const tokens = query.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return [];

  const scored = dbTableros.map(tab => {
    let score = 0;

    // Sistema de puntaje por relevancia
    tokens.forEach(token => {
      if (tab.nombre.toLowerCase().includes(token)) score += 20;
      if (tab.codigo.toLowerCase().includes(token)) score += 25;
      if (tab.pais.toLowerCase().includes(token)) score += 15;
      if (tab.descripcion.toLowerCase().includes(token)) score += 8;
      if (tab.keywords.some(k => k.toLowerCase().includes(token))) score += 5;
      if (tab.preguntas.some(p => p.toLowerCase().includes(token))) score += 4;
      if (tab.kpis.some(k => k.name.toLowerCase().includes(token))) score += 6;
    });

    return { tab, score };
  });

  // 1. Filtrar los que tengan coincidencia y ordenarlos de mayor a menor puntaje
  const resultadoOrdenado = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (resultadoOrdenado.length === 0) return [];
  if (resultadoOrdenado.length === 1) return [resultadoOrdenado[0].tab];

  const scorePrimero = resultadoOrdenado[0].score;
  const scoreSegundo = resultadoOrdenado[1].score;
  const diferenciaDiferencial = scorePrimero - scoreSegundo;

  // 💡 REGLA 1: Si hay un empate matemático exacto (diferencia es 0), se muestran ambos de forma obligatoria.
  if (diferenciaDiferencial === 0) {
    return [resultadoOrdenado[0].tab, resultadoOrdenado[1].tab];
  }

  // 💡 REGLA 2: Si la diferencia de puntos es muy estrecha (menor a 15 puntos), 
  // significa que ambos tableros compiten por la misma intención de búsqueda. ¡Mostramos ambos!
  if (diferenciaDiferencial < 15) {
    return [resultadoOrdenado[0].tab, resultadoOrdenado[1].tab];
  }

  // 💡 REGLA 3: Solo si el primero tiene una ventaja contundente (un 50% o más de puntos que el segundo),
  // asumimos que es una búsqueda ultraespecífica y se muestra una sola tarjeta.
  if (scorePrimero >= scoreSegundo * 1.5) {
    return [resultadoOrdenado[0].tab];
  }

  // Por defecto, si no cumple los filtros de descarte, muestra un máximo de 2
  return [resultadoOrdenado[0].tab, resultadoOrdenado[1].tab];
}
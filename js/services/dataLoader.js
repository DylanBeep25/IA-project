// js/services/dataLoader.js

const URL_CSV_TABLEROS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS0bEWnLLUbdN1jBqgOhYHgfIU2sKY2sy9wmEiUE7irJoIe80U0adVYOYSopogkZhkNnF-67I7hsTTC/pub?gid=367776389&single=true&output=csv";
const URL_CSV_SINONIMOS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS0bEWnLLUbdN1jBqgOhYHgfIU2sKY2sy9wmEiUE7irJoIe80U0adVYOYSopogkZhkNnF-67I7hsTTC/pub?gid=0&single=true&output=csv";

/**
 * Lector de CSV robusto: Soporta saltos de línea y comas dentro de celdas con comillas (crucial para JSON)
 */
function parsearCSVCompleto(text) {
  let lineas = [];
  let fila = [""];
  let dentroDeComillas = false;

  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    let proximo = text[i + 1];

    if (c === '"') {
      if (dentroDeComillas && proximo === '"') { 
        fila[fila.length - 1] += '"'; i++; 
      } else { 
        dentroDeComillas = !dentroDeComillas; 
      }
    } else if (c === ',' && !dentroDeComillas) {
      fila.push('');
    } else if ((c === '\r' || c === '\n') && !dentroDeComillas) {
      if (c === '\r' && proximo === '\n') { i++; }
      lineas.push(fila);
      fila = [''];
    } else {
      fila[fila.length - 1] += c;
    }
  }
  if (fila.length > 1 || fila[0] !== '') { lineas.push(fila); }
  return lineas;
}

/**
 * Descarga y procesa el CSV de Tableros desde Google Sheets.
 * @export
 */
export async function cargarTablerosDesdeSheets() {
  const response = await fetch(URL_CSV_TABLEROS);
  const dataText = await response.text();
  
  // Procesamos el documento entero con el nuevo lector robusto
  const todasLasFilas = parsearCSVCompleto(dataText);
  if (todasLasFilas.length === 0) return [];

  // Estandarizamos los encabezados de la fila 0
  const encabezados = todasLasFilas[0].map(enc => {
    let limpio = enc.trim().toLowerCase();
    if (limpio === 'codigo') return 'codigo';
    if (limpio === 'nombre') return 'nombre';
    if (limpio === 'pais') return 'pais';
    if (limpio === 'area') return 'area';
    if (limpio === 'descripcion') return 'descripcion';
    if (limpio === 'url') return 'url';
    if (limpio === 'responsable') return 'responsable';
    if (limpio === 'frecuencia') return 'frecuencia';
    if (limpio === 'preguntas') return 'preguntas';
    if (limpio === 'cuando usar' || limpio === 'cuandousar') return 'cuandoUsar';
    if (limpio === 'cuando no usar' || limpio === 'cuandonousar') return 'cuandoNoUsar';
    if (limpio === 'keywords') return 'keywords';
    if (limpio === 'kpis') return 'kpis';
    if (limpio === 'resumen ia' || limpio === 'resumenia') return 'resumenIA';
    return limpio;
  });
  
  const tableros = [];
  
  for (let i = 1; i < todasLasFilas.length; i++) {
    const valores = todasLasFilas[i];
    if (valores.length < encabezados.length) continue;
    
    const filaObjeto = {};
    encabezados.forEach((encabezado, index) => {
      let valorOriginal = valores[index] ? valores[index].trim() : "";
      
      // 1. Campos tipo Lista (separados por '|')
      if (['preguntas', 'cuandoUsar', 'cuandoNoUsar', 'keywords'].includes(encabezado)) {
        filaObjeto[encabezado] = valorOriginal !== "" ? valorOriginal.split('|').map(item => item.trim()) : [];
      } 
      // 2. Campo Complejo KPIs (JSON plano en la celda)
      // js/services/dataLoader.js — Reemplaza ÚNICAMENTE el bloque "else if (encabezado === 'kpis')"

      // 2. Validar campo complejo de KPIs (Procesador tolerante a JSON laxo o JS plano)
      else if (encabezado === 'kpis') {
        if (valorOriginal !== "" && (valorOriginal.startsWith('[') || valorOriginal.startsWith('{'))) {
          try {
            // Evaluador flexible: procesa JSON clásico y también declaraciones directas de objetos JS
            let stringlimpio = valorOriginal.replace(/""/g,'"')
            let parseoFlexible = new Function(`return ${stringlimpio};`);
            filaObjeto[encabezado] = parseoFlexible();
          } catch (e) {
            console.error(`Error de parseo JSON flexible en fila ${i} para KPIs:`, e);
            filaObjeto[encabezado] = [];
          }
        } else {
          filaObjeto[encabezado] = []; 
        }
      }
      // 3. Textos normales
      else {
        filaObjeto[encabezado] = valorOriginal;
      }
    });
    
    // 💡 FILTRO MEJORADO: Ocultamos el tablero si está incompleto 
    // (Falta código, falta nombre o no tiene preguntas asignadas aún)
    if (!filaObjeto.codigo || !filaObjeto.nombre || filaObjeto.preguntas.length === 0) {
      continue; 
    }
    
    tableros.push(filaObjeto);
  }
  
  return tableros;
}

/**
 * Descarga y procesa el CSV de Sinónimos desde Google Sheets.
 * @export
 */
export async function cargarSinonimosDesdeSheets() {
  const response = await fetch(URL_CSV_SINONIMOS);
  const dataText = await response.text();
  
  const todasLasFilas = parsearCSVCompleto(dataText);
  const sinonimos = [];
  
  for (let i = 1; i < todasLasFilas.length; i++) {
    const valores = todasLasFilas[i];
    if (valores.length < 2) continue;
    
    sinonimos.push({
      termino: valores[0].trim(),
      significado: valores[1].trim()
    });
  }
  
  return sinonimos;
}
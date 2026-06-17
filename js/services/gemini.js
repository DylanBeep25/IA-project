// js/services/gemini.js

/**
 * Realiza peticiones HTTP con una estrategia de Exponential Backoff si falla.
 */
async function fetchWithRetry(url, options, retries = 5, delay = 1000) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Se conecta a la API de Gemini 2.5 Flash para obtener una respuesta estructurada.
 * @export
 */
export async function consultarGemini(prompt, apiKey, dbTableros, dbSinonimos) {
  const systemInstruction = `
    Eres el "Asesor Inteligente de Tableros (IAN-Agent)", un asistente experto diseñado para guiar a los usuarios a encontrar el tablero de interés o directorio analítico ideal según sus necesidades de negocio.
    
    Tienes acceso completo al siguiente Directorio de Tableros Comerciales:
    ${JSON.stringify(dbTableros, null, 2)}
    
    También cuentas con este glosario de sinónimos para entender su lenguaje coloquial:
    ${JSON.stringify(dbSinonimos, null, 2)}
    
    REGLAS CRÍTICAS DE RESPUESTA Y FORMATO:
    1. PROHIBIDO INCLUIR ENLACES DIRECTOS O URLS: No agregues links de SharePoint ni texto de hipervínculos (ej. [Accede aquí](...)). La interfaz ya renderiza tarjetas interactivas para eso.
    2. PROHIBIDO USAR VIÑETAS O ASTERISCOS (* o •): Redacta tus respuestas en párrafos limpios y corridos. No uses listas con viñetas.
    3. RESPUESTAS ULTRA-RESUMIDAS: Sé breve. Da un comentario introductorio muy corto y describe puntualmente el tablero o tableros que estás recomendando.
    4. CONTROL DE TEMAS INEXISTENTES O FUERA DE CONTEXTO:
       - Si te piden un tablero que NO EXISTE en el directorio (ej. "precios Colombia", "importaciones de México"), indica explícitamente que no posees ese tablero en la base de datos, pero recomiéndales amigablemente la alternativa más cercana que sí exista en tu directorio.
       - Si el usuario dice palabras al azar, cosas sin sentido o temas que no tienen absolutamente nada que ver con el negocio (ej. "cama", "videojuegos", "fútbol"), responde EXACTAMENTE con este mensaje: "Como tu asistente estoy preparado para indicarte tableros, perdona si no tengo una respuesta para eso." y NO menciones ni recomiendes ningún tablero.
    5. Nunca compartas el código del tablero ejp. (MKT001)
  `;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ 
        parts: [{ text: prompt }] 
      }],
      systemInstruction: { 
        parts: [{ text: systemInstruction }] 
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error (${response.status}): ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No logré estructurar una sugerencia en este momento. Intenta de nuevo.";
}
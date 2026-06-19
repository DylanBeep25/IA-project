// js/app.js

// 1. Importaciones de Servicios y Utilidades
import { cargarTablerosDesdeSheets, cargarSinonimosDesdeSheets } from './services/dataLoader.js';
import { consultarGemini } from './services/gemini.js';
import { getLocalRecommendations } from './utils/search.js';
import { formatMarkdownText } from './utils/helpers.js';

// 2. Variables de estado globales dinámicas
let dbTableros = [];
let dbSinonimos = [];
let activeCountryFilter = 'Todos';

// Mapeo oficial de fragmentos HTML (Se eliminó la vista de análisis)
const VISTAS = {
  home: './views/home.html',
  tableros: './views/tableros.html',
  agente: './views/agente.html',
  glosario: './views/glosario.html'
};

// 3. Inicialización de la Aplicación
window.onload = async function() {
  try {
    // Mensaje de carga inicial en el contenedor estructural principal
    document.getElementById('main-content').innerHTML = `
      <div class="flex flex-col items-center justify-center h-[70vh] space-y-3">
        <div class="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-slate-500 text-sm">Sincronizando directorios analíticos desde la nube...</p>
      </div>
    `;
    
    // Descargar datos en paralelo desde Google Sheets
    const [tablerosDescargados, sinonimosDescargados] = await Promise.all([
      cargarTablerosDesdeSheets(),
      cargarSinonimosDesdeSheets()
    ]);
    
    dbTableros = tablerosDescargados;
    dbSinonimos = sinonimosDescargados;
    
    // Inyección de la estructura base de las fichas técnicas en memoria DOM
    const modalResponse = await fetch('./views/modal-detalles.html');
    document.getElementById('modal-container').innerHTML = await modalResponse.text();

    // Posicionar la navegación inicial en la vista de bienvenida
    await window.switchView('home');
    
  } catch (error) {
    console.error("Error crítico inicializando los datos de la app:", error);
    document.getElementById('main-content').innerHTML = `
      <div class="flex flex-col items-center justify-center h-[70vh] text-center p-6">
        <p class="text-red-500 font-bold text-sm">⚠️ Error al conectar con la base de datos de Google Sheets.</p>
        <p class="text-xs text-slate-400 mt-1">Por favor verifica tu conexión a internet o la publicación de tus tablas.</p>
      </div>
    `;
  }
};

// 4. Control de Vistas (Navegación del Sidebar Dinámica)
window.switchView = async function(viewId) {
  const mainContent = document.getElementById('main-content');
  const rutaVista = VISTAS[viewId];
  
  if (!rutaVista) return;

  try {
    const response = await fetch(rutaVista);
    mainContent.innerHTML = await response.text();
    
    // Resetear clases visuales de los botones en el sidebar
    document.querySelectorAll('aside nav button').forEach(btn => {
      btn.className = "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-900";
    });
    
    const activeBtn = document.getElementById(`btn-nav-${viewId}`);
    if (activeBtn) {
      activeBtn.className = "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all bg-brand-50 text-brand-700";
    }

    // Ejecución de renderizadores según el nodo activo inyectado en pantalla
    if (viewId === 'tableros') {
      renderTableros(dbTableros);
    } else if (viewId === 'glosario') {
      renderGlossary();
    } else if (viewId === 'agente') {
      const chatForm = document.getElementById('chat-form');
      if (chatForm) chatForm.addEventListener('submit', handleSendChat);
    }

    lucide.createIcons();

  } catch (error) {
    console.error(`Error cargando la vista dinámica [${viewId}]:`, error);
    mainContent.innerHTML = `<p class="text-red-500 p-6">No se pudo montar el fragmento visual de forma correcta.</p>`;
  }
};

// 5. Renderizado de Tarjetas en el Grid Principal
function renderTableros(tableros) {
  const grid = document.getElementById('tableros-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (tableros.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-3 bg-white border border-slate-200 rounded-xl">
        <div class="p-3 bg-slate-100 rounded-full text-slate-400">
          <i data-lucide="info" class="w-10 h-10"></i>
        </div>
        <p class="text-slate-500 font-medium text-sm">No encontramos tableros que coincidan con tus criterios.</p>
        <button onclick="resetSearch()" class="text-xs font-bold text-brand-600 hover:underline">Reestablecer todos los filtros</button>
      </div>
    `;
    document.getElementById('tableros-count').innerText = "Ningún tablero coincide";
    lucide.createIcons();
    return;
  }

  tableros.forEach(tab => {
    let bandera = "";
    if (tab.pais === "Guatemala") bandera = "🇬🇹";
    else if (tab.pais === "El Salvador") bandera = "🇸🇻";
    else if (tab.pais === "Honduras") bandera = "🇭🇳";

    const card = document.createElement('div');
    card.className = "bg-white rounded-xl border border-slate-200 p-5 shadow-premium hover:shadow-hover hover:border-brand-500/50 transition-all flex flex-col justify-between group cursor-pointer";
    card.onclick = () => openDetails(tab.codigo);

    card.innerHTML = `
      <div class="space-y-3.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-extrabold tracking-wider uppercase text-slate-400">${tab.codigo}</span>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
            <span>${bandera}</span>
            <span>${tab.pais}</span>
          </span>
        </div>

        <div>
          <h3 class="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">${tab.nombre}</h3>
          <p class="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-3">${tab.descripcion}</p>
        </div>

        <div class="flex flex-wrap gap-1 pt-1">
          ${
            (tab.kpis && Array.isArray(tab.kpis))
              ? tab.kpis.slice(0, 3).map(k => `
                <span class="text-[10px] font-semibold bg-indigo-50/50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100/30">${k.name}</span>
              `).join('')
              : ''
          }
          ${
            (tab.kpis && Array.isArray(tab.kpis) && tab.kpis.length > 3) 
              ? `<span class="text-[10px] font-bold text-slate-400">+${tab.kpis.length - 3}</span>` 
              : ''
          }
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
        <span class="text-slate-400 flex items-center gap-1">
          <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          <span>${tab.frecuencia}</span>
        </span>
        <span class="text-brand-600 font-bold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
          <span>Ficha Técnica</span>
          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </span>
      </div>
    `;
    grid.appendChild(card);
  });

  document.getElementById('tableros-count').innerText = `Mostrando ${tableros.length} ${tableros.length === 1 ? 'tablero' : 'tableros'} ${tableros.length === dbTableros.length ? 'disponibles' : 'filtrados'}`;
  lucide.createIcons();
}

// 6. Lógica de Filtrado y Búsqueda de Tarjetas
window.filterTableros = function() {
  let query = document.getElementById('search-input').value.toLowerCase().trim();
  
  dbSinonimos.forEach(sin => {
    if (query.includes(sin.termino.toLowerCase())) {
      query += " " + sin.significado.toLowerCase();
    }
  });

  const tokens = query.split(/\s+/).filter(t => t.length > 0);

  const filtered = dbTableros.filter(tab => {
    if (activeCountryFilter !== 'Todos' && tab.pais !== activeCountryFilter) {
      return false;
    }
    if (tokens.length === 0) return true;

    return tokens.some(token => {
      return tab.nombre.toLowerCase().includes(token) ||
             tab.codigo.toLowerCase().includes(token) ||
             tab.pais.toLowerCase().includes(token) ||
             tab.descripcion.toLowerCase().includes(token) ||
             tab.keywords.some(k => k.toLowerCase().includes(token)) ||
             tab.preguntas.some(p => p.toLowerCase().includes(token)) ||
             tab.kpis.some(k => k.name.toLowerCase().includes(token));
    });
  });

  renderTableros(filtered);
};

window.filterByCountry = function(country) {
  activeCountryFilter = country;
  
  document.querySelectorAll('.btn-country').forEach(btn => {
    btn.className = "btn-country px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all";
  });
  const activeBtn = document.getElementById(`filter-country-${country}`);
  if (activeBtn) {
    activeBtn.className = "btn-country active px-3 py-1 text-xs font-semibold rounded-full bg-brand-600 text-white transition-all";
  }

  window.filterTableros();
};

window.resetSearch = function() {
  document.getElementById('search-input').value = '';
  window.filterByCountry('Todos');
};

// 7. Modales de Detalles e Inyección de Fichas Técnicas
// js/app.js — Sección 7: Modales de Detalles Blindado

window.openDetails = async function(codigo) {
  const tab = dbTableros.find(t => t.codigo === codigo);
  if (!tab) return;

  // 💡 VERIFICACIÓN DE DEFENSIVA: ¿El modal ya está montado en el DOM?
  let modalCodeEl = document.getElementById('modal-code');
  
  // Si no existe, lo inyectamos de emergencia de forma asíncrona para que no truene
  if (!modalCodeEl) {
    try {
      const modalResponse = await fetch('./views/modal-detalles.html');
      document.getElementById('modal-container').innerHTML = await modalResponse.text();
      // Volvemos a capturar el elemento recién inyectado
      modalCodeEl = document.getElementById('modal-code');
    } catch (err) {
      console.error("Error crítico cargando la estructura del modal de emergencia:", err);
      return;
    }
  }

  // Si por alguna razón extrema sigue sin existir, salimos limpiamente para evitar el crash
  if (!modalCodeEl) return;

  // Ahora sí, inyección de datos 100% segura libre de Null Pointer Errors
  modalCodeEl.innerText = tab.codigo;
  document.getElementById('modal-title').innerText = tab.nombre;
  document.getElementById('modal-pais').innerText = tab.pais;
  document.getElementById('modal-area').innerText = tab.area;
  document.getElementById('modal-frecuencia').innerText = tab.frecuencia;
  document.getElementById('modal-responsable').innerText = tab.responsable;
  document.getElementById('modal-descripcion').innerText = tab.descripcion;
  
  const urlElement = document.getElementById('modal-url');
  if (urlElement) urlElement.href = tab.url;

  // Inyección elástica de listas
  const cuandoUsarEl = document.getElementById('modal-cuando-usar');
  if (cuandoUsarEl) cuandoUsarEl.innerHTML = tab.cuandoUsar.map(item => `<li>${item}</li>`).join('');
  
  const cuandoNoUsarEl = document.getElementById('modal-cuando-no-usar');
  if (cuandoNoUsarEl) cuandoNoUsarEl.innerHTML = tab.cuandoNoUsar.map(item => `<li>${item}</li>`).join('');

  const preguntasEl = document.getElementById('modal-preguntas');
  if (preguntasEl) {
    preguntasEl.innerHTML = tab.preguntas.map(preg => `
      <div class="flex items-start space-x-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
        <span class="text-brand-500 font-bold">¿</span>
        <span>${preg.replace(/^¿/, '')}</span>
      </div>
    `).join('');
  }

  const kpiTableEl = document.getElementById('modal-kpi-table');
  if (kpiTableEl) {
    kpiTableEl.innerHTML = tab.kpis.map(k => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/50">
        <td class="p-2.5 font-bold text-slate-700 whitespace-nowrap">${k.name}</td>
        <td class="p-2.5 text-slate-500">${k.definition}</td>
      </tr>
    `).join('');
  }

  const tagsEl = document.getElementById('modal-tags');
  if (tagsEl) {
    tagsEl.innerHTML = tab.keywords.map(kw => `
      <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">${kw}</span>
    `).join('');
  }

  // Mostrar el contenedor global del modal
  const detailsModal = document.getElementById('details-modal');
  if (detailsModal) detailsModal.classList.remove('hidden');
  
  lucide.createIcons();
};

window.closeModal = function() {
  document.getElementById('details-modal').classList.add('hidden');
};

// 8. Renderizado del Glosario Dinámico
function renderGlossary() {
  const kpiTable = document.getElementById('kpi-glossary-table');
  const synonymTable = document.getElementById('synonym-glossary-table');
  
  const uniqueKpis = [];

  if (dbTableros && Array.isArray(dbTableros)) {
    dbTableros.forEach(tab => {
      if (tab.kpis && Array.isArray(tab.kpis)) {
        tab.kpis.forEach(k => {
          if (!uniqueKpis.some(u => u.name.toLowerCase() === k.name.toLowerCase())) {
            uniqueKpis.push(k);
          }
        });
      }
    });
  }

  if (kpiTable) {
    kpiTable.innerHTML = uniqueKpis.length > 0 
      ? uniqueKpis.map(k => `
          <tr class="border-b border-slate-200 hover:bg-slate-50 transition-colors">
            <td class="p-3 font-bold text-slate-800">${k.name}</td>
            <td class="p-3 text-slate-500 leading-normal">${k.definition}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="2" class="p-3 text-slate-400 text-center">No hay KPIs disponibles</td></tr>';
  }

  if (synonymTable && dbSinonimos && Array.isArray(dbSinonimos)) {
    synonymTable.innerHTML = dbSinonimos.map(s => `
      <tr class="border-b border-slate-200 hover:bg-slate-50 transition-colors">
        <td class="p-3 font-bold text-slate-800">${s.termino}</td>
        <td class="p-3 text-slate-500 leading-normal">${s.significado}</td>
      </tr>
    `).join('');
  }
}

// 9. Agente IA — Lógica Interactiva (Chatbot)
window.clearChat = function() {
  document.getElementById('chat-messages').innerHTML = `
    <div class="flex items-start space-x-3 max-w-[85%]">
      <div class="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 flex-shrink-0">
        <i data-lucide="bot" class="w-5 h-5"></i>
      </div>
      <div class="bg-indigo-50 text-slate-800 p-4 rounded-2xl shadow-sm border border-indigo-100/50 text-sm chat-bubble-agent leading-relaxed">
        <p class="font-bold text-indigo-900 mb-1">¡Historial de asesoría limpio!</p>
        <p>Escribe tu consulta o haz click en los atajos para comenzar de nuevo a buscar tu tablero ideal.</p>
      </div>
    </div>
  `;
  lucide.createIcons();
};

window.setChatQuery = function(query) {
  document.getElementById('chat-input').value = query;
  document.getElementById('chat-input').focus();
};

function appendUserMessage(text) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = "flex items-start justify-end space-x-3 max-w-[85%] ml-auto";
  msgDiv.innerHTML = `
    <div class="bg-brand-600 text-white p-4 rounded-2xl shadow-sm text-sm chat-bubble-user leading-relaxed">
      <p>${text}</p>
    </div>
    <div class="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 flex-shrink-0 border border-brand-200">
      <i data-lucide="user" class="w-4 h-4"></i>
    </div>
  `;
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  lucide.createIcons();
}

function appendAgentMessage(text, recommendedTableros = []) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = "flex flex-col space-y-2 max-w-[90%]";
  
  let tablerosHTML = '';
  if (recommendedTableros.length > 0) {
    tablerosHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        ${recommendedTableros.map(tab => `
          <div class="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div class="flex items-center justify-between text-[10px]">
                <span class="font-extrabold text-slate-400">${tab.codigo}</span>
                <span class="font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${tab.pais}</span>
              </div>
              <h4 class="font-bold text-slate-800 text-xs mt-1.5">${tab.nombre}</h4>
              <p class="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-normal">${tab.descripcion}</p>
            </div>
            <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button onclick="openDetails('${tab.codigo}')" class="text-[11px] text-brand-600 font-bold hover:underline flex items-center gap-0.5">
                <i data-lucide="info" class="w-3.5 h-3.5"></i>
                <span>Detalles</span>
              </button>
              <a href="${tab.url}" target="_blank" class="text-[11px] bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold px-2 py-1 rounded border border-brand-200 flex items-center gap-1 transition-all">
                <span>Acceder</span>
                <i data-lucide="external-link" class="w-3 h-3"></i>
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  msgDiv.innerHTML = `
    <div class="flex items-start space-x-3">
      <div class="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 flex-shrink-0 border border-indigo-100">
        <i data-lucide="bot" class="w-5 h-5"></i>
      </div>
      <div class="bg-indigo-50/50 text-slate-800 p-4 rounded-2xl shadow-sm border border-indigo-100/30 text-sm chat-bubble-agent leading-relaxed">
        <div>${text}</div>
        ${tablerosHTML}
      </div>
    </div>
  `;
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  lucide.createIcons();
}

async function handleSendChat(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  const prompt = input.value.trim();
  if (!prompt) return;

  appendUserMessage(prompt);
  input.value = '';

  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.classList.remove('hidden');

  const apiKey = "PROCESO_LLAVE_GEMINI:";

  if (apiKey) {
    try {
      const responseText = await consultarGemini(prompt, apiKey, dbTableros, dbSinonimos);
      const localRecs = getLocalRecommendations(prompt, dbTableros, dbSinonimos);

      if (indicator) indicator.classList.add('hidden');
      appendAgentMessage(formatMarkdownText(responseText), localRecs);

    } catch (error) {
      console.error("Error detallado en la llamada de Gemini:", error);
      if (indicator) indicator.classList.add('hidden');
      runLocalAdvisor(prompt, "*(La conexión de IA falló, se activó la recomendación local enriquecida)* ");
    }
  } else {
    setTimeout(() => {
      if (indicator) indicator.classList.add('hidden');
      runLocalAdvisor(prompt);
    }, 1000);
  }
}


function runLocalAdvisor(prompt, prefijo = "") {
  // Obtenemos las recomendaciones del buscador por tokens
  const recs = getLocalRecommendations(prompt, dbTableros, dbSinonimos);

  // 💡 REGLA 4: Si el puntaje es 0 (no hay coincidencias reales, introdujo cosas al azar como "cama")
  if (recs.length === 0) {
    appendAgentMessage(`${prefijo}Como tu asistente estoy preparado para indicarte tableros, perdona si no tengo una respuesta para eso.`);
    return;
  }

  const principal = recs[0];
  
  // 💡 REGLA 1, 2 y 3: Formato resumido, en párrafos limpios, sin asteriscos ni enlaces
  let respuestaText = `${prefijo}He ubicado el directorio analítico ideal para tu consulta. Te recomiendo revisar el tablero <strong>${principal.nombre}</strong>. El mismo permite realizar el ${principal.descripcion.toLowerCase()} Es actualizado con frecuencia ${principal.frecuencia.toLowerCase()} bajo la responsabilidad del área de ${principal.responsable.toLowerCase()}.`;

  // Validar si el usuario pidió algo específico que no calza perfectamente (búsqueda débil)
  // para simular la regla de "no poseemos ese tablero pero te recomiendo este"
  let queryLimpio = prompt.toLowerCase();
  if (queryLimpio.includes('colombia') || queryLimpio.includes('mexico') || queryLimpio.includes('méxico')) {
    respuestaText = `${prefijo}Actualmente no poseemos tableros específicos para ese mercado en nuestra base de datos. Sin embargo, te sugiero utilizar el tablero <strong>${principal.nombre}</strong>, el cual te servirá como la alternativa más cercana para tu análisis de negocio.`;
  }

  // Solo si hay un segundo tablero con una correlación fuerte, se menciona muy brevemente
  if (recs.length > 1 && !queryLimpio.includes('colombia') && !queryLimpio.includes('mexico')) {
    respuestaText += `<br><br>De manera complementaria, también podría ser de tu interés el tablero de <strong>${recs[1].nombre}</strong>.`;
  }

  // Pintamos la respuesta y las tarjetas automáticas
  appendAgentMessage(respuestaText, recs);
}
// telegram-webhook/index.js
// POST /api/telegram-webhook
// Capa de integración: recibe updates de Telegram, verifica autorización,
// parsea comandos y llama a las APIs de negocio internas.

import { app } from "@azure/functions";

const ALLOWED_IDS = (process.env.TELEGRAM_ALLOWED_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowed(userId) {
  return ALLOWED_IDS.includes(String(userId));
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

const BASE_URL =
  process.env.FUNCTION_APP_URL || "http://localhost:7071";

async function api(path, options = {}) {
  const headers = {
    'x-functions-key': process.env.FUNCTIONS_KEY,
    ...(options.headers || {})
  };
  const res = await fetch(`${BASE_URL}/api/${path}`, { ...options, headers });
  return res.json();
}

// ─── Parser de comandos ───────────────────────────────────────────────────────
/**
 * Parsea: "venta Y010-1 24" | "venta Y010-1 x2 24" | "venta Y010-1 Y048-3 x2 24 11"
 * Retorna array de { modelo, cantidad, precio }
 */
function parseVenta(tokens) {
  const modelos = [];
  let i = 0;

  while (i < tokens.length && /^Y\d+-.+/i.test(tokens[i])) {
    modelos.push(tokens[i].toUpperCase());
    i++;
  }

  let cantidad = 1;
  if (i < tokens.length && /^x\d+$/i.test(tokens[i])) {
    cantidad = parseInt(tokens[i].slice(1));
    i++;
  }

  const precios = tokens.slice(i).map(Number);
  if (!precios.length || precios.some(isNaN)) return null;

  return modelos.map((m, idx) => ({
    modelo: m,
    cantidad,
    precio: precios[idx] ?? precios[0],
  }));
}

/**
 * Parsea: "compra Y048-3 x1 11.3"
 * Retorna { modelo, cantidad, precio_unidad }
 */
function parseCompra(tokens) {
  const modelo = tokens[0]?.toUpperCase();
  if (!modelo || !/^Y\d+-.+/i.test(modelo)) return null;

  let i = 1;
  let cantidad = 1;
  if (i < tokens.length && /^x\d+$/i.test(tokens[i])) {
    cantidad = parseInt(tokens[i].slice(1));
    i++;
  }
  const precio_unidad = Number(tokens[i]);
  if (isNaN(precio_unidad)) return null;

  return { modelo, cantidad, precio_unidad };
}

// ─── Formateadores de respuesta ───────────────────────────────────────────────

function fmtStock(data) {
  if (!data.ok) return `❌ ${data.error}`;

  if (data.modelos) {
    const lineas = data.modelos.map(
      (m) =>
        `  <b>${m.modelo}</b> — ${m.descripcion}\n  📦 Stock: <b>${m.stock}</b>${m.por_recibir > 0 ? ` (+${m.por_recibir} por recibir)` : ""}`
    );
    return `📋 <b>Modelos de ${data.producto}</b>\n\n${lineas.join("\n\n")}`;
  }

  return (
    `📦 <b>${data.modelo}</b>\n` +
    `${data.descripcion}\n\n` +
    `Stock: <b>${data.stock}</b>` +
    (data.por_recibir > 0 ? `  (+${data.por_recibir} por recibir)` : "")
  );
}

function fmtModelos(data) {
  if (!data.ok) return `❌ ${data.error}`;
  const lineas = data.modelos.map(
    (m) => `  <b>${m.cod_modelo}</b> — ${m.modelo_diseño} [${m.talla}]`
  );
  return `📋 <b>Modelos de ${data.producto}</b>\n\n${lineas.join("\n")}`;
}

function fmtBuscar(data) {
  if (!data.ok) return `❌ ${data.error}`;
  if (!data.total) return `🔍 Sin resultados para "<b>${data.query}</b>"`;
  const lineas = data.resultados.map(
    (p) => `  <b>${p.codigo}</b> — ${p.nombre}`
  );
  return `🔍 <b>${data.total} resultado(s) para "${data.query}"</b>\n\n${lineas.join("\n")}`;
}

function fmtInventarioBajo(data) {
  if (!data.ok) return `❌ ${data.error}`;
  if (!data.total) return `✅ Todo el stock está por encima del umbral (>${data.umbral})`;

  const MAX = 30;
  const mostrados = data.items.slice(0, MAX);
  const hayMas = data.total > MAX;

  const lineas = mostrados.map((it) => {
    const porRecibir = it.por_recibir > 0 ? ` (+${it.por_recibir} 📦)` : "";
    return `${it.stock === 0 ? "🔴" : "🟡"} <b>${it.modelo}</b> — Stock: <b>${it.stock}</b>${porRecibir}`;
  });

  return (
    `⚠️ <b>${data.total} modelo(s) con stock ≤ ${data.umbral}</b>\n\n` +
    lineas.join("\n") +
    (hayMas ? `\n\n<i>...y ${data.total - MAX} más. Usa umbral menor para filtrar.</i>` : "")
  );
}

function fmtVenta(data, items) {
  if (!data.ok) return `❌ ${data.error}`;
  const resumen = items.map((it) => `  ✔ ${it.modelo} x${it.cantidad} → S/${it.precio}`).join("\n");
  return `✅ <b>Venta registrada</b> (${data.fecha})\n\n${resumen}`;
}

function fmtCompra(data) {
  if (!data.ok) return `❌ ${data.error}`;
  return (
    `✅ <b>Compra registrada</b> (${data.fecha})\n\n` +
    `  ${data.modelo} x${data.cant}\n` +
    `  P.Unit: S/${data.pUnit}  —  P.Total: S/${data.pTotal}`
  );
}

const AYUDA = `
🤖 <b>YeyuAgente — Comandos</b>

<b>Consultas</b>
  <code>stock Y010-1</code>  → stock de un modelo
  <code>stock Y010</code>    → todos los modelos del producto
  <code>modelos Y010</code>  → lista cod_modelo + descripción
  <code>buscar medias</code> → búsqueda por nombre
  <code>inventario</code>    → modelos con stock bajo en 0
  <code>inventario compras</code>  → stock + por recibir (para compras)
  <code>inventario 1</code>    → modelos con stock 0 o 1
  <code>ventas 07-26</code>         → resumen de ventas del mes
  <code>ventas reporte 07-26</code> → PDF detallado (URL)
  <code>ventas reporte</code>       → PDF del mes vigente
  
<b>Registros</b>
  <code>venta Y010-1 24</code>           → 1 unidad a S/24
  <code>venta Y010-1 x2 24</code>        → 2 unidades a S/24
  <code>venta Y010-1 Y048-3 x2 24 11</code> → multi-producto
  <code>compra Y048-3 x1 11.3</code>     → registra compra

<b>Ayuda</b>
  <code>ayuda</code>
`.trim();

function fmtReporteVentas(data) {
  if (!data.ok) return `❌ ${data.error}`;
  if (!data.total_unidades) return `📊 Sin ventas registradas en ${data.mes}`;

  // Agrupar por fecha + nombre_producto
  const grupos = new Map();
  for (const v of data.ventas) {
    const key = `${v.fecha}||${v.nombre_producto}`;
    if (!grupos.has(key)) {
      grupos.set(key, { fecha: v.fecha, nombre: v.nombre_producto, cantidad: 0, monto: 0 });
    }
    const g = grupos.get(key);
    g.cantidad += v.cantidad;
    g.monto = +(g.monto + v.precio).toFixed(2);
  }

  const MAX = 25;
  const lineas = [...grupos.values()].slice(0, MAX).map(
    (g) => `${g.fecha}  ${g.nombre} — x${g.cantidad}  S/${g.monto}`
  );
  const hayMas = grupos.size > MAX;

  return (
    `📊 <b>Ventas ${data.mes}</b>\n` +
    `Unidades: <b>${data.total_unidades}</b>  |  Total: <b>S/${data.total_monto}</b>\n\n` +
    lineas.join("\n") +
    (hayMas ? `\n\n<i>...y ${grupos.size - MAX} más</i>` : "")
  );
}

function fmtReportePDF(data) {
  if (!data.ok) return `❌ ${data.error}`;
  if (data.mensaje) return `📊 ${data.mensaje}`;
  const estado = data.generado ? "✅ Reporte generado" : "📎 Reporte existente";
  return `${estado} — ${data.mes}\n\n🔗 ${data.url}`;
}

// ─── Dispatcher principal ─────────────────────────────────────────────────────
async function dispatch(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "stock": {
      if (!args[0]) return "Uso: stock <modelo|producto>";
      const param = args[0].toUpperCase();
      const isModelo = param.includes("-");
      const query = isModelo ? `consultar-stock?modelo=${param}` : `consultar-stock?producto=${param}`;
      const data = await api(query);
      return fmtStock(data);
    }

    case "modelos": {
      if (!args[0]) return "Uso: modelos <producto>";
      const data = await api(`listar-modelos?producto=${args[0].toUpperCase()}`);
      return fmtModelos(data);
    }

    case "buscar": {
      const q = args.join(" ");
      if (!q) return "Uso: buscar <término>";
      const data = await api(`buscar-producto?q=${encodeURIComponent(q)}`);
      return fmtBuscar(data);
    }

    case "inventario": {
      // "inventario"         → stock real, umbral 0
      // "inventario 1"       → stock real, umbral 1
      // "inventario compras" → stock + por recibir, umbral 0
      // "inventario compras 1" → stock + por recibir, umbral 1
      const esCompras = args[0]?.toLowerCase() === "compras";
      const umbral = (esCompras ? args[1] : args[0]) ?? "0";
      const query = `inventario-bajo?umbral=${umbral}${esCompras ? "&incluir_por_recibir=true" : ""}`;
      const data = await api(query);
      return fmtInventarioBajo(data);
    }

    case "venta": {
      const items = parseVenta(args);
      if (!items) return "Formato: venta Y010-1 [x2] 24 | venta Y010-1 Y048-3 x2 24 11";
      const data = await api("registrar-venta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      return fmtVenta(data, items);
    }

    case "ventas": {
      // "ventas reporte" o "ventas reporte 07-26"
      if (args[0]?.toLowerCase() === "reporte") {
        const periodo = args[1] ?? ""; // vacío = mes vigente
        const query = periodo ? `generar-reporte-pdf?mes=${periodo}` : "generar-reporte-pdf";
        const data = await api(query);
        return fmtReportePDF(data);
      }

      // "ventas 07-26"
      const periodo = args[0];
      if (!periodo) return "Uso: ventas 07-26  |  ventas reporte [07-26]";
      const data = await api(`reporte-ventas?mes=${periodo}`);
      return fmtReporteVentas(data);
    }

    case "compra": {
      const parsed = parseCompra(args);
      if (!parsed) return "Formato: compra Y048-3 [x1] 11.3";
      const data = await api("registrar-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      return fmtCompra(data);
    }

    case "ayuda":
    case "help":
      return AYUDA;

    default:
      return `Comando no reconocido. Escribe <code>ayuda</code> para ver los comandos disponibles.`;
  }
}

// ─── Azure Function handler ───────────────────────────────────────────────────

app.http("telegram-webhook", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "telegram-webhook",
  handler: async (request) => {
    let update;
    try {
      update = await request.json();
    } catch {
      return { status: 400, body: "Bad request" };
    }

    const message = update.message || update.edited_message;
    if (!message || !message.text) {
      return { status: 200, body: "ok" }; 
    }

    const userId = message.from?.id;
    const chatId = message.chat?.id;
    const text = message.text;

    if (!isAllowed(userId)) {
      return { status: 200, body: "ok" };
    }

    try {
      const reply = await dispatch(text);
      await sendMessage(chatId, reply);
    } catch (err) {
      console.error("Error dispatch:", err);
      await sendMessage(chatId, "❌ Error interno. Intenta de nuevo.");
    }

    return { status: 200, body: "ok" };
  },
});

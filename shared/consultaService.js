// shared/consultaService.js

import { getSheetsClient, SHEET_ID, SHEETS } from "./sheetsClient.js";
import { VERSION_VENTA, ESTADO_ANULADO } from "./constants.js";

async function leerActivos(sheetName, range, esActivo) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  const rows = res.data.values || [];
  return rows
    .map((data, idx) => ({ fila: idx + 2, data }))
    .filter((r) => esActivo(r.data));
}

export async function ultimasVentas(n = 5) {
  const activos = await leerActivos(
    SHEETS.SALIDAS,
    `${SHEETS.SALIDAS}!A2:I`,
    (row) => Number(row[8]) === VERSION_VENTA
  );
  return activos.slice(-n).reverse().map((r) => ({
    fila: r.fila,
    fecha: r.data[0],
    cod_prod: r.data[1],
    cod_modelo: r.data[2],
    descripcion: r.data[3],
    motivo: r.data[4],
    cantidad: Number(r.data[5]),
    responsable: r.data[6],
    precio: Number(r.data[7]),
  }));
}

export async function ultimasCompras(n = 5) {
  const activos = await leerActivos(
    SHEETS.COMPRAS,
    `${SHEETS.COMPRAS}!A2:J`,
    (row) => row[8] !== ESTADO_ANULADO
  );
  return activos.slice(-n).reverse().map((r) => ({
    fila: r.fila,
    fecha: r.data[0],
    cod_prod: r.data[1],
    cod_modelo: r.data[2],
    descripcion: r.data[3],
    cantidad: Number(r.data[4]),
    precio_total: Number(r.data[5]),
    precio_unidad: Number(r.data[6]),
    comprador: r.data[7],
    estado: r.data[8],
  }));
}

/**
 * Lee C.PROMEDIO de INVENTARIO para un producto. "NO APLICA" (sin compras aún) → null.
 */
export async function precioHistoricoProducto(codProd) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEETS.INVENTARIO}!A2:F`,
  });
  const rows = res.data.values || [];
  const row = rows.find((r) => r[0]?.trim().toUpperCase() === codProd);
  if (!row) return null;
  const valor = row[2];
  return valor === "NO APLICA" || valor === "" ? null : Number(valor);
}

/**
 * Promedio de P.UNIDAD de las últimas N compras activas, filtrando por producto o por modelo exacto.
 */
export async function promedioUltimasCompras({ codigo, porModelo = false, n = 5 }) {
  const esActivo = (row) =>
    row[8] !== ESTADO_ANULADO && (porModelo ? row[2] === codigo : row[1] === codigo);
  const activos = await leerActivos(SHEETS.COMPRAS, `${SHEETS.COMPRAS}!A2:J`, esActivo);
  const ultimas = activos.slice(-n);
  if (!ultimas.length) return { promedio: null, cantidad: 0 };
  const suma = ultimas.reduce((acc, r) => acc + Number(r.data[6] || 0), 0);
  return { promedio: +(suma / ultimas.length).toFixed(2), cantidad: ultimas.length };
}
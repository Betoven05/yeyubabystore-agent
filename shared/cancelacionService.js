// shared/cancelacionService.js

import { getSheetsClient, SHEET_ID, SHEETS } from "./sheetsClient.js";
import { VERSION_VENTA, VERSION_ANULADO, ESTADO_ANULADO } from "./constants.js";

function colLetra(idx) {
  return String.fromCharCode(65 + idx);
}

/**
 * Lee una hoja completa (A2:rango) y devuelve solo las filas "activas"
 * según el predicado esActivo, con su número de fila real de Sheets (1-based, +2 por header).
 */
async function leerActivos(sheetName, range, esActivo) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  const rows = res.data.values || [];
  return rows
    .map((data, idx) => ({ fila: idx + 2, data }))
    .filter((r) => esActivo(r.data));
}

/**
 * Anula 1 o N registros (por cantidad, tomando los últimos) o uno específico (por fila).
 * Nunca borra filas — solo actualiza la columna que representa el estado activo/anulado.
 */
async function anularGenerico({ sheetName, range, colIdx, valorNuevo, esActivo, cantidad, fila }) {
  const activos = await leerActivos(sheetName, range, esActivo);

  let objetivo;
  if (fila) {
    objetivo = activos.filter((r) => r.fila === Number(fila));
    if (!objetivo.length) {
      return { ok: false, error: `Fila ${fila} no existe o ya está anulada` };
    }
  } else {
    const n = cantidad || 1;
    if (activos.length < n) {
      return { ok: false, error: `Solo hay ${activos.length} registro(s) activo(s), no se puede anular ${n}` };
    }
    objetivo = activos.slice(-n);
  }

  const sheets = getSheetsClient();
  const data = objetivo.map((r) => ({
    range: `${sheetName}!${colLetra(colIdx)}${r.fila}`,
    values: [[valorNuevo]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  return { ok: true, anuladas: objetivo.map((r) => r.fila) };
}

export async function anularVenta({ cantidad, fila } = {}) {
  return anularGenerico({
    sheetName: SHEETS.SALIDAS,
    range: `${SHEETS.SALIDAS}!A2:I`,
    colIdx: 8, // VERSION
    valorNuevo: VERSION_ANULADO,
    esActivo: (row) => Number(row[8]) === VERSION_VENTA,
    cantidad,
    fila,
  });
}

export async function anularCompra({ cantidad, fila } = {}) {
  return anularGenerico({
    sheetName: SHEETS.COMPRAS,
    range: `${SHEETS.COMPRAS}!A2:J`,
    colIdx: 8, // ESTADO
    valorNuevo: ESTADO_ANULADO,
    esActivo: (row) => row[8] !== ESTADO_ANULADO,
    cantidad,
    fila,
  });
}
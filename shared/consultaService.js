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
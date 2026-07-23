// shared/ventasService.js
import { getSheetsClient, SHEET_ID, SHEETS } from "./sheetsClient.js";

const MESES_MAP = {
  ene:"01", feb:"02", mar:"03", abr:"04",
  may:"05", jun:"06", jul:"07", ago:"08",
  sep:"09", oct:"10", nov:"11", dic:"12",
};

function parseFechaMes(fecha, mm, yy) {
  const partes = fecha.split("-");
  if (partes.length !== 3) return false;
  const mesNum = MESES_MAP[partes[1].toLowerCase()];
  const anioCorto = partes[2].slice(-2);
  return mesNum === mm && anioCorto === yy;
}

function abreviarFecha(fecha) {
  // "20-jul-2026" → "20-jul-26"
  if (!fecha) return "";
  const partes = fecha.split("-");
  if (partes.length !== 3) return fecha;
  return `${partes[0]}-${partes[1]}-${partes[2].slice(-2)}`;
}

export function extraerNombreProducto(descripcion) {
  if (!descripcion) return "";
  return descripcion.split(" - ")[0].trim();
}

export async function obtenerVentasMes(mes) {
  const [mm, yy] = mes.split("-");
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEETS.SALIDAS}!A2:I`,
  });

  const rows = res.data.values || [];

  const ventas = rows
    .filter((r) => {
      const fecha = r[0]?.trim() ?? "";
      const motivo = r[4]?.trim().toUpperCase();
      const version = String(r[8]?.trim());
      return motivo === "VENTA" && version === "2" && parseFechaMes(fecha, mm, yy);
    })
    .map((r) => ({
      fecha: abreviarFecha(r[0]?.trim()),
      cod_producto: r[1]?.trim(),
      modelo: r[2]?.trim(),
      descripcion: r[3]?.trim(),
      nombre_producto: extraerNombreProducto(r[3]?.trim()),
      cantidad: Number(r[5] ?? 1),
      precio: Number(r[7] ?? 0),
    }));

  const total_unidades = ventas.reduce((s, v) => s + v.cantidad, 0);
  const total_monto = +ventas.reduce((s, v) => s + v.precio, 0).toFixed(2);

  return { ventas, total_unidades, total_monto };
}
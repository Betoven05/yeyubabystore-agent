// registrar-compra/index.js
import { app } from "@azure/functions";
import { getSheetsClient, SHEET_ID, SHEETS } from "../shared/sheetsClient.js";
import { json, error, today, requireInternalKey } from "../shared/utils.js";
import { VERSION_COMPRA, RESPONSABLE_SALIDA_DEFAULT } from "../shared/constants.js";

app.http("registrar-compra", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "registrar-compra",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    let body;
    try {
      body = await request.json();
    } catch {
      return error("Body inválido");
    }

    const { modelo, cantidad = 1, precio_unidad, comprador = RESPONSABLE_SALIDA_DEFAULT } = body;
    if (!modelo || !precio_unidad) {
      return error("Requeridos: modelo, precio_unidad");
    }

    const fecha = today();
    const sheets = getSheetsClient();

    // Obtener descripcion y COD PROD desde MODELOS (igual que registrar-venta)
    const modelosRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.MODELOS}!A2:E`,
    });
    const modelosRows = modelosRes.data.values || [];
    const modeloRow = modelosRows.find(
      (r) => r[0]?.trim().toUpperCase() === modelo.toUpperCase()
    );

    const codProd = modelo.toUpperCase().split("-")[0];
    const descripcion = modeloRow
      ? (() => {
          const nom = modeloRow[2] ?? "";
          const dis = modeloRow[3] ?? "";
          const tal = modeloRow[4] ?? "";
          return tal === "U" || tal === "" ? `${nom} - ${dis}` : `${nom} - ${dis} - ${tal}`;
        })()
      : "";

    const cant = Number(cantidad);
    const pUnit = Number(precio_unidad);
    const pTotal = +(cant * pUnit).toFixed(2);

    // COMPRAS: FECHA | COD PROD | COD MODELO | DESCRIPCION | CANT. | P.TOTAL | P.UNIDAD | COMPRADOR | ESTADO | VERSION
    const fila = [
      fecha,
      codProd,
      modelo.toUpperCase(),
      descripcion,
      cant,
      pTotal,
      pUnit,
      comprador.toUpperCase(),
      "PAGADO",
      VERSION_COMPRA,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.COMPRAS}!A:J`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [fila] },
    });

    return json({ ok: true, modelo, codProd, cant, pUnit, pTotal, fecha, version: VERSION_COMPRA });
  },
});
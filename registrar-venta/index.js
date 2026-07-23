// registrar-venta/index.js
import { app } from "@azure/functions";
import { getSheetsClient, SHEET_ID, SHEETS } from "../shared/sheetsClient.js";
import { json, error, today, requireInternalKey } from "../shared/utils.js";
import { VERSION_VENTA, RESPONSABLE_SALIDA_DEFAULT, MOTIVO_SALIDA_DEFAULT } from "../shared/constants.js";

app.http("registrar-venta", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "registrar-venta",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    let body;
    try {
      body = await request.json();
    } catch {
      return error("Body inválido");
    }

    const { items, responsable = RESPONSABLE_SALIDA_DEFAULT, motivo = MOTIVO_SALIDA_DEFAULT } = body;

    if (!Array.isArray(items) || !items.length) {
      return error("items debe ser un array con al menos un elemento");
    }
    for (const it of items) {
      if (!it.modelo || !it.precio) {
        return error("Cada item requiere: modelo, precio");
      }
    }

    const fecha = today(); 
    const sheets = getSheetsClient();

    const modelosRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.MODELOS}!A2:E`,
    });
    const modelosRows = modelosRes.data.values || [];
    const modelosMap = Object.fromEntries(
      modelosRows.map((r) => {
        const nom = r[2] ?? "";
        const dis = r[3] ?? "";
        const tal = r[4] ?? "";
        const desc = tal === "U" || tal === ""
          ? `${nom} - ${dis}`
          : `${nom} - ${dis} - ${tal}`;
        return [r[0]?.trim().toUpperCase(), desc];
      })
    );

    const nuevasFilas = items.map((it) => {
      const modeloUpper = it.modelo.toUpperCase();
      const codProd = modeloUpper.split("-")[0];
      const descripcion = modelosMap[modeloUpper] ?? "";
      return [
        fecha,
        codProd,
        modeloUpper,
        descripcion,                             
        motivo.toUpperCase(),
        Number(it.cantidad ?? 1),
        responsable.toUpperCase(),
        Number(it.precio),
        VERSION_VENTA,
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.SALIDAS}!A:I`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: nuevasFilas },
    });

    return json({ ok: true, registradas: nuevasFilas.length, fecha, version: VERSION_VENTA });
  },
});
// listar-modelos/index.js
import { app } from "@azure/functions";
import { getSheetsClient, SHEET_ID, SHEETS } from "../shared/sheetsClient.js";
import { json, error, requireInternalKey } from "../shared/utils.js";

app.http("listar-modelos", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "listar-modelos",
  handler: async (request) => {
    const producto = request.query.get("producto");
    const authError = requireInternalKey(request);
    if (authError) return authError;
    if (!producto) return error("Parámetro requerido: producto");

    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.MODELOS}!A2:G`,
    });

    const rows = res.data.values || [];
    const modelos = rows
      .filter(
        (r) =>
          r[1]?.trim().toUpperCase() === producto.toUpperCase() &&
          r[6]?.trim().toUpperCase() === "A" 
      )
      .map((r) => ({
        cod_modelo: r[0],
        nombre_producto: r[2],
        modelo_diseño: r[3],
        talla: r[4],
        estado: r[6],
      }));

    if (!modelos.length) return error(`Producto ${producto} no encontrado o sin modelos activos`, 404);

    return json({ ok: true, producto, modelos });
  },
});

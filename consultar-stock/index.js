// consultar-stock/index.js
import { app } from "@azure/functions";
import { getSheetsClient, SHEET_ID, SHEETS } from "../shared/sheetsClient.js";
import { json, error, requireInternalKey } from "../shared/utils.js";

app.http("consultar-stock", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "consultar-stock",
  handler: async (request) => {
    const modelo = request.query.get("modelo");  
    const producto = request.query.get("producto"); 
    const authError = requireInternalKey(request);
    if (authError) return authError;

    if (!modelo && !producto) {
      return error("Parámetro requerido: modelo o producto");
    }

    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.IDETALLE}!A2:G`,
    });

    const rows = res.data.values || [];

    if (modelo) {
      const row = rows.find(
        (r) => r[0]?.trim().toUpperCase() === modelo.toUpperCase()
      );

      if (row) {
        return json({
          ok: true,
          modelo: row[0],
          producto: row[1],
          descripcion: row[2],
          stock: Number(row[3] ?? 0),
          compras: Number(row[4] ?? 0),
          ventas: Number(row[5] ?? 0),
          por_recibir: Number(row[6] ?? 0),
        });
      }
      const prefijo = modelo.toUpperCase();
      const coincidencias = rows.filter((r) =>
        r[0]?.trim().toUpperCase().startsWith(prefijo)
      );

      if (!coincidencias.length) return error(`Modelo o prefijo ${modelo} no encontrado`, 404);

      const modelos = coincidencias.map((r) => ({
        modelo: r[0],
        descripcion: r[2],
        stock: Number(r[3] ?? 0),
        por_recibir: Number(r[6] ?? 0),
      }));

      return json({ ok: true, producto: prefijo, modelos });
    }

    const modelos = rows
      .filter((r) => r[1]?.trim().toUpperCase() === producto.toUpperCase())
      .map((r) => ({
        modelo: r[0],
        descripcion: r[2],
        stock: Number(r[3] ?? 0),
        por_recibir: Number(r[6] ?? 0),
      }));

    if (!modelos.length) return error(`Producto ${producto} no encontrado`, 404);

    return json({ ok: true, producto, modelos });
  },
});

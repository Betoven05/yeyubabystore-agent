// buscar-producto/index.js
import { app } from "@azure/functions";
import { getSheetsClient, SHEET_ID, SHEETS } from "../shared/sheetsClient.js";
import { json, error, requireInternalKey } from "../shared/utils.js";

app.http("buscar-producto", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "buscar-producto",
  handler: async (request) => {
    const q = request.query.get("q");
    const authError = requireInternalKey(request);
    if (authError) return authError;
    if (!q || q.length < 2) return error("Parámetro q debe tener al menos 2 caracteres");

    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      // Columnas: CODIGO | NOMBRE | CATEGORIA | MARCA | ORIGEN | ESTADO
      range: `${SHEETS.PRODUCTOS}!A2:F`,
    });

    const rows = res.data.values || [];
    const term = q.toLowerCase();

    const resultados = rows
      .filter(
        (r) =>
          (r[0]?.toLowerCase().includes(term) ||
            r[1]?.toLowerCase().includes(term) ||
            r[2]?.toLowerCase().includes(term)) &&
          r[5]?.trim().toUpperCase() === "A" 
      )
      .map((r) => ({
        codigo: r[0],
        nombre: r[1],
        categoria: r[2] ?? "—",
        marca: r[3] ?? "—",
        origen: r[4] ?? "—",
      }));

    return json({ ok: true, query: q, total: resultados.length, resultados });
  },
});

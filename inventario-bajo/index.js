// inventario-bajo/index.js
import { app } from "@azure/functions";
import { getSheetsClient, SHEET_ID, SHEETS } from "../shared/sheetsClient.js";
import { json, requireInternalKey } from "../shared/utils.js";
import { PRODUCTOS_EXCLUIDOS_INVENTARIO } from "../shared/constants.js";

app.http("inventario-bajo", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "inventario-bajo",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    const umbralParam = request.query.get("umbral");
    const UMBRAL_BAJO = umbralParam !== null ? Number(umbralParam) : 0;
    const incluirPorRecibir = request.query.get("incluir_por_recibir") === "true";

    const sheets = getSheetsClient();

    const modelosRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.MODELOS}!A2:G`,
    });
    const modelosActivos = new Set(
      (modelosRes.data.values || [])
        .filter((r) => r[6]?.trim().toUpperCase() === "A")
        .map((r) => r[0]?.trim().toUpperCase())
    );

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEETS.IDETALLE}!A2:G`,
    });

    const exclusiones = new Set(
      PRODUCTOS_EXCLUIDOS_INVENTARIO.map((p) => p.toUpperCase())
    );

    const rows = res.data.values || [];
    const bajos = rows
      .filter((r) => {
        const modelo = r[0]?.trim().toUpperCase();
        const producto = r[1]?.trim().toUpperCase();
        const stock = Number(r[3] ?? 0);
        const porRecibir = Number(r[6] ?? 0);
        const stockEfectivo = incluirPorRecibir ? stock + porRecibir : stock;

        return (
          stockEfectivo <= UMBRAL_BAJO &&
          modelosActivos.has(modelo) &&
          !exclusiones.has(producto)
        );
      })
      .map((r) => ({
        modelo: r[0],
        producto: r[1],
        descripcion: r[2],
        stock: Number(r[3] ?? 0),
        por_recibir: Number(r[6] ?? 0),
      }))
      .sort((a, b) => a.stock - b.stock);

    return json({
      ok: true,
      umbral: UMBRAL_BAJO,
      incluir_por_recibir: incluirPorRecibir,
      total: bajos.length,
      items: bajos,
    });
  },
});
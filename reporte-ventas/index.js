// reporte-ventas/index.js
import { app } from "@azure/functions";
import { json, error, requireInternalKey } from "../shared/utils.js";
import { obtenerVentasMes } from "../shared/ventasService.js";

app.http("reporte-ventas", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "reporte-ventas",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    const mes = request.query.get("mes");
    if (!mes || !/^\d{2}-\d{2}$/.test(mes)) {
      return error("Formato requerido: mes=07-26");
    }

    const data = await obtenerVentasMes(mes);
    return json({ ok: true, mes, ...data });
  },
});
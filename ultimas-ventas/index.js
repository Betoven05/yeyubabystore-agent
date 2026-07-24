// ultimas-ventas/index.js
import { app } from "@azure/functions";
import { json, requireInternalKey } from "../shared/utils.js";
import { ultimasVentas } from "../shared/consultaService.js";

app.http("ultimas-ventas", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ultimas-ventas",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    const n = Number(request.query.get("n")) || 5;
    const ventas = await ultimasVentas(n);
    return json({ ok: true, total: ventas.length, ventas });
  },
});
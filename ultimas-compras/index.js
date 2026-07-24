// ultimas-compras/index.js
import { app } from "@azure/functions";
import { json, requireInternalKey } from "../shared/utils.js";
import { ultimasCompras } from "../shared/consultaService.js";

app.http("ultimas-compras", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ultimas-compras",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    const n = Number(request.query.get("n")) || 5;
    const compras = await ultimasCompras(n);
    return json({ ok: true, total: compras.length, compras });
  },
});
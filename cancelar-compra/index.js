// cancelar-compra/index.js
import { app } from "@azure/functions";
import { json, error, requireInternalKey } from "../shared/utils.js";
import { anularCompra } from "../shared/cancelacionService.js";

app.http("cancelar-compra", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "cancelar-compra",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // body vacío es válido: cancela la última compra por defecto
    }

    const { cantidad, fila } = body;
    const resultado = await anularCompra({ cantidad, fila });

    if (!resultado.ok) return error(resultado.error);
    return json(resultado);
  },
});
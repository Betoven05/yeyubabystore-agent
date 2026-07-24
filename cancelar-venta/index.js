// cancelar-venta/index.js
import { app } from "@azure/functions";
import { json, error, requireInternalKey } from "../shared/utils.js";
import { anularVenta } from "../shared/cancelacionService.js";

app.http("cancelar-venta", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "cancelar-venta",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // body vacío es válido: cancela la última venta por defecto
    }

    const { cantidad, fila } = body;
    const resultado = await anularVenta({ cantidad, fila });

    if (!resultado.ok) return error(resultado.error);
    return json(resultado);
  },
});
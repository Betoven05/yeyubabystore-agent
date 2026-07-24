// precio-producto/index.js
import { app } from "@azure/functions";
import { json, error, requireInternalKey } from "../shared/utils.js";
import { precioHistoricoProducto, promedioUltimasCompras } from "../shared/consultaService.js";

app.http("precio-producto", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "precio-producto",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    const q = request.query.get("q");
    if (!q) return error("Parámetro requerido: q");

    const qUpper = q.toUpperCase();
    const esModelo = qUpper.includes("-");
    const codProd = esModelo ? qUpper.split("-")[0] : qUpper;

    const historico = await precioHistoricoProducto(codProd);
    const { promedio, cantidad } = await promedioUltimasCompras({
      codigo: esModelo ? qUpper : codProd,
      porModelo: esModelo,
      n: 5,
    });

    return json({
      ok: true,
      query: qUpper,
      tipo: esModelo ? "modelo" : "producto",
      precio_historico: historico,
      promedio_ultimas_compras: promedio,
      compras_consideradas: cantidad,
    });
  },
});
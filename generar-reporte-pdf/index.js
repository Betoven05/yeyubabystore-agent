// generar-reporte-pdf/index.js
import { app } from "@azure/functions";
import { requireInternalKey, error, json } from "../shared/utils.js";
import { obtenerVentasMes } from "../shared/ventasService.js";
import { generarVentasPDF } from "../reports/templates/ventasPDF.js";
import { existeBlob, subirBuffer, blobUrl } from "../reports/storage.js";

function mesVigente() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}-${yy}`;
}

function nombreBlob(mes) {
  return `ventas-${mes}.pdf`;
}

app.http("generar-reporte-pdf", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "generar-reporte-pdf",
  handler: async (request) => {
    const authError = requireInternalKey(request);
    if (authError) return authError;

    try {
      let mes = request.query.get("mes");
      if (!mes) mes = mesVigente();
      if (!/^\d{2}-\d{2}$/.test(mes)) return error("Formato requerido: mes=07-26");

      const esMesVigente = mes === mesVigente();
      const blob = nombreBlob(mes);

      // Mes anterior con PDF ya generado → devolver URL sin regenerar
      if (!esMesVigente && await existeBlob(blob)) {
        return json({ ok: true, mes, url: blobUrl(blob), generado: false });
      }

      const { ventas, total_unidades, total_monto } = await obtenerVentasMes(mes);

      if (!ventas.length) {
        return json({ ok: true, mes, url: null, mensaje: "Sin ventas en ese período" });
      }

      const pdfBuffer = await generarVentasPDF(mes, ventas, total_unidades, total_monto);
      await subirBuffer(blob, pdfBuffer);

      return json({ ok: true, mes, url: blobUrl(blob), generado: true });

    } catch (err) {
      console.error("GENERAR-PDF ERROR:", err.message);
      return json({ ok: false, error: err.message }, 500);
    }
  },
});
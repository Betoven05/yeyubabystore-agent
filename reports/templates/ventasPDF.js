// reports/templates/ventasPDF.js
import PDFDocument from "pdfkit";

const MESES_NOMBRE = {
  "01":"Enero","02":"Febrero","03":"Marzo","04":"Abril",
  "05":"Mayo","06":"Junio","07":"Julio","08":"Agosto",
  "09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre",
};

// Definición de columnas: x = inicio, w = ancho
const COLS = [
  { key: "fecha",       label: "Fecha",       x: 40,  w: 72,  align: "left"  },
  { key: "modelo",      label: "Modelo",      x: 117, w: 72,  align: "left"  },
  { key: "descripcion", label: "Descripción", x: 194, w: 255, align: "left"  },
  { key: "cantidad",    label: "Cant",        x: 454, w: 30,  align: "right" },
  { key: "precio",      label: "Precio",      x: 489, w: 60,  align: "right" },
];

const PAGE_BOTTOM = 760;
const ROW_H = 18;
const HEADER_H = 20;

function dibujarCabeclaTabla(doc, y) {
  // Fondo oscuro
  doc.rect(40, y, 509, HEADER_H).fill("#2c3e50");

  doc.fillColor("white").fontSize(9).font("Helvetica-Bold");
  for (const col of COLS) {
    doc.text(col.label, col.x, y + 5, { width: col.w, align: col.align, lineBreak: false });
  }
  doc.fillColor("black");
  return y + HEADER_H;
}

function dibujarFila(doc, v, y, esPar) {
  if (esPar) {
    doc.rect(40, y, 509, ROW_H).fill("#f5f7fa");
  }

  doc.fillColor("#222222").fontSize(8).font("Helvetica");

  const precio = `S/${Number(v.precio).toFixed(1)}`;
  const valores = {
    fecha: v.fecha ?? "",
    modelo: v.modelo ?? "",
    descripcion: v.descripcion ?? "",
    cantidad: String(v.cantidad),
    precio,
  };

  for (const col of COLS) {
    doc.text(
      valores[col.key],
      col.x,
      y + 4,
      { width: col.w, align: col.align, lineBreak: false }
    );
  }

  doc.fillColor("black");
  return y + ROW_H;
}

export function generarVentasPDF(mes, ventas, total_unidades, total_monto) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", autoFirstPage: true });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end",  () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const [mm, yy] = mes.split("-");
    const nombreMes = MESES_NOMBRE[mm] ?? mes;

    // ── Encabezado ──────────────────────────────────────────────────────────
    let cursorY = 40;


    doc.image("reports/assets/YeyuBabyStore_Logov2.png", 40, cursorY, { width: 70 });

    doc.fontSize(16).font("Helvetica-Bold")
      .text("Yeyu Baby Store", 40, cursorY, { width: 515, align: "center", lineBreak: false });
    cursorY += 22;

    doc.fontSize(11).font("Helvetica")
      .text(`Reporte de Ventas — ${nombreMes} 20${yy}`, 40, cursorY, { width: 515, align: "center", lineBreak: false });
    cursorY += 24;

    // ── Resumen ──────────────────────────────────────────────────────────────
    doc.rect(40, cursorY, 509, 26).fillAndStroke("#eef2f7", "#c8d6e5");
    doc.fillColor("#1a252f").fontSize(10).font("Helvetica-Bold")
      .text(`Total unidades: ${total_unidades}`, 55, cursorY + 7, { width: 200, lineBreak: false });
    doc.text(`Total monto: S/${total_monto.toFixed(1)}`, 300, cursorY + 7, { width: 220, align: "right", lineBreak: false });
    doc.fillColor("black");
    cursorY += 36;

    // ── Tabla ────────────────────────────────────────────────────────────────
    cursorY = dibujarCabeclaTabla(doc, cursorY);

    ventas.forEach((v, i) => {
      if (cursorY + ROW_H > PAGE_BOTTOM) {
        doc.addPage();
        cursorY = 40;
        cursorY = dibujarCabeclaTabla(doc, cursorY); // repetir cabecera
      }
      cursorY = dibujarFila(doc, v, cursorY, i % 2 === 0);
    });

    // ── Pie ──────────────────────────────────────────────────────────────────
    cursorY += 10;
    doc.moveTo(40, cursorY).lineTo(549, cursorY).strokeColor("#cccccc").stroke();
    cursorY += 6;
    doc.fontSize(8).font("Helvetica").fillColor("#888888")
      .text(
        `Generado el ${new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "numeric", month: "long", year: "numeric" })}`,
        40, cursorY, { width: 509, align: "right", lineBreak: false }
      );

    doc.end();
  });
}
// shared/sheetsClient.js
// Inicializa el cliente autenticado de Google Sheets una sola vez (module-level cache)

import { google } from "googleapis";

let _sheets = null;

export function getSheetsClient() {
  if (_sheets) return _sheets;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  _sheets = google.sheets({ version: "v4", auth });
  return _sheets;
}

export const SHEET_ID = process.env.GOOGLE_SHEETS_ID;

export const SHEETS = {
  INVENTARIO: "INVENTARIO",
  IDETALLE: "I DETALLE",
  PRODUCTOS: "PRODUCTOS",
  MODELOS: "MODELOS",
  COMPRAS: "COMPRAS",
  SALIDAS: "SALIDAS",
};

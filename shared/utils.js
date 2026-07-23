// shared/utils.js

export function today() {
  return new Date().toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    day: "numeric",       
    month: "short",      
    year: "numeric",
  }).replace(/\./g, "").replace(/ /g, "-"); 
}

export function json(body, status = 200) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export function requireInternalKey(request) {
  const key = request.headers.get('x-functions-key');
  if (!key || key !== process.env.FUNCTIONS_KEY) {
    return { status: 401, body: JSON.stringify({ ok: false, error: 'No autorizado' }) };
  }
  return null;
}
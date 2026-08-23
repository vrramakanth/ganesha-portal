/** Request/response helpers. Apps Script Web Apps cannot set a custom HTTP
 *  status code on the response, so success/failure is always signalled in
 *  the JSON body ({ ok: true/false }) rather than via status codes. */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 400;
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/** Apps Script doPost cannot read custom request headers, so the client
 *  must send the JSON payload as the raw text body (Content-Type: text/plain
 *  avoids a CORS preflight, which Apps Script Web Apps do not handle). */
function parseBody(e) {
  if (!e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new ApiError("Invalid JSON body", 400);
  }
}

function requireFields(obj, fields) {
  const missing = fields.filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === "");
  if (missing.length) {
    throw new ApiError(`Missing required field(s): ${missing.join(", ")}`, 400);
  }
}

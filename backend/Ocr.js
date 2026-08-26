/** Best-effort UPI reference extraction from an uploaded payment
 *  screenshot, via Apps Script's Drive-based OCR conversion. This is a
 *  convenience pre-fill only, never authoritative — the resident can
 *  always edit the result, and a volunteer independently checks the real
 *  bank/UPI statement before any receipt is issued regardless of where
 *  the reference came from (Decision 4). Requires the Drive API Advanced
 *  Service (see backend/README.md); if it isn't enabled, or OCR just
 *  can't find anything, this fails soft with an empty guess rather than
 *  blocking the upload — the resident still has the manual-entry option.
 */
function extractPaymentReference(base64Image, mimeType) {
  let tempFileId = null;
  try {
    const bytes = Utilities.base64Decode(base64Image);
    const blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", "payment-screenshot");

    // Deliberately no `mimeType` on the resource — Drive infers the OCR
    // target type from the `ocr: true` option itself; setting it to
    // MimeType.GOOGLE_DOCS explicitly makes the API reject the request
    // ("OCR is not supported for files of type application/vnd.google-apps.document").
    const tempFile = Drive.Files.insert(
      { title: "OCR temp — payment screenshot" },
      blob,
      { ocr: true, ocrLanguage: "en" }
    );
    tempFileId = tempFile.id;

    const text = DocumentApp.openById(tempFile.id).getBody().getText();
    return { guess: guessReferenceFromText(text), rawText: text };
  } catch (err) {
    console.error("extractPaymentReference failed: " + err + (err && err.stack ? "\n" + err.stack : ""));
    return { guess: "", rawText: "" };
  } finally {
    if (tempFileId) {
      try {
        DriveApp.getFileById(tempFileId).setTrashed(true);
      } catch (cleanupErr) {
        // Best effort — an orphaned temp OCR doc is harmless clutter, not worth failing the request over.
      }
    }
  }
}

/** Most UPI apps show a 12-digit UTR/RRN somewhere near a label like
 *  "UPI transaction ID", "UTR", "Ref No" — take the first 12-digit run
 *  as the best guess; fall back to whatever follows a recognizable label
 *  if no clean 12-digit number exists. */
function guessReferenceFromText(text) {
  const twelveDigit = text.match(/\b\d{12}\b/);
  if (twelveDigit) return twelveDigit[0];

  const labeled = text.match(
    /(?:UPI\s*transaction\s*ID|UTR|Ref(?:erence)?\s*No\.?|Txn\s*ID)[:\s]*([A-Za-z0-9]{6,})/i
  );
  if (labeled) return labeled[1];

  return "";
}

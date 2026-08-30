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

function getPaymentScreenshotsFolder() {
  const rootName = getConfig("festival_name", "Ganesha Chathurthi 2026");
  const root = getOrCreateFolder(DriveApp.getRootFolder(), rootName);
  return getOrCreateFolder(root, "Payment Screenshots");
}

/** Saves an uploaded payment screenshot to Drive so a volunteer can open
 *  it from the Needs Review list while checking a reference — separate
 *  from the transient OCR temp doc above, which is always deleted. Fails
 *  soft (empty string) so a storage hiccup never blocks the resident's
 *  reference submission itself. */
function savePaymentScreenshot(base64Image, mimeType) {
  if (!base64Image) return "";
  try {
    const bytes = Utilities.base64Decode(base64Image);
    const blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", "payment-screenshot");
    const file = getPaymentScreenshotsFolder().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return "";
  }
}

/** The UPI RRN/UTR itself is a 12-digit number in an NPCI-standard shape
 *  that's identical across every app, so a bare 12-digit scan is the most
 *  reliable check regardless of which app's screenshot this is — try that
 *  first (tolerating a stray space/line-break OCR sometimes inserts inside
 *  an otherwise-contiguous number), then fall back to whatever follows a
 *  recognizable label (needed for a non-numeric NEFT/IMPS reference, or if
 *  the digit scan comes up empty). Labels vary a lot by app: GPay/WhatsApp
 *  Pay say "UPI transaction ID", BHIM/PhonePe/Amazon Pay say "Transaction
 *  ID", bank apps say "RRN", Paytm/CRED say "UPI Ref No." */
function guessReferenceFromText(text) {
  // Collapse whitespace strictly between two digits (not elsewhere in the
  // text) so a group-separated number like "0020 1186 6106" still matches.
  const collapsed = text.replace(/(\d)[ \t]+(?=\d)/g, "$1");

  const twelveDigit = collapsed.match(/\b\d{12}\b/);
  if (twelveDigit) return twelveDigit[0];

  const labeled = text.match(
    /(?:UPI\s*transaction\s*ID|Transaction\s*ID|RRN|UTR(?:\s*No\.?)?|Ref(?:erence)?\s*(?:No\.?|Number|ID)|Txn\s*ID)[:\s]*([A-Za-z0-9]{6,})/i
  );
  if (labeled) return labeled[1];

  return "";
}

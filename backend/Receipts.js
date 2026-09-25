/** Generates a PDF receipt (spec §12) and stores it in Drive, never in
 *  the Sheet itself (spec §35). */

function getReceiptsFolder() {
  const rootName = getFestivalName();
  const root = getOrCreateFolder(DriveApp.getRootFolder(), rootName);
  return getOrCreateFolder(root, "Receipts");
}

function getOrCreateFolder(parent, name) {
  const existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

/** Decodes a base64 image, stores it in Drive under `<festival root>/
 *  <folderName>`, and returns a URL that actually serves image bytes —
 *  not a Drive *viewer* page like every other upload in this app
 *  (`file.getUrl()`, rendered as a link) — so it can be dropped straight
 *  into an `<img src>`. Shared by `uploadHeroImage` (Config.js) and the
 *  Guests module (Guests.js), the only two places that render an
 *  uploaded image inline rather than link to it. */
function uploadDriveImage(folderName, image, mimeType, blobName) {
  const root = getOrCreateFolder(DriveApp.getRootFolder(), getFestivalName());
  const folder = getOrCreateFolder(root, folderName);
  const bytes = Utilities.base64Decode(image);
  const blob = Utilities.newBlob(bytes, mimeType || "image/jpeg", blobName || "image");
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1000`;
}

function generateReceipt(transaction) {
  const receiptId = generateReceiptId();
  const doc = DocumentApp.create(`Receipt ${receiptId}`);
  const body = doc.getBody();

  body.appendParagraph(getCommunityName().toUpperCase()).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(getFestivalName());
  const isSponsor = transaction.block === SPONSOR_BLOCK;
  body
    .appendParagraph(isSponsor ? "SPONSORSHIP RECEIPT" : "DONATION RECEIPT")
    .setHeading(DocumentApp.ParagraphHeading.HEADING3);
  body.appendParagraph(`Receipt No: ${receiptId}`);
  body.appendParagraph(`Transaction: ${transaction.transaction_id}`);
  body.appendParagraph("");
  body.appendParagraph(`Name: ${transaction.resident_name}`);
  if (!isSponsor) {
    body.appendParagraph(`Block: ${transaction.block}`);
    body.appendParagraph(`Flat: ${transaction.flat_number}`);
  }
  body.appendParagraph("");
  body.appendParagraph(`Amount: ₹${transaction.amount}`);
  body.appendParagraph(
    `Date: ${Utilities.formatDate(new Date(), "Asia/Kolkata", "dd-MMM-yyyy")}`
  );
  body.appendParagraph(`Payment Reference: ${transaction.payment_id || ""}`);
  body.appendParagraph("");
  body.appendParagraph(`STATUS: ${transaction.status}`);
  body.appendParagraph("");
  body.appendParagraph(isSponsor ? "Thank you for sponsoring." : "Thank you for contributing.");
  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF).setName(`${receiptId}.pdf`);
  const pdfFile = getReceiptsFolder().createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  docFile.setTrashed(true); // only the PDF is kept

  return { receiptId, url: pdfFile.getUrl() };
}

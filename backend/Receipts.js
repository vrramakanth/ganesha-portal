/** Generates a PDF receipt (spec §12) and stores it in Drive, never in
 *  the Sheet itself (spec §35). */

function getReceiptsFolder() {
  const rootName = getConfig("festival_name", "Ganesha Chathurthi 2026");
  const root = getOrCreateFolder(DriveApp.getRootFolder(), rootName);
  return getOrCreateFolder(root, "Receipts");
}

function getOrCreateFolder(parent, name) {
  const existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

function generateReceipt(transaction) {
  const receiptId = generateReceiptId();
  const doc = DocumentApp.create(`Receipt ${receiptId}`);
  const body = doc.getBody();

  body.appendParagraph("BRIGADE WOODS").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(getConfig("festival_name", "Ganesha Chathurthi 2026"));
  body.appendParagraph("DONATION RECEIPT").setHeading(DocumentApp.ParagraphHeading.HEADING3);
  body.appendParagraph(`Receipt No: ${receiptId}`);
  body.appendParagraph(`Transaction: ${transaction.transaction_id}`);
  body.appendParagraph("");
  body.appendParagraph(`Name: ${transaction.resident_name}`);
  body.appendParagraph(`Block: ${transaction.block}`);
  body.appendParagraph(`Flat: ${transaction.flat_number}`);
  body.appendParagraph("");
  body.appendParagraph(`Amount: ₹${transaction.amount}`);
  body.appendParagraph(
    `Date: ${Utilities.formatDate(new Date(), "Asia/Kolkata", "dd-MMM-yyyy")}`
  );
  body.appendParagraph(`Payment Reference: ${transaction.payment_id || ""}`);
  body.appendParagraph("");
  body.appendParagraph(`STATUS: ${transaction.status}`);
  body.appendParagraph("");
  body.appendParagraph("Thank you for contributing.");
  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF).setName(`${receiptId}.pdf`);
  const pdfFile = getReceiptsFolder().createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  docFile.setTrashed(true); // only the PDF is kept

  return { receiptId, url: pdfFile.getUrl() };
}

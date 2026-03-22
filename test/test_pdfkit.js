const PDFDocument = require("pdfkit");
const fs = require("fs");

const doc = new PDFDocument({
  size: "A4",
  layout: "landscape",
  margin: 40,
});

const stream = fs.createWriteStream("test_pdfkit.pdf");
doc.pipe(stream);

const pageWidth = doc.page.width;
const paraWidth = pageWidth - 200;
const dynamicDescription = "has successfully completed the event dzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzx and is awarded this certificate in recognition of their effort and dedication.";

doc.font("Helvetica").fontSize(15).fillColor("#4b5563");
doc.text(dynamicDescription, (pageWidth - paraWidth) / 2, 200, {
  align: "center",
  width: paraWidth,
  lineGap: 4,
});

doc.end();
console.log("PDF created");

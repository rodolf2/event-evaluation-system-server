require("dotenv").config();
const mongoose = require("mongoose");
const CertificateTemplate = require("../../src/models/CertificateTemplate");
const Form = require("../../src/models/Form");

async function debugData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const templates = await CertificateTemplate.find().limit(5);
    console.log("Templates found:", templates.length);
    templates.forEach((t) => {
      console.log(`Template: ${t.name} (${t._id})`);
      console.log(`- Objects: ${t.canvasData?.objects?.length || 0}`);
      if (t.canvasData?.objects?.length > 0) {
        console.log(
          `- Sample Object:`,
          JSON.stringify(t.canvasData.objects[0], null, 2),
        );
      }
    });

    const forms = await Form.find({ isCertificateLinked: true })
      .sort({ updatedAt: -1 })
      .limit(5);
    console.log("Recent linked forms:", forms.length);
    forms.forEach((f) => {
      console.log(`Form: ${f.title} (${f._id})`);
      console.log(`- hasCanvasData: ${!!f.certificateCanvasData}`);
      if (f.certificateCanvasData) {
        const data =
          typeof f.certificateCanvasData === "string"
            ? JSON.parse(f.certificateCanvasData)
            : f.certificateCanvasData;
        console.log(`- Objects: ${data.objects?.length || 0}`);
      }
    });

    process.exit(0);
  } catch (e) {
    console.error("Debug script failed:", e);
    process.exit(1);
  }
}

debugData();

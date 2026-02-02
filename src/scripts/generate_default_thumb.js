const { createCanvas } = require("canvas");
const fs = require("fs").promises;
const path = require("path");

async function generateDefault() {
  const width = 800;
  const height = 450;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Header - Navy blue background
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(0, 0, width, 100);

  // Gold accent stripes
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.moveTo(width - 60, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, 100);
  ctx.lineTo(width - 40, 100);
  ctx.closePath();
  ctx.fill();

  // School name (simplified for default)
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px Arial";
  ctx.fillText("LA VERDAD", 50, 40);
  ctx.font = "18px Arial";
  ctx.fillText("CHRISTIAN COLLEGE, INC.", 50, 65);

  // Main title
  ctx.fillStyle = "#000000";
  ctx.font = "bold 42px Arial";
  ctx.textAlign = "center";
  ctx.fillText("EVALUATION REPORT", width / 2, 250);

  // Subtitle
  ctx.font = "20px Arial";
  ctx.fillText("Standard Event Evaluation System", width / 2, 300);

  const buffer = canvas.toBuffer("image/png");
  const outputPath = path.resolve(__dirname, "../../public/thumbnails/default-report.png");
  await fs.writeFile(outputPath, buffer);
  console.log("✅ Created default-report.png");
}

generateDefault().catch(console.error);

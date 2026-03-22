const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

function wrapTextToLines(ctx, text, maxWidth) {
  if (!text || maxWidth <= 0) return [text || ""];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [""];
}

function simulateRendering(eventText, imgName) {
  const canvas = createCanvas(1056, 816);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let text = `has successfully completed the event ${eventText}\nand is awarded this certificate in recognition of their effort and dedication.`;

  const obj = {
    left: 528,
    top: 300,
    width: 600,
    fontSize: 24,
    fontFamily: "Inter",
    fontWeight: "normal",
    textAlign: "center",
    originX: "center",
    originY: "top"
  };

  const maxWidth = obj.width || 9999;
  const lineHeight = obj.fontSize * 1.2;

  let boxLeft = -obj.width / 2;
  let baseDrawX = boxLeft + obj.width / 2;

  ctx.translate(obj.left, obj.top);

  ctx.fillStyle = "#333";
  ctx.textBaseline = "top";

  const renderPlainLine = (lineText, yPos) => {
    ctx.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`;
    ctx.fillText(lineText, baseDrawX, yPos);
  };

  const renderEventLine = (lineText, yPos) => {
    const parts = lineText.split(eventText);
    ctx.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`;
    const beforeWidth = parts[0] ? ctx.measureText(parts[0]).width : 0;

    ctx.font = `bold ${obj.fontSize}px ${obj.fontFamily}`;
    const boldEventWidth = ctx.measureText(eventText).width;

    ctx.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`;
    const afterWidth = parts[1] ? ctx.measureText(parts[1]).width : 0;
    
    const totalWidth = beforeWidth + boldEventWidth + afterWidth;

    let x = baseDrawX - totalWidth / 2;

    ctx.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`;
    if (parts[0]) {
      ctx.textAlign = "left";
      ctx.fillText(parts[0], x, yPos);
      x += beforeWidth;
    }

    ctx.font = `bold ${obj.fontSize}px ${obj.fontFamily}`;
    ctx.textAlign = "left";
    ctx.fillText(eventText, x, yPos);
    x += boldEventWidth;

    ctx.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`;
    if (parts[1]) {
      ctx.textAlign = "left";
      ctx.fillText(parts[1], x, yPos);
    }
  };

  let drawY = 0;
  const lines = text.split("\n");
  for (const line of lines) {
    ctx.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`;
    const wrappedLines = wrapTextToLines(ctx, line, maxWidth);
    
    for (const wrappedLine of wrappedLines) {
      if (wrappedLine.includes(eventText)) {
        renderEventLine(wrappedLine, drawY);
      } else {
        ctx.textAlign = "center";
        renderPlainLine(wrappedLine, drawY);
      }
      drawY += lineHeight;
    }
  }

  const out = fs.createWriteStream(path.join(__dirname, imgName));
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve) => out.on("finish", resolve));
}

async function main() {
  await simulateRendering("qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq", "test_render1.png");
  await simulateRendering("dzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz", "test_render2.png");
  console.log("Images written.");
}

main();

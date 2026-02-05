const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const testUrlResolution = () => {
  console.log('--- URL Resolution Test ---');
  console.log('ENV CLIENT_URL:', process.env.CLIENT_URL);
  console.log('ENV FRONTEND_URL:', process.env.FRONTEND_URL);

  const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173";
  
  console.log('Resolved frontendUrl:', frontendUrl);
  
  if (frontendUrl === process.env.CLIENT_URL && frontendUrl !== "http://localhost:5173") {
    console.log('✓ Success: Resolved to CLIENT_URL');
  } else if (!process.env.CLIENT_URL && frontendUrl === "http://localhost:5173") {
    console.log('✓ Success: Resolved to default (expected since CLIENT_URL is localhost in .env)');
  } else {
    console.log('ℹ Resolved value:', frontendUrl);
  }
};

testUrlResolution();

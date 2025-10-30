const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

async function testGeminiExtraction() {
  console.log('🤖 Testing Gemini Extraction...\n');

  const testUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfWXoJbAhj_1cjzrWTjGyhIIkY-HB22ay1rdyQMqJRk4PcURw/viewform?usp=dialog";

  try {
    console.log('1️⃣ Fetching Google Form HTML...');

    const response = await axios.get(testUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      maxRedirects: 5
    });

    const html = response.data;
    console.log('✅ Successfully fetched HTML, length:', html.length);

    console.log('2️⃣ Extracting with Gemini...');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `Analyze this Google Form HTML and extract all the questions. Return ONLY a JSON array of question objects with the following exact structure:
[
  {
    "title": "Question text here",
    "type": "short_answer" | "paragraph" | "multiple_choice" | "scale" | "date" | "time",
    "required": true/false,
    "options": ["option1", "option2"] // only for multiple_choice, empty array otherwise
  }
]
For scale questions, include low, high, lowLabel, highLabel if available, otherwise use defaults.
Do not include any other text, explanations, or formatting. Just the JSON array.

HTML: ${html.substring(0, 50000)}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    console.log("Gemini response length:", responseText.length);
    console.log("Response preview:", responseText.substring(0, 200) + "...");

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const extractedQuestions = JSON.parse(jsonMatch[0]);
      console.log(`✅ Successfully extracted ${extractedQuestions.length} questions using Gemini`);

      if (extractedQuestions.length > 0) {
        console.log('\n📝 Extracted Questions:');
        extractedQuestions.forEach((q, i) => {
          console.log(`${i + 1}. ${q.title} (${q.type}) ${q.required ? '[Required]' : ''}`);
          if (q.options && q.options.length > 0) {
            q.options.forEach((opt, j) => console.log(`   ${j + 1}) ${opt}`));
          }
        });
      }
    } else {
      console.log("❌ No JSON found in Gemini response");
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testGeminiExtraction();
}

module.exports = { testGeminiExtraction };
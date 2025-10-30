const axios = require('axios');

/**
 * Test section extraction from Google Forms
 */
async function testSectionsExtraction() {
  console.log('📋 Testing Sections Extraction...\n');

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

    console.log('2️⃣ Extracting questions and sections...');

    let extractedQuestions = [];
    let currentSection = null;
    let sectionCounter = 0;

    // Find FB_PUBLIC_LOAD_DATA scripts
    const scriptRegex = /<script[^>]*>[\s\S]*?FB_PUBLIC_LOAD_DATA_[\s\S]*?<\/script>/gi;
    const scriptMatches = html.match(scriptRegex);

    if (scriptMatches) {
      for (const scriptTag of scriptMatches) {
        try {
          const dataMatch = scriptTag.match(/FB_PUBLIC_LOAD_DATA_[^=]*=\s*(\[[\s\S]*?\]);/);
          if (dataMatch && dataMatch[1]) {
            const parsedData = JSON.parse(dataMatch[1]);

            if (Array.isArray(parsedData) && parsedData.length > 1) {
              const questionsData = parsedData[1];

              if (Array.isArray(questionsData)) {
                console.log(`Processing ${questionsData.length} items...`);

                for (let i = 0; i < questionsData.length; i++) {
                  const q = questionsData[i];

                  if (Array.isArray(q) && q.length >= 2 && Array.isArray(q[1]) && q[1].length > 1) {
                    const qData = q[1];
                    const title = qData[1];
                    const questionType = qData[3] || 0;

                    // Check if this is a section header (type 8)
                    if (questionType === 8 || (title && typeof title === 'string' &&
                        (title.toLowerCase().includes('section') ||
                         title.toLowerCase().includes('page')))) {
                      currentSection = title.trim();
                      sectionCounter++;
                      console.log(`📑 Found section: "${currentSection}"`);
                      continue;
                    }

                    // Regular question
                    if (title && typeof title === 'string' && title.trim().length > 0) {
                      const isRequired = qData[2] === 1;

                      let options = [];
                      if (qData[4] && Array.isArray(qData[4])) {
                        options = qData[4].map(opt =>
                          Array.isArray(opt) ? opt[0] : opt
                        ).filter(opt => opt && typeof opt === 'string');
                      }

                      const questionTypeMap = {
                        0: "short_answer", 1: "paragraph", 2: "multiple_choice",
                        3: "multiple_choice", 4: "multiple_choice", 5: "scale",
                        6: "multiple_choice", 7: "multiple_choice", 9: "date", 10: "time"
                      };

                      extractedQuestions.push({
                        title: title.trim(),
                        type: questionTypeMap[questionType] || "short_answer",
                        required: isRequired,
                        options: options,
                        section: currentSection || `Section ${sectionCounter || 1}`
                      });
                    }
                  }
                }

                break; // Found data, stop processing scripts
              }
            }
          }
        } catch (parseError) {
          continue;
        }
      }
    }

    // Group by sections
    const questionsBySection = {};
    extractedQuestions.forEach(q => {
      const sectionName = q.section;
      if (!questionsBySection[sectionName]) {
        questionsBySection[sectionName] = [];
      }
      questionsBySection[sectionName].push(q);
    });

    console.log('\n📊 Results:');
    console.log(`Total questions: ${extractedQuestions.length}`);
    console.log(`Sections: ${Object.keys(questionsBySection).length}`);

    Object.keys(questionsBySection).forEach(sectionName => {
      console.log(`\n📑 ${sectionName}:`);
      questionsBySection[sectionName].forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.title} (${q.type})`);
        if (q.options.length > 0) {
          console.log(`     Options: ${q.options.join(', ')}`);
        }
      });
    });

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testSectionsExtraction();
}

module.exports = { testSectionsExtraction };
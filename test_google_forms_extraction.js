const axios = require('axios');

/**
 * Debug Google Forms extraction by testing the URL directly
 */
async function debugGoogleFormsExtraction() {
  console.log('🔍 Debugging Google Forms Extraction...\n');

  // Test with a sample Google Form URL - use a publicly accessible form
  const testUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSfWXoJbAhj_1cjzrWTjGyhIIkY-HB22ay1rdyQMqJRk4PcURw/viewform?usp=dialog";

  try {
    console.log('1️⃣ Testing HTTP request to Google Form...');

    const response = await axios.get(testUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = response.data;
    console.log('✅ Successfully fetched HTML, length:', html.length);

    // Check for title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) {
      console.log('📄 Title found:', titleMatch[1]);
    } else {
      console.log('❌ No title found');
    }

    // Check for FB_PUBLIC_LOAD_DATA scripts
    const scriptRegex = /<script[^>]*>[\s\S]*?FB_PUBLIC_LOAD_DATA_[\s\S]*?<\/script>/gi;
    const scriptMatches = html.match(scriptRegex);

    if (scriptMatches) {
      console.log(`✅ Found ${scriptMatches.length} FB_PUBLIC_LOAD_DATA scripts`);

      for (let i = 0; i < Math.min(scriptMatches.length, 3); i++) {
        console.log(`\n📜 Script ${i + 1} (first 500 chars):`);
        console.log(scriptMatches[i].substring(0, 500) + '...');

        // Try to extract the JSON data
        const dataMatch = scriptMatches[i].match(/FB_PUBLIC_LOAD_DATA_[^=]*=\s*(\[[\s\S]*?\]);/);
        if (dataMatch) {
          try {
            const parsedData = JSON.parse(dataMatch[1]);
            console.log(`✅ Successfully parsed JSON for script ${i + 1}`);
            console.log('📊 Data structure:', Array.isArray(parsedData) ? `Array with ${parsedData.length} elements` : typeof parsedData);

            if (Array.isArray(parsedData) && parsedData.length > 1) {
              const questionsData = parsedData[1];
              if (Array.isArray(questionsData)) {
                console.log(`📝 Questions data: Array with ${questionsData.length} questions`);

                // Show first question structure
                if (questionsData.length > 0 && questionsData[0]) {
                  console.log('🔍 First question structure:', JSON.stringify(questionsData[0], null, 2));
                }
              }
            }
          } catch (parseError) {
            console.log(`❌ Failed to parse JSON for script ${i + 1}:`, parseError.message);
          }
        } else {
          console.log(`❌ No JSON data found in script ${i + 1}`);
        }
      }
    } else {
      console.log('❌ No FB_PUBLIC_LOAD_DATA scripts found');

      // Look for other patterns
      console.log('\n🔍 Looking for alternative patterns...');

      // Check for other Google Forms data patterns
      const varPatterns = [
        /var\s+FZ[\w_]*\s*=\s*(\[[\s\S]*?\]);/g,
        /window\.\w+\s*=\s*(\[[\s\S]*?\]);/g,
        /FORM_DATA\s*=\s*(\[[\s\S]*?\]);/g
      ];

      for (const pattern of varPatterns) {
        const matches = html.match(pattern);
        if (matches) {
          console.log(`✅ Found ${matches.length} matches for pattern: ${pattern}`);
          for (let i = 0; i < Math.min(matches.length, 2); i++) {
            try {
              const parsed = JSON.parse(matches[i]);
              console.log(`📊 Parsed data: ${Array.isArray(parsed) ? `Array with ${parsed.length} elements` : typeof parsed}`);
            } catch (e) {
              console.log(`❌ Could not parse match ${i + 1}`);
            }
          }
        }
      }
    }

  } catch (error) {
    console.log('❌ HTTP request failed:', error.message);
  }

  console.log('\n🧪 Debug test completed');
}

// Run the debug test
if (require.main === module) {
  debugGoogleFormsExtraction();
}

module.exports = { debugGoogleFormsExtraction };
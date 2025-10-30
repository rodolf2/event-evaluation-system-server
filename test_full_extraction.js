const axios = require('axios');

/**
 * Test the actual extraction logic with the Google Form URL
 */
async function testFullExtraction() {
  console.log('🧪 Testing Full Google Forms Extraction...\n');

  const testUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfWXoJbAhj_1cjzrWTjGyhIIkY-HB22ay1rdyQMqJRk4PcURw/viewform?usp=dialog";

  try {
    console.log('1️⃣ Fetching Google Form...');

    const response = await axios.get(testUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = response.data;
    console.log('✅ Successfully fetched HTML, length:', html.length);

    // Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    let formTitle = "Imported Google Form";
    if (titleMatch && titleMatch[1]) {
      formTitle = titleMatch[1].replace(/ - Google Forms$/, '').trim();
    }
    console.log('📄 Title:', formTitle);

    let extractedQuestions = [];

    // Find FB_PUBLIC_LOAD_DATA scripts
    const scriptRegex = /<script[^>]*>[\s\S]*?FB_PUBLIC_LOAD_DATA_[\s\S]*?<\/script>/gi;
    const scriptMatches = html.match(scriptRegex);

    console.log(`Found ${scriptMatches ? scriptMatches.length : 0} FB_PUBLIC_LOAD_DATA scripts`);

    if (scriptMatches) {
      for (const scriptTag of scriptMatches) {
        try {
          // Extract the JSON array from the script tag - try multiple patterns
          let dataMatch = scriptTag.match(/FB_PUBLIC_LOAD_DATA_[^=]*=\s*(\[[\s\S]*?\]);/);
          if (!dataMatch) {
            // Try alternative pattern for different Google Forms versions
            dataMatch = scriptTag.match(/(\[[\s\S]*?\])\s*;\s*$/);
          }

          if (dataMatch && dataMatch[1]) {
            console.log("Found JSON data in script, attempting to parse...");
            const parsedData = JSON.parse(dataMatch[1]);

            if (Array.isArray(parsedData)) {
              console.log(`Parsed data is array with ${parsedData.length} elements`);

              // Extract questions from the parsed data
              let questionsData = null;

              // The questions are actually stored in the parsedData directly
              // Google Forms structure: [formId, questionsArray, ...]
              console.log('Checking parsedData structure...');

              // Check if parsedData[1] contains the questions
              if (parsedData.length > 1 && Array.isArray(parsedData[1])) {
                questionsData = parsedData[1];
                console.log(`Found questions data at index 1 with ${questionsData.length} items`);
              } else {
                // Fallback: try to find questions in other indices
                for (let i = 0; i < parsedData.length && !questionsData; i++) {
                  if (Array.isArray(parsedData[i]) && parsedData[i].length > 0) {
                    const sampleItem = parsedData[i][0];
                    // Check if items look like questions
                    if (sampleItem && (typeof sampleItem === 'string' || (Array.isArray(sampleItem) && sampleItem.length >= 2))) {
                      questionsData = parsedData[i];
                      console.log(`Found potential questions data at index ${i} with ${questionsData.length} items`);
                    }
                  }
                }
              }

              if (questionsData && Array.isArray(questionsData)) {
                console.log(`Processing ${questionsData.length} potential questions`);

                extractedQuestions = questionsData.map((q, index) => {
                  try {
                    let title = "Untitled Question";
                    let type = "short_answer";
                    let required = false;
                    let options = [];

                    if (Array.isArray(q)) {
                      console.log(`Processing array item ${index + 1}:`, JSON.stringify(q).substring(0, 200) + '...');

                      // Structure: [id, [title, required, type, options, ...], ...]
                      if (q.length >= 2 && Array.isArray(q[1])) {
                        const questionData = q[1];
                        console.log(`Question data structure:`, JSON.stringify(questionData).substring(0, 150) + '...');

                        title = questionData[1] || "Untitled Question";
                        required = questionData[2] === 1;
                        type = mapGoogleFormType(questionData[3] || 0);

                        console.log(`Extracted: title="${title}", required=${required}, type=${type}`);

                        // Extract options
                        if (questionData[4] && Array.isArray(questionData[4])) {
                          options = questionData[4].map(opt => {
                            if (Array.isArray(opt)) {
                              return opt[0] || "";
                            }
                            return opt || "";
                          }).filter(opt => opt !== null && opt !== undefined && opt !== "");
                          console.log(`Options:`, options);
                        }
                      }
                      // Alternative structure: [null, "question text", null, type, options, ...]
                      else if (q[1] && typeof q[1] === 'string') {
                        title = q[1];
                        type = mapGoogleFormType(q[3] || 0);
                        required = false; // Default to not required

                        // Extract options for multiple choice questions
                        if (q[4] && Array.isArray(q[4])) {
                          options = q[4].map(opt => {
                            if (Array.isArray(opt) && opt[0]) {
                              return opt[0];
                            }
                            return opt || "";
                          }).filter(opt => opt);
                        }
                      }
                      // Alternative structure: direct question object
                      else if (typeof q[0] === 'string' && q.length >= 2) {
                        title = q[0];
                        type = mapGoogleFormType(q[2] || 0);
                        required = q[1] === 1;
                        if (q[3] && Array.isArray(q[3])) {
                          options = q[3].map(opt => Array.isArray(opt) ? opt[0] || opt : opt).filter(opt => opt);
                        }
                      }
                      // Skip arrays that don't contain valid questions
                      else if (q.length < 2 || (!q[1] && !q[0])) {
                        console.log(`Skipping invalid question array:`, JSON.stringify(q).substring(0, 100) + '...');
                        return null;
                      }
                    }
                    // Handle string-based questions (like descriptions)
                    else if (typeof q === 'string' && q.trim()) {
                      // Skip obvious non-question strings (emails, descriptions, etc.)
                      const skipPatterns = [
                        /@/,
                        /http/,
                        /www\./,
                        /contact/i,
                        /event.*address/i,
                        /registration/i,
                        /save.*link/i,
                        /edit.*registration/i,
                        /closing.*date/i,
                        /january|february|march|april|may|june|july|august|september|october|november|december/i,
                        /timing|address/i
                      ];

                      const shouldSkip = skipPatterns.some(pattern => pattern.test(q.toLowerCase()));
                      if (shouldSkip) {
                        console.log(`Skipping non-question text: "${q.substring(0, 50)}..."`);
                        return null; // Skip this item
                      }

                      title = q;
                    }
                    // Handle string-based questions (simpler format)
                    else if (typeof q === 'string') {
                      title = q;
                    }

                    console.log(`Question ${index + 1}: "${title}" (${type})`);

                    // Handle scale questions
                    let low = 1, high = 5, lowLabel = "Poor", highLabel = "Excellent";
                    if (type === "scale" && q[1] && Array.isArray(q[1]) && q[1][4] && Array.isArray(q[1][4]) && q[1][4].length >= 2) {
                      const scaleData = q[1][4];
                      if (scaleData[0] && Array.isArray(scaleData[0])) {
                        low = scaleData[0][0] || 1;
                        high = scaleData[0][1] || 5;
                      }
                      if (scaleData[1] && Array.isArray(scaleData[1])) {
                        lowLabel = scaleData[1][0] || "Poor";
                        highLabel = scaleData[1][1] || "Excellent";
                      }
                    }

                    return {
                      title: title,
                      type: type,
                      required: required,
                      options: options,
                      low: low,
                      high: high,
                      lowLabel: lowLabel,
                      highLabel: highLabel,
                    };

                  } catch (questionError) {
                    console.log(`Error processing question ${index + 1}:`, questionError.message);
                    return null;
                  }
                }).filter(q => q !== null);

                console.log(`Successfully extracted ${extractedQuestions.length} questions`);

                if (extractedQuestions.length > 0) {
                  break; // Found questions, stop processing
                }
              }
            }
          }
        } catch (parseError) {
          console.log("Error parsing script tag:", parseError.message);
          continue;
        }
      }
    }

    console.log('\n📊 Final Results:');
    console.log(`Title: ${formTitle}`);
    console.log(`Questions extracted: ${extractedQuestions.length}`);

    if (extractedQuestions.length > 0) {
      console.log('\n📝 Questions:');
      extractedQuestions.forEach((q, i) => {
        console.log(`${i + 1}. ${q.title} (${q.type}) ${q.required ? '[Required]' : ''}`);
        if (q.options && q.options.length > 0) {
          q.options.forEach((opt, j) => console.log(`   ${j + 1}) ${opt}`));
        }
      });
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Helper function to map Google Forms question types
function mapGoogleFormType(googleType) {
  switch (googleType) {
    case 0: return "short_answer";
    case 1: return "paragraph";
    case 2: return "multiple_choice";
    case 3: return "multiple_choice"; // Checkboxes mapped to multiple choice
    case 4: return "multiple_choice"; // Dropdown
    case 5: return "scale";
    case 6: return "multiple_choice"; // Multiple choice grid
    case 7: return "multiple_choice"; // Checkbox grid
    case 9: return "date";
    case 10: return "time";
    default: return "short_answer";
  }
}

// Run the test
if (require.main === module) {
  testFullExtraction();
}

module.exports = { testFullExtraction };
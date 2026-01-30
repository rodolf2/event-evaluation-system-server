const { analyzeSingleWithPython } = require('./src/services/analysis/analysisService');
const path = require('path');
require('dotenv').config();

async function testAnalysis() {
    console.log('Testing Python analysis engine (DB-less)...');

    try {
        const text = "The event was really well-organized and I learned a lot. Looking forward to the next one!";
        console.log(`Analyzing: "${text}"`);

        // Call the lower-level function that doesn't need DB
        const result = await analyzeSingleWithPython(text, []);
        console.log('Analysis Result:', JSON.stringify(result, null, 2));

        if (result.method === 'python') {
            console.log('SUCCESS: Python analysis is working!');
        } else {
            console.log('FAILURE: Python analysis not detected in result.');
        }
    } catch (error) {
        console.error('ERROR during test:', error);
    } finally {
        process.exit();
    }
}

testAnalysis();

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class FileParser {
  // Extract text from various file types
  async extractTextFromFile(filePath) {
    try {
      const fileExtension = path.extname(filePath).toLowerCase();

      if (fileExtension === '.pdf') {
        return await this.extractTextFromPDF(filePath);
      } else if (fileExtension === '.txt') {
        return await this.extractTextFromTXT(filePath);
      } else if (fileExtension === '.docx') {
        return await this.extractTextFromDOCX(filePath);
      } else if (fileExtension === '.csv') {
        return await this.extractTextFromCSV(filePath);
      } else {
        // For unsupported files, try to read as plain text
        try {
          return fs.readFileSync(filePath, 'utf8');
        } catch (fallbackError) {
          throw new Error(`Unsupported file type: ${fileExtension}`);
        }
      }
    } catch (error) {
      console.error('Error extracting text from file:', error);
      throw error;
    }
  }

  // Extract text from DOCX files
  async extractTextFromDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.error('Error extracting text from DOCX:', error);
      // Fallback to plain text reading if mammoth fails
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch (fallbackError) {
        throw new Error(`DOCX extraction failed: ${error.message}`);
      }
    }
  }

  // Extract text from CSV files
  async extractTextFromCSV(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      if (lines.length === 0) return '';

      // Try to detect if first line is headers
      const firstLine = lines[0];
      const headers = firstLine.split(',').map(h => h.trim().replace(/"/g, ''));

      // Convert CSV to readable text format
      let text = 'CSV Data:\n\n';

      if (lines.length > 1) {
        text += `Headers: ${headers.join(', ')}\n\n`;
        text += 'Data rows:\n';
        for (let i = 1; i < Math.min(lines.length, 6); i++) { // Show first 5 data rows
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          text += `${i}. ${values.join(' | ')}\n`;
        }
        if (lines.length > 6) {
          text += `... and ${lines.length - 6} more rows\n`;
        }
      }

      return text;
    } catch (error) {
      console.error('Error extracting text from CSV:', error);
      throw error;
    }
  }

  // Extract text from PDF
  async extractTextFromPDF(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      // Return empty string instead of throwing to allow fallback questions
      return '';
    }
  }


  // Extract text from TXT files
  async extractTextFromTXT(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('Error reading TXT file:', error);
      throw error;
    }
  }

  // Extract questions from text content
  async extractQuestionsFromFile(filePath) {
    try {
      const text = await this.extractTextFromFile(filePath);

      // Simple question extraction logic
      const questions = this.parseQuestionsFromText(text);

      return {
        title: this.extractTitleFromText(text),
        description: this.extractDescriptionFromText(text),
        questions: questions,
      };
    } catch (error) {
      console.error('Error extracting questions from file:', error);
      throw error;
    }
  }

  // Parse questions from text (comprehensive implementation)
  parseQuestionsFromText(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const questions = [];
    const seenQuestions = new Set(); // Track unique questions

    // Enhanced patterns for different question formats
    const patterns = {
      // Numbered questions: 1. Question? 1) Question? (1) Question?
      numbered: /^\s*(\d+)[\.\)\s]+\s*(.+?)(?:\?|\:)?\s*$/i,
      // Lettered questions: a. Question? A) Question?
      lettered: /^\s*([a-zA-Z])[\.\)\s]+\s*(.+?)(?:\?|\:)?\s*$/i,
      // Questions ending with ?
      questionMark: /^(.+?)\?$/,
      // Statements that might be questions: "Please rate..." "How would you..."
      statementQuestion: /^(?:please|how|what|why|when|where|who|can|could|would|will|did|do|are|is|were|was)\s+(.+?)(?:\?|\:)?$/i,
      // Choice patterns: a) Option, (a) Option, 1. Option, • Option, - Option
      choice: /^\s*(?:\([a-zA-Z0-9]\)|\d+\.|\d+\)|\w\)|\•|\-)\s*(.+)$/,
      // Roman numerals: i. ii. iii. etc.
      roman: /^\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x)[\.\)\s]+\s*(.+?)(?:\?|\:)?\s*$/i,
      // Bold/underlined indicators (common in docs): **Question** __Question__
      formatted: /^\s*(\*\*|\_\_)(.+?)(\*\*|\_\_)(?:\?|\:)?\s*$/
    };

    // Rating scale indicators
    const scaleIndicators = /(?:rate|rating|scale|likert|rank|score).*(?:1\s*to\s*\d+|\d+\s*point|poor|excellent|strongly\s+agree|agree|neutral|disagree)/i;

    let currentQuestion = null;
    let collectingChoices = false;
    let choices = [];
    let questionBuffer = []; // Buffer for multi-line questions

    for (let i = 0; i < lines.length; i++) {
      if (!questionText.trim()) {
          continue;
      }
      const line = lines[i].trim();
      const nextLines = lines.slice(i + 1, Math.min(i + 8, lines.length)); // Look ahead

      // Skip very short lines or pure numbers/symbols
      if (line.length < 2 || /^[^\w\s]+$/.test(line)) {
        continue;
      }

      let matchedPattern = null;
      let questionText = '';

      // Test all patterns
      if (patterns.numbered.test(line)) {
        const match = line.match(patterns.numbered);
        questionText = match[2].trim();
        matchedPattern = 'numbered';
      } else if (patterns.lettered.test(line) && !currentQuestion) {
        const match = line.match(patterns.lettered);
        questionText = match[2].trim();
        matchedPattern = 'lettered';
      } else if (patterns.questionMark.test(line)) {
        const match = line.match(patterns.questionMark);
        questionText = match[1].trim() + '?';
        matchedPattern = 'question';
      } else if (patterns.statementQuestion.test(line) && !currentQuestion) {
        const match = line.match(patterns.statementQuestion);
        questionText = line; // Keep full statement
        matchedPattern = 'statement';
      } else if (patterns.formatted.test(line)) {
        const match = line.match(patterns.formatted);
        questionText = match[2].trim();
        matchedPattern = 'formatted';
      }

      // Process matched question
      if (matchedPattern && questionText) {
        if (!questionText.trim()) {
            continue;
        }
        // Save previous question if exists
        if (currentQuestion) {
          this.finalizeQuestion(currentQuestion, choices);
          if (!seenQuestions.has(currentQuestion.title.toLowerCase())) {
            questions.push(currentQuestion);
            seenQuestions.add(currentQuestion.title.toLowerCase());
          }
        }

        // Skip if we've seen this question before
        if (seenQuestions.has(questionText.toLowerCase())) {
          currentQuestion = null;
          collectingChoices = false;
          choices = [];
          continue;
        }

        // Create new question
        currentQuestion = {
          title: questionText,
          type: this.determineQuestionType(questionText, nextLines),
          required: this.determineRequired(questionText),
        };

        collectingChoices = this.needsChoices(currentQuestion.type);
        choices = [];
        seenQuestions.add(questionText.toLowerCase());
        continue;
      }

      // Process choices if we're collecting them
      if (collectingChoices && currentQuestion) {
        const choiceMatch = line.match(patterns.choice);
        if (choiceMatch) {
          const choiceText = choiceMatch[1] ? choiceMatch[1].trim() : '';
          if (choiceText && !choices.includes(choiceText)) {
            choices.push(choiceText);
          }
          continue;
        }

        // Look for inline choices (comma or "or" separated)
        const inlineChoices = line.split(/\s*(?:,|or|and)\s+/).filter(choice =>
          choice.length > 1 && choice.length < 50 && !choice.match(/^\d+$/) &&
          !choice.match(/^(?:please|how|what|why|when|where|who|can|could|would|will|did|do|are|is|were|was)$/i)
        );
        if (inlineChoices.length >= 2 && inlineChoices.length <= 6) {
          choices = [...new Set([...choices, ...inlineChoices])]; // Remove duplicates
          collectingChoices = false;
          continue;
        }

        // Stop collecting if we hit another question pattern or long text
        if (Object.values(patterns).some(pattern => pattern.test(line)) || line.length > 100) {
          collectingChoices = false;
        }
      }

      // Handle multi-line questions (rare case)
      if (currentQuestion && questionBuffer.length > 0) {
        // If we have buffered lines and current line seems to continue the question
        if (line.length > 10 && !line.match(patterns.choice)) {
          currentQuestion.title += ' ' + line;
          questionBuffer = [];
        }
      }
    }

    // Save the last question
    if (currentQuestion) {
      this.finalizeQuestion(currentQuestion, choices);
      if (!seenQuestions.has(currentQuestion.title.toLowerCase())) {
        questions.push(currentQuestion);
      }
    }

    // Enhanced fallback for documents with no clear questions
    if (questions.length === 0) {
      // Try to extract from paragraph text - look for question-like sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

      for (const sentence of sentences.slice(0, 10)) { // Check first 10 sentences
        const trimmed = sentence.trim();
        if (patterns.statementQuestion.test(trimmed) ||
            trimmed.toLowerCase().includes('please') ||
            trimmed.toLowerCase().includes('feedback')) {
          questions.push({
            title: trimmed,
            type: this.determineQuestionType(trimmed, []),
            required: false,
            options: [],
          });
          break; // Just take the first good one
        }
      }
    }

    // Absolute fallback
    if (questions.length === 0) {
      questions.push({
        title: 'Please provide your feedback',
        type: 'paragraph',
        required: false,
        options: [],
      });
    }

    return questions;
  }

  // Determine if a question is required based on keywords
  determineRequired(questionText) {
    const requiredKeywords = /(?:required|mandatory|must|please|important)/i;
    return requiredKeywords.test(questionText);
  }

  // Determine question type based on content
  determineQuestionType(questionText, nextLines = []) {
    const text = questionText.toLowerCase();

    // Check for rating/scale questions
    if (text.includes('rate') || text.includes('rating') || text.includes('scale') ||
        text.includes('satisfied') || text.includes('agree') || text.includes('likely') ||
        text.includes('how much') || text.includes('how well')) {
      return 'scale';
    }

    // Check for multiple choice indicators in next lines
    const nextText = nextLines.join(' ').toLowerCase();
    if (nextText.includes('a)') || nextText.includes('b)') || nextText.includes('c)') ||
        nextText.includes('1.') || nextText.includes('2.') || nextText.includes('3.') ||
        nextText.includes('excellent') || nextText.includes('good') || nextText.includes('poor') ||
        nextText.includes('yes') || nextText.includes('no')) {
      return 'multiple_choice';
    }

    // Check for yes/no questions
    if (text.includes('do you') || text.includes('are you') || text.includes('would you') ||
        text.includes('can you') || text.includes('will you') || text.includes('did you') ||
        text.includes('have you') || text.includes('should')) {
      return 'multiple_choice';
    }

    // Check for open-ended questions
    if (text.includes('why') || text.includes('how') || text.includes('what') ||
        text.includes('describe') || text.includes('explain') || text.includes('comment') ||
        text.includes('tell us') || text.includes('share') || text.includes('feedback')) {
      return 'paragraph';
    }

    // Default to short answer for specific questions
    return 'numeric_ratings';
  }

  // Check if question type needs choices
  needsChoices(type) {
    return ['multiple_choice', 'checkbox'].includes(type);
  }

  // Finalize question with collected data
  finalizeQuestion(question, choices) {
    if (this.needsChoices(question.type) && choices.length > 0) {
      question.options = choices;
    } else if (question.type === 'scale') {
      question.options = [];
      question.low = 1;
      question.high = 5;
      question.lowLabel = 'Poor';
      question.highLabel = 'Excellent';
    } else {
      question.options = [];
    }
  }

  // Extract title from text
  extractTitleFromText(text) {
    const lines = text.split('\n').filter(line => line.trim());
    return lines[0] ? lines[0].substring(0, 100) : 'Untitled Form';
  }

  // Extract description from text
  extractDescriptionFromText(text) {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.length > 1 ? lines.slice(1, 3).join(' ') : '';
  }
}

module.exports = new FileParser();
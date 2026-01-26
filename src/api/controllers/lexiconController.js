const Lexicon = require("../../models/Lexicon");

// Get all words
exports.getLexicon = async (req, res) => {
  try {
    const lexicon = await Lexicon.find().sort({ word: 1 });
    res.status(200).json({
      success: true,
      data: lexicon,
    });
  } catch (error) {
    console.error("Error fetching lexicon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lexicon",
      error: error.message,
    });
  }
};

// Add a new word
exports.addWord = async (req, res) => {
  try {
    const { word, sentiment, weight, language, isPhrase } = req.body;

    if (!word || !sentiment) {
      return res.status(400).json({
        success: false,
        message: "Word and sentiment are required",
      });
    }

    const existing = await Lexicon.findOne({ word: word.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Word already exists in the lexicon",
      });
    }

    const newWord = await Lexicon.create({
      word,
      sentiment,
      weight: weight || 1.0,
      language: language || "en",
      isPhrase: isPhrase || false,
    });

    res.status(201).json({
      success: true,
      data: newWord,
    });
  } catch (error) {
    console.error("Error adding word to lexicon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add word",
      error: error.message,
    });
  }
};

// Update a word
exports.updateWord = async (req, res) => {
  try {
    const { id } = req.params;
    const { sentiment, weight, isPhrase } = req.body;

    const updatedWord = await Lexicon.findByIdAndUpdate(
      id,
      { sentiment, weight, isPhrase },
      { new: true, runValidators: true },
    );

    if (!updatedWord) {
      return res.status(404).json({
        success: false,
        message: "Word not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedWord,
    });
  } catch (error) {
    console.error("Error updating lexicon word:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update word",
      error: error.message,
    });
  }
};

// Delete a word
exports.deleteWord = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedWord = await Lexicon.findByIdAndDelete(id);

    if (!deletedWord) {
      return res.status(404).json({
        success: false,
        message: "Word not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Word deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting lexicon word:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete word",
      error: error.message,
    });
  }
};

// Bulk add words (useful for migration/import)
exports.bulkAdd = async (req, res) => {
  try {
    const { words } = req.body;

    if (!words || !Array.isArray(words)) {
      return res.status(400).json({
        success: false,
        message: "An array of words is required",
      });
    }

    // Filter out words that already exist
    const wordList = words.map((w) => w.word.toLowerCase());
    const existingWords = await Lexicon.find({ word: { $in: wordList } });
    const existingWordStrings = existingWords.map((w) => w.word);

    const newWords = words.filter(
      (w) => !existingWordStrings.includes(w.word.toLowerCase()),
    );

    if (newWords.length === 0) {
      return res.status(200).json({
        success: true,
        message: "All words already exist in the lexicon",
        importedCount: 0,
      });
    }

    const result = await Lexicon.insertMany(newWords);

    res.status(201).json({
      success: true,
      message: `${result.length} words imported successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Error bulk adding to lexicon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk add words",
      error: error.message,
    });
  }
};

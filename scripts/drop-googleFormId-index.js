require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB using the same method as the server
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Drop the googleFormId index
const dropIndex = async () => {
  try {
    // Get the forms collection
    const db = mongoose.connection.db;
    const formsCollection = db.collection('forms');

    // List all indexes
    const indexes = await formsCollection.listIndexes().toArray();
    console.log('Current indexes:', indexes);

    // Drop the googleFormId_1 index if it exists
    try {
      await formsCollection.dropIndex('googleFormId_1');
      console.log('Successfully dropped googleFormId_1 index');
    } catch (error) {
      if (error.codeName === 'IndexNotFound') {
        console.log('googleFormId_1 index not found (already removed)');
      } else {
        console.error('Error dropping index:', error);
      }
    }

    // Verify the index is removed
    const remainingIndexes = await formsCollection.listIndexes().toArray();
    console.log('Remaining indexes:', remainingIndexes);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
  }
};

// Run the script
connectDB()
  .then(dropIndex)
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
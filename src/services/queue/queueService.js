const Queue = require('bull');
const Redis = require('redis');

// Create Redis client
const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

// Create sentiment analysis queue
const sentimentAnalysisQueue = new Queue('sentiment-analysis', {
  redis: redisClient,
});

// Create comment processing queue
const commentProcessingQueue = new Queue('comment-processing', {
  redis: redisClient,
});

// Job processors
sentimentAnalysisQueue.process(async (job) => {
  try {
    const { comment, commentId, formId } = job.data;

    // Perform sentiment analysis
    const sentimentResult = await analyzeCommentSentiment(comment);

    // Store result in database
    await storeSentimentResult(commentId, formId, sentimentResult);

    return { success: true, sentiment: sentimentResult };
  } catch (error) {
    console.error('Sentiment analysis job failed:', error);
    throw error;
  }
});

commentProcessingQueue.process(async (job) => {
  try {
    const { comments, formId } = job.data;

    // Process comments in batches
    const batchSize = 50;
    const results = [];

    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      const batchResults = await processCommentBatch(batch, formId);
      results.push(...batchResults);
    }

    return { success: true, results };
  } catch (error) {
    console.error('Comment processing job failed:', error);
    throw error;
  }
});

// Helper functions
async function analyzeCommentSentiment(comment) {
  // Call the existing AnalysisService
  const AnalysisService = require('../../services/analysis/analysisService');
  return await AnalysisService.analyzeCommentSentiment(comment);
}

async function storeSentimentResult(commentId, formId, sentiment) {
  // Store sentiment result in database
  const Comment = require('../../models/Comment');
  await Comment.updateOne(
    { _id: commentId, formId },
    { $set: { sentiment, analyzedAt: new Date() } },
    { upsert: true }
  );
}

async function processCommentBatch(comments, formId) {
  const results = [];
  const CONCURRENCY = 10;

  for (let i = 0; i < comments.length; i += CONCURRENCY) {
    const chunk = comments.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (comment) => {
        try {
          const sentimentResult = await analyzeCommentSentiment(comment.answer);
          return {
            commentId: comment._id,
            sentiment: sentimentResult,
            analyzedAt: new Date(),
          };
        } catch (error) {
          console.error('Error processing comment:', error);
          return {
            commentId: comment._id,
            error: error.message,
            analyzedAt: new Date(),
          };
        }
      })
    );

    results.push(
      ...chunkResults.map((r) =>
        r.status === 'fulfilled'
          ? r.value
          : { error: r.reason?.message, analyzedAt: new Date() }
      )
    );
  }

  return results;
}

// Export queue instances
module.exports = {
  sentimentAnalysisQueue,
  commentProcessingQueue,
  redisClient,
};
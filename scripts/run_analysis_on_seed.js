require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const connectDB = require("../src/utils/db");
const analysisService = require("../src/services/analysis/analysisService");
const Report = require("../src/models/Report");
const Form = require("../src/models/Form");
const Event = require("../src/models/Event");

const EVENTS_TO_ANALYZE_IDS = [
    "6996795ade76e49e41ca0c95", // 2024 Event
    "6996795dde76e49e41ca3b87"  // 2025 Event
];

const runAnalysis = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB for analysis...");

        for (const eventId of EVENTS_TO_ANALYZE_IDS) {
            console.log(`\n--- Analyzing Event (Form ID): ${eventId} ---`);
            
            const formId = eventId;
            const form = await Form.findById(formId);
            if (!form) {
                console.error(`Form ${formId} not found.`);
                continue;
            }
            console.log(`Found Form: ${form.title}`);

            // Find Shadow Event for Python Analysis linkage
            const shadowEvent = await Event.findOne({ name: form.title, date: form.eventStartDate });
            const activeEventId = shadowEvent ? shadowEvent._id : formId;
            console.log(`Using Event ID for Analysis: ${activeEventId}`);

            console.log("Generating qualitative report (calling Python script)...");
            // This returns { summary, insights, recommendations, comments, ... }
            const qualitativeData = await analysisService.generateQualitativeReport(activeEventId);
            console.log("Analysis complete.");

            // Prepare Quantitative Data
            const totalAttendees = form.attendeeList ? form.attendeeList.length : 0;
            const totalResponses = form.responses ? form.responses.length : 0;
            const responseRate = totalAttendees > 0 ? (totalResponses / totalAttendees) * 100 : 0;
            
            let totalRating = 0;
            let ratingCount = 0;
            
            if (form.responses) {
                form.responses.forEach(r => {
                    if (r.responses) {
                        r.responses.forEach(a => {
                            const val = a.answer || a.value;
                            if (val && typeof val === 'number') {
                                totalRating += val;
                                ratingCount++;
                            }
                        });
                    }
                });
            }
            const avgRating = ratingCount > 0 ? parseFloat((totalRating / ratingCount).toFixed(2)) : 0;

            // Save/Update Report Document
            let report = await Report.findOne({ formId: form._id });
            
            if (!report) {
                console.log("Creating new Report document...");
                report = new Report({
                    formId: form._id,
                    userId: form.createdBy,
                    title: `Report - ${form.title}`,
                    eventDate: form.eventStartDate,
                    status: "published",
                    isGenerated: true,
                    feedbackCount: totalResponses,
                    averageRating: avgRating,
                    metadata: {
                        description: form.description,
                        attendeeCount: totalAttendees,
                        responseRate: responseRate,
                        eventStartDate: form.eventStartDate,
                        eventEndDate: form.eventEndDate
                    }
                });
            } else {
                 console.log("Updating existing Report document...");
                 report.isGenerated = true;
                 report.feedbackCount = totalResponses;
                 report.averageRating = avgRating;
            }

            // Map Qualitative Data to Analytics Schema
            // qualitativeData has: { summary: { positive, neutral, negative }, insights, recommendations, comments }
            // Report schema expects: sentimentBreakdown: { positive: { count, percentage }, ... }
            
            const summary = qualitativeData.summary || { positive: 0, neutral: 0, negative: 0 };
            const totalSentiments = (summary.positive || 0) + (summary.neutral || 0) + (summary.negative || 0);
            
            const calcPercent = (count) => totalSentiments > 0 ? Math.round((count / totalSentiments) * 100) : 0;

            console.log("Full Qualitative Data:", JSON.stringify(qualitativeData, null, 2));
            


            // Ensure we are working with numbers
            const safeNum = (val) => {
                if (val === undefined || val === null) return 0;
                const n = Number(val);
                return isNaN(n) ? 0 : n;
            };

            // Explicitly construct the analytics object to avoid Schema confusion
            const analyticsData = {
                sentimentBreakdown: {
                    positive: { 
                        count: safeNum(summary.positive), 
                        percentage: safeNum(calcPercent(summary.positive || 0)) 
                    },
                    neutral: { 
                        count: safeNum(summary.neutral), 
                        percentage: safeNum(calcPercent(summary.neutral || 0)) 
                    },
                    negative: { 
                        count: safeNum(summary.negative), 
                        percentage: safeNum(calcPercent(summary.negative || 0)) 
                    }
                },
                quantitativeData: {
                    totalResponses: safeNum(totalResponses),
                    totalAttendees: safeNum(totalAttendees),
                    responseRate: safeNum(responseRate),
                    averageRating: safeNum(avgRating)
                },
                charts: {
                    yearData: [], 
                    ratingDistribution: [],
                    statusBreakdown: [],
                    responseTrends: []
                }
            };

            // Process comments for categorizedComments and questionBreakdown
            // use analyzed_feedbacks which is always an array of { text, sentiment, ... }
            const commentsArray = qualitativeData.analyzed_feedbacks || [];
            console.log(`Processing ${commentsArray.length} analyzed feedbacks...`);

            const categorized = { positive: [], neutral: [], negative: [] };
            
            // We need to map these back to responses if we want names, but for now we'll use a placeholder
            // or try to match by index if we fetch feedbacks. 
            // Simpler: Just map them as anonymous or generic for the snapshot display.
            
            commentsArray.forEach((c, idx) => {
                const s = c.sentiment || 'neutral';
                if (categorized[s]) {
                    categorized[s].push({
                        id: `gen_comment_${idx}`,
                        comment: c.text,
                        user: "Student", // Generic name since we lost mapping in analysisService
                        email: "student@example.com",
                        questionTitle: "What did you like or dislike?",
                        createdAt: new Date(),
                        sentiment: s
                    });
                }
            });

            analyticsData.categorizedComments = categorized;

            // Question Breakdown (for the text question)
            // Assuming "q2" is the text question from our seed script
            analyticsData.questionBreakdown = [{
                questionId: "q2",
                title: "What did you like or dislike?",
                type: "paragraph",
                summary: summary,
                comments: commentsArray.map((c, idx) => ({
                    id: `gen_q_comment_${idx}`,
                    text: c.text,
                    sentiment: c.sentiment,
                    user: "Student"
                }))
            }];

            report.analytics = analyticsData;
            
            // Construct a proper dataSnapshot that matches what the controller expects
            // Structure: { responses, analytics, metadata, snapshotDate }
            // detailed in Report.js schema comments and implied by controller usage
            const snapshotData = {
                analytics: analyticsData,
                metadata: {
                    description: form.description,
                    attendeeCount: totalAttendees,
                    responseRate: responseRate,
                    eventStartDate: form.eventStartDate,
                    eventEndDate: form.eventEndDate
                },
                // We should probably snapshot the responses too if possible, 
                // but for now let's at least provide the analytics which is crashing the controller.
                // The controller uses snapshot.responses for filtering, so we might need basic response data or empty array if not critical yet.
                responses: form.responses || [], 
                textResponses: commentsArray.map(c => ({ answer: c.text })), // Needed for totalComments count
                snapshotDate: new Date(),
                // Also store the raw python output if needed, maybe in analytics or separate
                rawQualitativeData: qualitativeData 
            };

            report.dataSnapshot = snapshotData;
            
            await report.save();
            console.log(`Report saved successfully for ${form.title}`);
        }

        console.log("\nAll analyses completed successfully.");
        process.exit(0);

    } catch (err) {
        console.error("Analysis failed:", err);
        process.exit(1);
    }
};

runAnalysis();

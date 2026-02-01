const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const notificationService = require('../services/notificationService');
const User = require('../models/User');

const initReminderCron = () => {
    // Run every hour at the top of the hour
    cron.schedule('0 * * * *', async () => {
        console.log('[CRON] Running reminder check...');
        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

            // Find reminders due today that haven't been notified today
            const dueReminders = await Reminder.find({
                date: { $gte: startOfDay, $lte: endOfDay },
                completed: false,
                $or: [
                    { lastNotifiedAt: { $exists: false } },
                    { lastNotifiedAt: { $lt: startOfDay } }
                ]
            });

            console.log(`[CRON] Found ${dueReminders.length} reminders due today`);

            for (const reminder of dueReminders) {
                try {
                    const user = await User.findById(reminder.userId);
                    if (user) {
                        // Create in-app notification
                        await notificationService.notifyReminderDueSoon(reminder, user);
                        
                        // Update lastNotifiedAt to prevent duplicate notifications today
                        reminder.lastNotifiedAt = now;
                        await reminder.save();
                        
                        console.log(`[CRON] Notified user ${user.name} for reminder: ${reminder.title}`);
                    }
                } catch (error) {
                    console.error(`[CRON] Error processing reminder ${reminder._id}:`, error);
                }
            }
        } catch (error) {
            console.error('[CRON] Error in reminder check:', error);
        }
    });

    console.log('⏰ Reminder cron job initialized (hourly check)');
};

module.exports = { initReminderCron };

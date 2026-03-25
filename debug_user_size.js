const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const User = require('./src/models/User');

async function checkUserSizes() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI not found in .env');
            console.log('Current working directory:', process.cwd());
            return;
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log(`Checking ${users.length} users...`);

        users.forEach(user => {
            const data = JSON.stringify(user.toObject());
            if (data.length > 5000) {
                console.log(`User ${user.email} is LARGE: ${data.length} bytes`);
                const obj = user.toObject();
                for (const key in obj) {
                    const fieldSize = JSON.stringify(obj[key]).length;
                    if (fieldSize > 1000) {
                        console.log(`  - Field "${key}" is ${fieldSize} bytes`);
                    }
                }
            }
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkUserSizes();

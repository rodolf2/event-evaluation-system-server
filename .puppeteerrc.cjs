const path = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer.
    // Use environment variable if set (Render), otherwise use default local path
    cacheDirectory: process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, '.puppeteer_cache'),
};

const path = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer.
    // Use absolute path to match where Chrome is installed in render-build.sh
    cacheDirectory: '/opt/render/project/puppeteer',
};

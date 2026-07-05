const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../assets/menu');
const SUPPORTED_IMAGES = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const SUPPORTED_VIDEOS = ['.mp4', '.mkv', '.webm'];

/**
 * Get all media files from assets/menu folder
 * @returns {Array} Array of {path, type, filename}
 */
function getMenuAssets() {
    try {
        if (!fs.existsSync(ASSETS_DIR)) {
            return [];
        }

        const files = fs.readdirSync(ASSETS_DIR);
        const mediaFiles = [];

        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            const filePath = path.join(ASSETS_DIR, file);

            // Skip directories and README
            if (fs.statSync(filePath).isDirectory()) continue;
            if (file.toLowerCase() === 'readme.md') continue;

            if (SUPPORTED_IMAGES.includes(ext)) {
                mediaFiles.push({
                    path: filePath,
                    type: 'image',
                    filename: file,
                    mimetype: getMimetype(ext)
                });
            } else if (SUPPORTED_VIDEOS.includes(ext)) {
                mediaFiles.push({
                    path: filePath,
                    type: 'video',
                    filename: file,
                    mimetype: getMimetype(ext)
                });
            }
        }

        return mediaFiles;
    } catch (e) {
        console.error('Error reading menu assets:', e.message);
        return [];
    }
}

/**
 * Get a random menu media file
 * @returns {Object|null} {buffer, type, mimetype} or null if no assets
 */
function getRandomMenuAsset() {
    const assets = getMenuAssets();

    if (assets.length === 0) {
        return null;
    }

    const randomAsset = assets[Math.floor(Math.random() * assets.length)];

    try {
        const buffer = fs.readFileSync(randomAsset.path);
        return {
            buffer,
            type: randomAsset.type,
            mimetype: randomAsset.mimetype,
            filename: randomAsset.filename
        };
    } catch (e) {
        console.error('Error reading asset file:', e.message);
        return null;
    }
}

/**
 * Get mimetype from extension
 */
function getMimetype(ext) {
    const mimetypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.webm': 'video/webm'
    };
    return mimetypes[ext] || 'application/octet-stream';
}

/**
 * Check if assets folder has any media files
 */
function hasMenuAssets() {
    return getMenuAssets().length > 0;
}

module.exports = {
    getMenuAssets,
    getRandomMenuAsset,
    hasMenuAssets,
    ASSETS_DIR
};

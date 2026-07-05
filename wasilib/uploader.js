const axios = require('axios');
const FormData = require('form-data');
const { fromBuffer } = require('file-type');
const crypto = require('crypto');
const config = require('../wasi');

// Upload to Catbox.moe
async function wasi_uploadToCatbox(buffer) {
    try {
        const type = await fromBuffer(buffer);
        const ext = type ? type.ext : 'bin';
        const bodyForm = new FormData();

        bodyForm.append('reqtype', 'fileupload');
        bodyForm.append('userhash', ''); // Anonymous upload
        bodyForm.append('fileToUpload', buffer, `file.${ext}`);

        const response = await axios.post('https://catbox.moe/user/api.php', bodyForm, {
            headers: bodyForm.getHeaders(),
        });

        if (response.data && response.data.startsWith('https://')) {
            return response.data;
        } else {
            throw new Error(response.data);
        }
    } catch (error) {
        console.error('Catbox Upload Error:', error.message);
        return null;
    }
}

// Upload to Cloudinary
async function wasi_uploadToCloudinary(buffer) {
    try {
        const cloudName = config.cloudinaryCloudName;
        const apiKey = config.cloudinaryApiKey;
        const apiSecret = config.cloudinaryApiSecret;

        if (!cloudName || !apiKey || !apiSecret) {
            console.error('Cloudinary credentials missing in config');
            return null;
        }

        const timestamp = Math.round(new Date().getTime() / 1000);
        const signature = crypto.createHash('sha1')
            .update(`timestamp=${timestamp}${apiSecret}`)
            .digest('hex');

        const formData = new FormData();
        formData.append('file', buffer, { filename: 'upload.file' });
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);

        const response = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, formData, {
            headers: formData.getHeaders()
        });

        if (response.data && response.data.secure_url) {
            return response.data.secure_url;
        } else {
            throw new Error('Cloudinary response missing secure_url');
        }
    } catch (error) {
        console.error('Cloudinary Upload Error:', error.response?.data?.error?.message || error.message);
        return null;
    }
}

module.exports = { wasi_uploadToCatbox, wasi_uploadToCloudinary };

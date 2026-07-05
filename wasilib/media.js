const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// 1. Catbox Upload (Permanent, up to 200MB)
// Returns URL string
async function wasi_uploadToCatbox(buffer, filename = 'file') {
    try {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', buffer, filename);

        const response = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: formData.getHeaders()
        });

        const url = response.data;
        if (typeof url === 'string' && url.startsWith('http')) {
            return url.trim();
        }
        throw new Error('Invalid response from Catbox');
    } catch (e) {
        console.error('Catbox Upload Error:', e.message);
        if (e.response) {
            console.error('Create Response Status:', e.response.status);
            console.error('Create Response Data:', e.response.data);
        }
        throw e;
    }
}

// 2. Qu.ax Upload (Temporary/Permanent, Alternative)
async function wasi_uploadToQuax(buffer, filename = 'file') {
    try {
        const formData = new FormData();
        formData.append('files[]', buffer, filename);

        const response = await axios.post('https://qu.ax/upload.php', formData, {
            headers: formData.getHeaders()
        });

        if (response.data && response.data.success) {
            return response.data.files[0].url;
        }
        throw new Error('Invalid response from Qu.ax');
    } catch (e) {
        console.error('Qu.ax Upload Error:', e.message);
        throw e;
    }
}

// 2b. Pomf.lain.la Upload (Alternative)
async function wasi_uploadToPomf(buffer, filename = 'file') {
    try {
        const formData = new FormData();
        formData.append('files[]', buffer, filename);

        const response = await axios.post('https://pomf.lain.la/upload.php', formData, {
            headers: formData.getHeaders()
        });

        if (response.data && response.data.success) {
            return response.data.files[0].url;
        }
        throw new Error('Invalid response from Pomf');
    } catch (e) {
        console.error('Pomf Upload Error:', e.message);
        throw e;
    }
}

// 3. Main Upload Function (Universal)
// Strategy: Catbox (most reliable) -> Pomf -> Qu.ax
async function wasi_uploadMedia(buffer, filename = 'media') {
    try {
        return await wasi_uploadToCatbox(buffer, filename);
    } catch (e) {
        console.log('Catbox failed, trying Pomf...');
        try {
            return await wasi_uploadToPomf(buffer, filename);
        } catch (e2) {
            console.log('Pomf failed, trying Qu.ax...');
            return await wasi_uploadToQuax(buffer, filename);
        }
    }
}

// 4. Download Quote/Message Media to Buffer
async function wasi_downloadMedia(wasi_msg, wasi_sock) {
    try {
        // Handle quoted vs direct
        const quoted = wasi_msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let msgToDownload = wasi_msg;

        if (quoted) {
            // Reconstruct valid message object for Baileys
            msgToDownload = {
                message: quoted,
                key: {
                    ...wasi_msg.key,
                    id: wasi_msg.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: wasi_msg.message.extendedTextMessage.contextInfo.participant || wasi_msg.key.remoteJid // fallback
                }
            };
        }

        const buffer = await downloadMediaMessage(
            msgToDownload,
            'buffer',
            {},
            {
                logger: console,
                reuploadRequest: wasi_sock.updateMediaMessage
            }
        );
        return buffer;
    } catch (e) {
        console.error('Download Media Error:', e);
        return null;
    }
}

module.exports = {
    wasi_uploadMedia,
    wasi_downloadMedia,
    wasi_uploadToCatbox,
    wasi_uploadToQuax,
    wasi_uploadToPomf
};

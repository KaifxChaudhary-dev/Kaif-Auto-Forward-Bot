const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../groupSettings.json');

// Load settings
function loadGroupSettings() {
    if (!fs.existsSync(DB_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
        return {};
    }
}

// Save settings
function saveGroupSettings(settings) {
    fs.writeFileSync(DB_PATH, JSON.stringify(settings, null, 2));
}

let settings = loadGroupSettings();

// Core Logic
async function handleAntiBot(sock, msg, isGroup, sender, groupMetadata) {
    if (!isGroup || !sender) return;

    const chatId = msg.key.remoteJid;

    // Check if Anti-Bot is enabled for this group
    if (!settings[chatId]?.antibot) return;

    // Ignore Admins and the Bot itself
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    if (sender === botNumber) return; // Ignore self (Redundant if isFromMe check exists, but safe)

    // BOT DETECTION LOGIC
    const msgId = msg.key.id;
    console.log(`AntiBot Scan: ${sender} | ID: ${msgId}`); // Debug logging

    // Check for Bot ID (Baileys/Web starts with 3EB0)
    // Also checks length to avoid false positives? usually 3EB0 is 20-32 chars.
    if (msgId.startsWith('3EB0')) {

        // NOW check if it's an admin (Expensive check, do it only if suspicious)
        if (!groupMetadata) {
            try {
                groupMetadata = await sock.groupMetadata(chatId);
            } catch { return; }
        }

        if (!groupMetadata || !groupMetadata.participants) return;

        const participant = groupMetadata.participants.find(p => p.id === sender);
        if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
            return; // Ignore Admins
        }

        // DETECTED & NOT ADMIN -> PUNISH
        // Initialize user warnings

        // Initialize user warnings
        if (!settings[chatId].warnings) settings[chatId].warnings = {};
        if (!settings[chatId].warnings[sender]) settings[chatId].warnings[sender] = 0;

        settings[chatId].warnings[sender]++;
        const count = settings[chatId].warnings[sender];
        const limit = 3;

        saveGroupSettings(settings); // Save count

        if (count < limit) {
            // WARNING
            await sock.sendMessage(chatId, {
                text: `⚠️ *@${sender.split('@')[0]}* BOT DETECTED! \n\n> Warning ${count}/${limit}.\n> Default Warning is 3.\n> Turn off your bot or you will be kicked!`,
                mentions: [sender]
            }, { quoted: msg });
        } else {
            // KICK
            await sock.sendMessage(chatId, {
                text: `🚫 *@${sender.split('@')[0]}* Detected as a Bot. Maximum warnings reached. Kicking now!`,
                mentions: [sender]
            });

            try {
                // Must be admin to remove
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                // Reset warnings after kick
                delete settings[chatId].warnings[sender];
                saveGroupSettings(settings);
            } catch (e) {
                await sock.sendMessage(chatId, { text: '❌ Failed to kick. Please make me Admin.' });
            }
        }
    }
}

// Command Handler Helper
function toggleAntiBot(chatId, status) {
    if (!settings[chatId]) settings[chatId] = {};
    settings[chatId].antibot = status;
    saveGroupSettings(settings);
    return status;
}

module.exports = {
    handleAntiBot,
    toggleAntiBot
};

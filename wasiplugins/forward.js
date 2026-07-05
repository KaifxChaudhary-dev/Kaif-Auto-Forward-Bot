module.exports = {
    name: 'forward',
    aliases: ['f'],
    category: 'Tools',
    desc: 'Forward a replied message to multiple JIDs (private, group, or newsletter)',
    wasi_handler: async (wasi_sock, wasi_sender, context) => {
        const { wasi_msg, wasi_args } = context;
        const config = require('../wasi');

        // 1. Get Quoted Message
        let quoted = wasi_msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return await wasi_sock.sendMessage(wasi_sender, { text: '❌ Please reply to a message you want to forward.' });
        }

        // 1b. Robust Unwrap (Handle View Once & nested structures)
        if (quoted.viewOnceMessageV2) {
            quoted = quoted.viewOnceMessageV2.message;
        } else if (quoted.viewOnceMessage) {
            quoted = quoted.viewOnceMessage.message;
        }

        // 2. Parse Targets
        const inputArgs = wasi_args.join(' ');
        if (!inputArgs) {
            const usage = `❌ *Invalid Usage*\n\n` +
                `Provide JIDs separated by commas.\n` +
                `Example: \`.f 123@s.whatsapp.net, 456@g.us, 120363@newsletter\``;
            return await wasi_sock.sendMessage(wasi_sender, { text: usage });
        }

        const targetJids = inputArgs.split(',').map(j => j.trim()).filter(j => j.length > 0);
        if (targetJids.length === 0) {
            return await wasi_sock.sendMessage(wasi_sender, { text: '❌ No valid JIDs found.' });
        }

        // 3. Prepare the Forward Context
        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: config.newsletterJid || '120363419652241844@newsletter',
                newsletterName: config.newsletterName || 'WASI-MD-V7',
                serverMessageId: -1
            }
        };

        const mType = Object.keys(quoted).find(k => k.endsWith('Message') || k === 'conversation' || k === 'stickerMessage');
        if (mType && quoted[mType] && typeof quoted[mType] === 'object') {
            quoted[mType].contextInfo = {
                ...(quoted[mType].contextInfo || {}),
                ...contextInfo
            };
        }

        // 4. Relay Loop
        let successCount = 0;
        let failCount = 0;
        const failedJids = [];

        for (const jid of targetJids) {
            try {
                let target = jid;
                if (!target.includes('@')) {
                    target = target + '@s.whatsapp.net';
                }

                await wasi_sock.relayMessage(target, quoted, {
                    messageId: wasi_sock.generateMessageTag()
                });

                successCount++;
                await new Promise(r => setTimeout(r, 800));

            } catch (error) {
                console.error(`Relay failed for ${jid}:`, error.message);
                failCount++;
                failedJids.push(jid);
            }
        }

        // 5. Final Report (صرف فیل ہونے پر)
        if (failCount > 0) {
            let report = `⚠️ *کچھ JIDs پر بھیجنا ناکام رہا*\n\n`;
            report += `❌ *Failed:* ${failCount}\n`;
            report += `✨ *Mode:* Native Relay`;
            report += `\n\n*Failed List:*\n${failedJids.map(j => `> ${j}`).join('\n')}`;

            await wasi_sock.sendMessage(wasi_sender, { text: report });
        }
    }
};

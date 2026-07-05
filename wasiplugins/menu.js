const { getMenu } = require('../wasilib/menus');

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'list'],
    category: 'General',
    desc: 'Show all available commands',
    wasi_handler: async (wasi_sock, wasi_sender, context) => {
        const { wasi_plugins, wasi_msg } = context;
        const config = require('../wasi');

        try {
            // یوزر کا نام
            const userName = wasi_msg.pushName || 'User';

            // مینو جنریشن
            const styles = config.menuStyle || 'classic';
            const menuText = getMenu(wasi_plugins, userName, styles);

            // Context Info (optional, forwarded/newsletter style)
            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.newsletterJid || '120363419652241844@newsletter',
                    newsletterName: config.newsletterName || 'WASI-MD-V7',
                    serverMessageId: -1
                }
            };

            // صرف ٹیکسٹ مینو بھیجنا
            await wasi_sock.sendMessage(wasi_sender, {
                text: menuText,
                contextInfo: contextInfo
            });

        } catch (e) {
            console.error('Menu Error:', e);
            await wasi_sock.sendMessage(wasi_sender, { text: '❌ Failed to load menu.' });
        }
    }
};

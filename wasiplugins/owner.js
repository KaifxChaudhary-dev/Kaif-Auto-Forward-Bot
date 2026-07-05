module.exports = {
    name: 'owner',
    category: 'Info',
    desc: 'Shows full owner contact information without forwarded tag',
    wasi_handler: async (wasi_sock, wasi_sender) => {
        try {
            const message = `━━━━━━━━━━━━━━━━━━━━━━
📇  CONTACT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━

👤 Name : Hidden  😛 

📍 Location : Pakistan  

💼 Role : Bot Developer & Tech Support    

🌐 Services  

• WhatsApp Bots  
• Telegram Bots  
• Smart Automation


📧 Email    : paidwhatsappbot.com


💬 Telegram  
🔗 https://t.me/paid_whatsapp_bot  


📱 WhatsApp Contact  
🔗 https://whatsapp.com/channel/0029Vasn4ipCBtxCxfJqgV3S

━━━━━━━━━━━━━━━━━━━━━━
©ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘᴀɪᴅ ᴡʜᴀᴛsᴀᴘᴘ ʙᴏᴛ
━━━━━━━━━━━━━━━━━━━━━━`;

            await wasi_sock.sendMessage(wasi_sender, {
                text: message,
                contextInfo: { // یہ forwarded / quoted remove کرے گا
                    forwardingScore: 0,
                    isForwarded: false
                }
            });

        } catch (error) {
            console.error(error);
            await wasi_sock.sendMessage(wasi_sender, { text: 'Failed to send owner info.' });
        }
    }
};

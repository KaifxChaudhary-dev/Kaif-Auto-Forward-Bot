module.exports = {
    name: 'owner',
    category: 'Info',
    desc: 'Shows full owner contact information without forwarded tag',
    wasi_handler: async (wasi_sock, wasi_sender) => {
        try {
            const message = `━━━━━━━━━━━━━━━━━━━━━━
📇  CONTACT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━

👤 Name : Kaif 

📍 Location : Pakistan  

💼 Role : Bot Developer & Tech Support    

🌐 Services  

• WhatsApp Bots  
• Telegram Bots  
• Smart Automation


📧 Email    : kaifxchaudhary@gmail.com


💬 Telegram  
🔗 https://t.me  


📱 WhatsApp Contact  
🔗 https://whatsapp.com/channel/0029VbDMt1C3rZZaigDWAj1X

━━━━━━━━━━━━━━━━━━━━━━
©Powered By Kaif x Chaudhary
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

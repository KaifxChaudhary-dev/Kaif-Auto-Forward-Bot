module.exports = {
    name: 'alive',
    category: 'General',
    desc: 'Check bot uptime only',
    wasi_handler: async (wasi_sock, wasi_sender) => {
        // 🔹 Uptime Calculation
        const wasi_uptime = process.uptime();
        const wasi_days = Math.floor(wasi_uptime / 86400);
        const wasi_hours = Math.floor((wasi_uptime % 86400) / 3600);
        const wasi_minutes = Math.floor((wasi_uptime % 3600) / 60);
        const wasi_seconds = Math.floor(wasi_uptime % 60);

        // 🔹 Build clean uptime string
        let uptimeParts = [];
        if (wasi_days) uptimeParts.push(`${wasi_days}d`);
        if (wasi_hours) uptimeParts.push(`${wasi_hours}h`);
        if (wasi_minutes) uptimeParts.push(`${wasi_minutes}m`);
        if (wasi_seconds) uptimeParts.push(`${wasi_seconds}s`);
        const uptimeString = uptimeParts.join(' ') || '0s'; // fallback

        // 🔹 Status Text (Only uptime)
        const wasi_status = `⌚ *Bot Running From:* ${uptimeString}`;

        // 🔹 Send Message
        await wasi_sock.sendMessage(wasi_sender, {
            text: wasi_status,
            mentions: [wasi_sender]
        });
    }
};

module.exports = {
    name: 'ping',
    category: 'General',
    desc: 'Clean ping with fast 10-step loader (5s total)',
    wasi_handler: async (wasi_sock, wasi_sender) => {
        const start = Date.now();

        // First message
        const sentMsg = await wasi_sock.sendMessage(wasi_sender, {
            text: '🔎 Checking Ping 😁'
        });

        // 10 steps loader
        const steps = [
            '⏳ Wait 10s | ▰▱▱▱▱▱▱▱▱▱ ✨',
            '⏳ Wait 9s  | ▰▰▱▱▱▱▱▱▱▱ ✨',
            '⏳ Wait 8s  | ▰▰▰▱▱▱▱▱▱▱ ✨',
            '⏳ Wait 7s  | ▰▰▰▰▱▱▱▱▱▱ ✨',
            '⏳ Wait 6s  | ▰▰▰▰▰▱▱▱▱▱ ✨',
            '⏳ Wait 5s  | ▰▰▰▰▰▰▱▱▱▱ ✨',
            '⏳ Wait 4s  | ▰▰▰▰▰▰▰▱▱▱ ✨',
            '⏳ Wait 3s  | ▰▰▰▰▰▰▰▰▱▱ ✨',
            '⏳ Wait 2s  | ▰▰▰▰▰▰▰▰▰▱ ✨',
            '⏳ Wait 1s  | ▰▰▰▰▰▰▰▰▰▰ ✨'
        ];

        // Double speed → 500ms per step (10 × 0.5s = 5s)
        for (const step of steps) {
            await new Promise(r => setTimeout(r, 500));
            await wasi_sock.sendMessage(wasi_sender, {
                text: step,
                edit: sentMsg.key
            });
        }

        const latency = Date.now() - start;

        await wasi_sock.sendMessage(wasi_sender, {
            text: `🏓 Pong Latency ${latency}ms`,
            edit: sentMsg.key
        });
    }
};

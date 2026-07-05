const userState = {}; // track warnings and lock status per user

module.exports = {
    name: 'repo',
    category: 'General',
    desc: 'Contact owner with password protection',
    wasi_handler: async (wasi_sock, wasi_sender) => {
        const userId = wasi_sender;

        // Check if user is locked
        if (userState[userId]?.locked) {
            await wasi_sock.sendMessage(userId, { text: `You are currently locked. Please wait.` });
            return;
        }

        // Ask for password
        await wasi_sock.sendMessage(userId, { text: 'Please enter the password to use this command:' });

        const handler = async ({ messages }) => {
            const msg = messages[0];

            // Only process messages from the same user
            if (!msg.message) return;
            if (msg.key.fromMe) return;
            if (msg.key.remoteJid !== userId) return;
            if (!msg.message.conversation) return;

            const text = msg.message.conversation.trim();

            // Correct password
            if (text === '0000') {
                await wasi_sock.sendMessage(userId, {
                    text: 'Password correct! You can use the bot now.\nhttps://t.me/tg_wa_video_bot'
                });
                wasi_sock.ev.off('messages.upsert', handler);
                userState[userId] = { warnings: 0 };
                return;
            }

            // Wrong password
            if (!userState[userId]) userState[userId] = { warnings: 0 };
            userState[userId].warnings += 1;

            if (userState[userId].warnings < 3) {
                await wasi_sock.sendMessage(userId, {
                    text: `Wrong password! Warning ${userState[userId].warnings}/3`
                });
            } else {
                // Lock user for 1 minute
                const lockTime = 60; // seconds
                userState[userId].locked = true;
                userState[userId].warnings = 0;

                // Send initial lock message
                const sentMsg = await wasi_sock.sendMessage(userId, {
                    text: 'You are locked for 1 minute.\nTime left: 60s\nProgress: [----------]'
                });

                // Timer + progress bar + loading emoji
                let secondsLeft = lockTime;
                let loadingFrames = ['⏳', '⏳.', '⏳..', '⏳...'];
                let frameIndex = 0;
                const progressBars = 10; // total boxes
                let boxIndex = 0; // current filled box

                const timer = setInterval(async () => {
                    secondsLeft--;
                    frameIndex = (frameIndex + 1) % loadingFrames.length;

                    // Progress bar: 1 box per second, loop after 10
                    boxIndex = (boxIndex + 1) % (progressBars + 1);
                    const progressBar = `[${'█'.repeat(boxIndex)}${'-'.repeat(progressBars - boxIndex)}]`;

                    const newText = `You are locked.\nTime left: ${secondsLeft}s ${loadingFrames[frameIndex]}\nProgress: ${progressBar}`;

                    try {
                        await wasi_sock.sendMessage(userId, {
                            text: newText,
                            edit: sentMsg.key.id
                        });
                    } catch (e) {}

                    if (secondsLeft <= 0) {
                        clearInterval(timer);
                        userState[userId].locked = false;
                        await wasi_sock.sendMessage(userId, {
                            text: 'Lock ended! You can try the command again.',
                            edit: sentMsg.key.id
                        });
                    }
                }, 1000);

                // Stop listening to this user
                wasi_sock.ev.off('messages.upsert', handler);
            }
        };

        wasi_sock.ev.on('messages.upsert', handler);
    }
};

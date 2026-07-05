// اس کوڈ میں کیںاکیا کام ہو رہیں ہیں  سادہ الفاظ میں بتاؤ 

require('dotenv').config();
const {
    DisconnectReason,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { wasi_connectSession, wasi_clearSession } = require('./wasilib/session');
const { applyFont } = require('./wasilib/fonts');
const {
    wasi_connectDatabase,
    wasi_isCommandEnabled,
    wasi_getAllSessions,
    wasi_registerSession,
    wasi_unregisterSession,
    wasi_saveAutoReplies,
    wasi_getAutoReplies,
    wasi_getGroupSettings
} = require('./wasilib/database');
// ... imports ...

const config = require('./wasi');

// Load persistent config
try {
    if (fs.existsSync(path.join(__dirname, 'botConfig.json'))) {
        const savedConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'botConfig.json')));
        Object.assign(config, savedConfig);
    }
} catch (e) {
    console.error('Failed to load botConfig.json:', e);
}

const wasi_app = express();
const wasi_port = process.env.PORT || 3000;

// Load Plugins
const wasi_plugins = new Map();
function wasi_loadPlugins() {
    const pluginDir = path.join(__dirname, 'wasiplugins');
    if (!fs.existsSync(pluginDir)) return;

    const files = fs.readdirSync(pluginDir);
    for (const file of files) {
        if (file.endsWith('.js')) {
            const plugin = require(`./wasiplugins/${file}`);
            if (plugin.name) {
                const name = plugin.name.toLowerCase();
                wasi_plugins.set(name, plugin);
                if (plugin.aliases && Array.isArray(plugin.aliases)) {
                    plugin.aliases.forEach(alias => wasi_plugins.set(alias.toLowerCase(), plugin));
                }
            }
        }
    }
    // console.log(`✅ Loaded ${wasi_plugins.size} commands`);
}
// CALL IT IMMEDIATELY
wasi_loadPlugins();

const QRCode = require('qrcode');

// -----------------------------------------------------------------------------
// MULTI-SESSION STATE
// -----------------------------------------------------------------------------
// Map<sessionId, { sock: object, isConnected: boolean, qr: string, reconnectAttempts: number }>
const sessions = new Map();
let isDbConnected = false;

// Middleware
wasi_app.use(express.json());
wasi_app.use(express.static(path.join(__dirname, 'public')));

// Keep-Alive Route
wasi_app.get('/ping', (req, res) => res.status(200).send('pong'));

// Self-Ping
setInterval(() => {
    if (config.alwaysOnline) {
        // Heartbeat logic
    }
}, 30000);

// -----------------------------------------------------------------------------
// SESSION MANAGEMENT
// -----------------------------------------------------------------------------

async function startSession(sessionId) {
    if (sessions.has(sessionId)) {
        const existing = sessions.get(sessionId);
        // If already connected and not forced, don't restart
        if (existing.isConnected && existing.sock) {
            console.log(`Session ${sessionId} is already connected. Skipping start.`);
            return;
        }

        if (existing.sock) {
            console.log(`Cleaning up old socket for ${sessionId}...`);
            existing.sock.ev.removeAllListeners('connection.update');
            existing.sock.end(undefined);
            sessions.delete(sessionId);
        }
    }

    console.log(`🚀 Starting session: ${sessionId}`);

    // Initialize session state
    const sessionState = {
        sock: null,
        isConnected: false,
        qr: null,
        reconnectAttempts: 0,
        messageLog: new Map(), // Cache for Antidelete
        config: { ...config } // Default config
    };
    sessions.set(sessionId, sessionState);

    // Load session-specific config from DB
    const { wasi_getBotConfig } = require('./wasilib/database');
    const dbConfig = await wasi_getBotConfig(sessionId);
    if (dbConfig) {
        sessionState.config = { ...config, ...(dbConfig.toObject ? dbConfig.toObject() : dbConfig) };
    }

    // Connect to session (this creates the socket)
    const { wasi_sock, saveCreds } = await wasi_connectSession(false, sessionId);

    // Intercept sendMessage to apply session-specific font style
    const originalSendMessage = wasi_sock.sendMessage;
    wasi_sock.sendMessage = async (jid, content, options) => {
        const sessionConfig = sessions.get(sessionId)?.config || config;
        const style = sessionConfig.fontStyle || 'original';
        if (style !== 'original') {
            if (content.text) {
                content.text = applyFont(content.text, style);
            }
            if (content.caption) {
                content.caption = applyFont(content.caption, style);
            }
        }

        // Add Channel Button / Newsletter Context
        if (content && typeof content === 'object') {
            content.contextInfo = {
                ...(content.contextInfo || {}),
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: sessionConfig.newsletterJid || '120363419652241844@newsletter',
                    newsletterName: sessionConfig.newsletterName || 'WASI-MD-V7',
                    serverMessageId: -1
                }
            };
        }

        return await originalSendMessage.call(wasi_sock, jid, content, options);
    };

    sessionState.sock = wasi_sock;

    wasi_sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            sessionState.qr = qr;
            sessionState.isConnected = false;
            console.log(`Creating QR for session: ${sessionId}`);
        }

        if (connection === 'close') {
            sessionState.isConnected = false;
            const statusCode = (lastDisconnect?.error instanceof Boom) ?
                lastDisconnect.error.output.statusCode : 500;

            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440;

            console.log(`Session ${sessionId}: Connection closed (${statusCode}), reconnecting: ${shouldReconnect}`);

            // Double check if this session state is still the active one
            const currentSession = sessions.get(sessionId);
            if (currentSession && currentSession.sock === wasi_sock && shouldReconnect) {
                setTimeout(() => {
                    startSession(sessionId);
                }, 3000); // 3 seconds delay
            } else if (!shouldReconnect) {
                console.log(`Session ${sessionId} logged out or replaced. Removing.`);
                sessions.delete(sessionId);
                await wasi_clearSession(sessionId);
                await wasi_unregisterSession(sessionId);
            }
        } else if (connection === 'open') {
            sessionState.isConnected = true;
            sessionState.qr = null;
            sessionState.reconnectAttempts = 0;
            console.log(`✅ [CONNECTION] ${sessionId}: Bot is fully connected to WhatsApp and groups.`);

            // Register session in DB to ensure it restarts on server reboot
            await wasi_registerSession(sessionId);

            // Send Connected Message to Self
            try {
                const userJid = jidNormalizedUser(wasi_sock.user.id);
                const caption = `┏━━┫ *SERVER STATUS* ┣━━┓\n` +
                    `┃ 🟢 *Bot Connected Successfully!*\n` +
                    `┃ 🤖 *Bot Name:* ${config.botName}\n` +
                    `┃ 🆔 *Session:* ${sessionId}\n` +
                    `┃ 📅 *Date:* ${new Date().toLocaleString()}\n` +
                    `┗━━━━━━━━━━━━━━━━━━━┛\n\n` +
                    `> _Powered by WASI BOT_`;

                const imageUrl = config.menuImage && config.menuImage.startsWith('http') ? config.menuImage : 'https://dummyimage.com/600x400/000/fff&text=WASI+BOT';

                try {
                    await wasi_sock.sendMessage(userJid, {
                        image: { url: imageUrl },
                        caption: caption
                    });
                } catch (imgError) {
                    // Fallback to text if image fails
                    await wasi_sock.sendMessage(userJid, { text: caption });
                }

            } catch (e) {
                console.error('Failed to send connected message:', e);
            }
        }
    });

    wasi_sock.ev.on('creds.update', saveCreds);

    // Call Rejection (Anti-Call)
    wasi_sock.ev.on('call', async (calls) => {
        const sessionConfig = sessions.get(sessionId)?.config || config;
        if (sessionConfig.autoRejectCall) {
            for (const call of calls) {
                if (call.status === 'offer') {
                    console.log(`☎️ [ANTICALL] Rejecting call from: ${call.from}`);
                    await wasi_sock.rejectCall(call.id, call.from);

                    const message = sessionConfig.anticallMessage || "*Hii, I am WASI-MD-V7.*\n\n⚠️ *I cannot receive calls right now.*\nPlease leave a text message instead.\n\n> _Auto-Reject Feature_";

                    await wasi_sock.sendMessage(call.from, {
                        text: message,
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true
                        }
                    });
                }
            }
        }
    });

    // Group Participants Update
    wasi_sock.ev.on('group-participants.update', async (update) => {
        const { handleGroupParticipantsUpdate } = require('./wasilib/groupevents');
        await handleGroupParticipantsUpdate(wasi_sock, update, sessionState.config, sessionId);
    });

    await setupMessageHandler(wasi_sock, sessionId);
}

// -----------------------------------------------------------------------------
// API ROUTES
// -----------------------------------------------------------------------------

// Get status (defaults to default session, or specific session)
wasi_app.get('/api/status', async (req, res) => {
    // Priority: query > config > default
    const sessionId = req.query.sessionId || config.sessionId || 'wasi_session';
    const session = sessions.get(sessionId);

    let qrDataUrl = null;
    let connected = false;

    if (session) {
        connected = session.isConnected;
        if (session.qr) {
            try {
                qrDataUrl = await QRCode.toDataURL(session.qr, { width: 256 });
            } catch (e) { }
        }
    }

    res.json({
        sessionId,
        connected,
        qr: qrDataUrl,
        database: isDbConnected,
        activeSessions: Array.from(sessions.keys())
    });
});

// Get config for a specific session
wasi_app.get('/api/config', async (req, res) => {
    const sessionId = req.query.sessionId || config.sessionId || 'wasi_session';
    let baseConfig = { ...config };

    if (isDbConnected) {
        const { wasi_getBotConfig, wasi_getAutoReplies } = require('./wasilib/database');
        const dbConfig = await wasi_getBotConfig(sessionId);
        if (dbConfig) {
            baseConfig = { ...baseConfig, ...(dbConfig.toObject ? dbConfig.toObject() : dbConfig) };
        }

        const dbReplies = await wasi_getAutoReplies(sessionId);
        if (dbReplies && dbReplies.length > 0) {
            baseConfig.autoReplies = dbReplies;
        }
    }
    res.json(baseConfig);
});

// Save config
wasi_app.post('/api/config', async (req, res) => {
    try {
        const newConfig = req.body;
        const targetSessionId = newConfig.sessionId || config.sessionId || 'wasi_session';
        const oldUrl = config.mongoDbUrl;

        // 1. Save to DB if connected (Partitioned by targetSessionId)
        if (isDbConnected) {
            const { wasi_updateBotConfig, wasi_saveAutoReplies } = require('./wasilib/database');
            await wasi_updateBotConfig(targetSessionId, newConfig);
            if (newConfig.autoReplies) {
                await wasi_saveAutoReplies(targetSessionId, newConfig.autoReplies);
            }
        }

        // 2. Handle Global Settings Change (MongoDB URL / Main Session ID)
        if (newConfig.sessionId && newConfig.sessionId !== config.sessionId) {
            const oldSessionId = config.sessionId;
            config.sessionId = newConfig.sessionId; // Update global state

            if (sessions.has(oldSessionId)) {
                console.log(`Stopping old session ${oldSessionId} due to ID change...`);
                const old = sessions.get(oldSessionId);
                if (old.sock) old.sock.end();
                sessions.delete(oldSessionId);
            }
            await startSession(newConfig.sessionId);
        }

        if (newConfig.mongoDbUrl && newConfig.mongoDbUrl.trim() !== "" && newConfig.mongoDbUrl !== oldUrl) {
            config.mongoDbUrl = newConfig.mongoDbUrl;
            console.log('🔗 New MongoDB URL provided. Attempting to connect...');
            const dbResult = await wasi_connectDatabase(newConfig.mongoDbUrl);
            if (dbResult) {
                isDbConnected = true;
                await restoreAllSessions();
            }
        }

        // 3. Hot-Reload specifically for the session being edited
        const activeItem = sessions.get(targetSessionId);
        if (activeItem) {
            activeItem.config = { ...(activeItem.config || config), ...newConfig };
            console.log(`🔥 Isolated Hot-Reload: ${targetSessionId}`);
        }

        // 4. Update local file for next startup defaults
        try {
            fs.writeFileSync(path.join(__dirname, 'botConfig.json'), JSON.stringify(config, null, 2));
        } catch (err) { }

        res.json({ success: true, message: 'Configuration saved and applied to session!' });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});


// Pair/Create Session
wasi_app.post('/api/pair', async (req, res) => {
    try {
        const { phone, sessionId: customId } = req.body;
        if (!phone) return res.json({ error: 'Phone number required' });

        const sessionId = customId || `user_${phone}`;

        // 1. Kill and clear any existing session for this ID to prevent conflicts
        if (sessions.has(sessionId)) {
            const old = sessions.get(sessionId);
            if (old.sock) {
                old.sock.ev.removeAllListeners('connection.update');
                old.sock.end(undefined);
            }
            sessions.delete(sessionId);
        }
        await wasi_clearSession(sessionId);

        // 2. Start Pairing Flow with a clean Promise-based approach
        console.log(`🌀 Initializing pairing for: ${sessionId} (${phone})`);
        const code = await startPairingSession(sessionId, phone);

        res.json({ code, sessionId });

    } catch (e) {
        console.error('Pairing error:', e);
        res.json({ error: e.message || 'Failed to generate code. Try again.' });
    }
});

async function startPairingSession(sessionId, phone) {
    return new Promise(async (resolve, reject) => {
        try {
            const { wasi_sock, saveCreds } = await wasi_connectSession(true, sessionId);

            const sessionState = { sock: wasi_sock, isConnected: false, qr: null };
            sessions.set(sessionId, sessionState);

            let codeResolved = false;
            let requestLock = false;

            const requestCode = async (attempt = 1) => {
                if (codeResolved || requestLock) return;
                requestLock = true;

                try {
                    // Small delay for socket stabilization
                    await new Promise(r => setTimeout(r, 4000));

                    if (wasi_sock.authState.creds.registered) {
                        codeResolved = true;
                        return resolve('ALREADY_REGISTERED');
                    }

                    const code = await wasi_sock.requestPairingCode(phone);
                    console.log(`✅ Pairing code for ${sessionId}: ${code}`);
                    codeResolved = true;
                    resolve(code);
                } catch (e) {
                    console.error(`❌ Pairing request failed (Attempt ${attempt}):`, e.message);

                    // If connection closed (428) or other transient error, retry once after 3s
                    if (attempt < 2 && (e.message.includes('Closed') || e.message.includes('428'))) {
                        requestLock = false;
                        setTimeout(() => requestCode(attempt + 1), 3000);
                    } else {
                        reject(e);
                    }
                } finally {
                    requestLock = false;
                }
            };

            wasi_sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // When QR or pairing eligibility is detected
                if (qr && !codeResolved) {
                    requestCode();
                }

                if (connection === 'open') {
                    console.log(`✨ Session ${sessionId} paired and open!`);
                    sessionState.isConnected = true;
                    await wasi_registerSession(sessionId);
                }

                if (connection === 'close') {
                    const statusCode = (lastDisconnect?.error instanceof Boom) ?
                        lastDisconnect.error.output.statusCode : 500;

                    sessionState.isConnected = false;

                    if (statusCode !== DisconnectReason.loggedOut && !codeResolved) {
                        // Transient close during pairing - will be handled by Baileys reconnect or manual retry
                        console.log(`⚠️ Pairing socket closed (${statusCode}). Ready for retry.`);
                    }
                }
            });

            wasi_sock.ev.on('creds.update', saveCreds);

            // Fallback: If no QR event within 8s, force the request
            setTimeout(() => {
                if (!codeResolved) {
                    console.log(`🕒 Fallback: Forcing pairing request for ${sessionId}`);
                    requestCode();
                }
            }, 8000);

        } catch (e) {
            reject(e);
        }
    });
}

// Disconnect
wasi_app.post('/api/disconnect', async (req, res) => {
    const sessionId = req.body.sessionId || config.sessionId || 'wasi_session';
    try {
        const session = sessions.get(sessionId);
        if (session && session.sock) {
            await session.sock.logout();
            session.sock.end();
            sessions.delete(sessionId);
        }

        await wasi_clearSession(sessionId);
        await wasi_unregisterSession(sessionId); // Remove from DB index

        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

wasi_app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

function wasi_startServer() {
    wasi_app.listen(wasi_port, () => {
        console.log(`\n🌐 Web Dashboard: http://localhost:${wasi_port}`);
    });
}

// -----------------------------------------------------------------------------
// MAIN STARTUP
// -----------------------------------------------------------------------------

async function restoreAllSessions() {
    if (!isDbConnected) return;

    const currentSessionId = config.sessionId || 'wasi_session';
    console.log(`🔄 Session Sync: Identifying [${currentSessionId}]`);

    if (!sessions.has(currentSessionId)) {
        await startSession(currentSessionId);
    }
}

async function main() {
    // 1. Connect DB (Optional at startup)
    if (config.mongoDbUrl) {
        const dbResult = await wasi_connectDatabase(config.mongoDbUrl);
        if (dbResult) {
            isDbConnected = true;
            console.log('✅ Database connected at startup');
        } else {
            console.error('⚠️ Database connection failed at startup. Use dashboard to fix.');
        }
    } else {
        console.log('ℹ️ No MongoDB URL found. Use dashboard to configure.');
    }

    // 2. Load Plugins
    wasi_loadPlugins();
    console.log(`📡 [SYSTEM] Loaded ${wasi_plugins.size} commands and ready for execution.`);

    // 3. Start Server (Always start so dashboard is accessible)
    wasi_startServer();

    // 4. Restore Sessions (Only if DB is connected)
    if (isDbConnected) {
        await restoreAllSessions();
    } else {
        const hasUrl = !!config.mongoDbUrl;
        console.log(`⏳ Database: ${hasUrl ? 'Found URL but connection failed' : 'No URL found'}.`);
    }
}

// Separate message handler setup
async function setupMessageHandler(wasi_sock, sessionId) {
    // FETCH DYNAMIC CONFIG ONCE (not on every message)
    const { wasi_getBotConfig } = require('./wasilib/database');
    let dbConfig = await wasi_getBotConfig(sessionId);
    if (dbConfig && typeof dbConfig.toObject === 'function') dbConfig = dbConfig.toObject();

    // Merge with defaults. DB config takes precedence if values exist.
    // Merge with defaults. DB config takes precedence if values exist.
    const initialConfig = { ...config, ...dbConfig };

    // Ensure critical defaults if DB has partial data
    if (!initialConfig.prefix) initialConfig.prefix = config.prefix || '.';

    // Save config to session state for live updates
    if (sessions.has(sessionId)) {
        sessions.get(sessionId).config = initialConfig;
    }

    // console.log(`📝 Loaded config for ${sessionId}: prefix="${initialConfig.prefix}"`);
    console.log(`✅ [SESSION] ${sessionId} is now listening for messages...`);

    wasi_sock.ev.on('messages.upsert', async wasi_m => {
        const wasi_msg = wasi_m.messages[0];
        if (!wasi_msg.message) return;

        // EXTRACT ALL CONTEXT AT TOP
        // CONTEXT PREPARATION
        const currentConfig = sessions.get(sessionId)?.config || initialConfig;
        const wasi_origin = wasi_msg.key.remoteJid;
        const wasi_sender = jidNormalizedUser(wasi_msg.key.participant || wasi_msg.key.remoteJid);
        const meJid = jidNormalizedUser(wasi_sock.user?.id || wasi_sock.authState?.creds?.me?.id);
        const botJids = new Set([meJid, jidNormalizedUser(currentConfig.ownerNumber + '@s.whatsapp.net')].filter(Boolean));

        const wasi_text = wasi_msg.message.conversation ||
            wasi_msg.message.extendedTextMessage?.text ||
            wasi_msg.message.imageMessage?.caption ||
            wasi_msg.message.videoMessage?.caption ||
            wasi_msg.message.documentMessage?.caption || "";

        // -------------------------------------------------------------------------
        // DEVELOPER/OWNER REACTION LOGIC (GLOBAL)
        // -------------------------------------------------------------------------
        try {
            const { developerNumbers, reactionEmoji } = require('./wasilib/developer');

            // Reliable Sender Extraction
            const senderJid = wasi_msg.key.participant || wasi_msg.key.remoteJid;
            const senderNum = senderJid ? senderJid.split('@')[0].split(':')[0].replace(/\D/g, '') : '';

            const ownerNumRaw = (currentConfig.ownerNumber || '').toString();
            const ownerNumber = ownerNumRaw.replace(/\D/g, '');

            // Ensure developers list handles strings/numbers consistently
            const isDev = developerNumbers.some(dev => dev.toString().replace(/\D/g, '') === senderNum);
            const isOwner = senderNum === ownerNumber;

            // Only react if valid sender, user is authorized, and it's NOT a reaction message (avoid loops)
            // also ensure we don't react to ourselves endlessly if we are just reacting
            // The check !wasi_msg.message.reactionMessage prevents reacting to reactions.
            if (senderNum && (isDev || isOwner) && !wasi_msg.message.reactionMessage) {
                // React to every message from Dev/Owner in any chat
                await wasi_sock.sendMessage(wasi_origin, {
                    react: {
                        text: reactionEmoji || '👨‍💻',
                        key: wasi_msg.key
                    }
                });
            }
        } catch (devErr) {
            console.error('Developer Reaction Error:', devErr.message);
        }

        // 1. AVOID LOOPS & ALLOW SELF-COMMANDS
        if (wasi_msg.key.fromMe) {
            // Only continue if it's a command (starts with prefix)
            const prefixes = [currentConfig.prefix, '.', '/'].filter(Boolean);
            if (!prefixes.some(p => wasi_text.trim().startsWith(p))) return;
        }

        // -------------------------------------------------------------------------
        // MESSAGE CACHING (ANTIDELETE)
        // -------------------------------------------------------------------------
        const sessionState = sessions.get(sessionId);
        if (sessionState && sessionState.messageLog) {
            // Prune old messages (keep last 500)
            if (sessionState.messageLog.size > 500) {
                const firstKey = sessionState.messageLog.keys().next().value;
                sessionState.messageLog.delete(firstKey);
            }
            sessionState.messageLog.set(wasi_msg.key.id, wasi_msg);
        }

        // -------------------------------------------------------------------------
        // ADVANCED ANTIDELETE CHECK (Protocol Message)
        // -------------------------------------------------------------------------
        if (wasi_msg.message.protocolMessage && wasi_msg.message.protocolMessage.type === 0) {
            const keyToRevoke = wasi_msg.message.protocolMessage.key;
            if (keyToRevoke && sessionState && sessionState.messageLog) {
                const deletedMsg = sessionState.messageLog.get(keyToRevoke.id);
                if (deletedMsg) {
                    const chatJid = wasi_msg.key.remoteJid;
                    const { wasi_getGroupSettings } = require('./wasilib/database');
                    const groupSettings = await wasi_getGroupSettings(sessionId, chatJid);

                    if (groupSettings && groupSettings.antidelete) {
                        const destination = groupSettings.antideleteDestination || 'group';
                        const deleterJid = wasi_msg.key.participant || wasi_msg.key.remoteJid;

                        // Ignore if the bot itself deleted the message
                        if (botJids.has(jidNormalizedUser(deleterJid))) return;

                        const deleterNum = deleterJid.split('@')[0].split(':')[0];
                        const originalSender = deletedMsg.key.participant || deletedMsg.key.remoteJid;
                        const originalNum = originalSender.split('@')[0].split(':')[0];

                        console.log(`🗑️ Antidelete triggered in ${chatJid} (dest: ${destination})`);

                        // Build info message
                        const isGroup = chatJid.endsWith('@g.us');
                        let infoText = `🗑️ *DELETED MESSAGE RECOVERED*\n\n`;
                        infoText += `👤 *Original Sender:* @${originalNum}\n`;
                        if (isGroup && deleterJid !== originalSender) {
                            infoText += `🗑️ *Deleted By:* @${deleterNum}\n`;
                        }
                        infoText += `⏰ *Time:* ${new Date().toLocaleString()}\n`;
                        if (isGroup) {
                            infoText += `📍 *Group:* ${chatJid}\n`;
                        }
                        infoText += `\n📝 *Message Content Below:*`;

                        const mentions = [originalSender];
                        if (deleterJid !== originalSender) mentions.push(deleterJid);

                        try {
                            // Send to group
                            if (destination === 'group' || destination === 'both') {
                                await wasi_sock.sendMessage(chatJid, {
                                    text: infoText,
                                    mentions: mentions
                                });
                                await wasi_sock.sendMessage(chatJid, { forward: deletedMsg });
                            }

                            // Send to owner
                            if (destination === 'owner' || destination === 'both') {
                                const ownerJid = (currentConfig.ownerNumber || '').replace(/\D/g, '') + '@s.whatsapp.net';
                                if (ownerJid !== '@s.whatsapp.net') {
                                    await wasi_sock.sendMessage(ownerJid, {
                                        text: infoText,
                                        mentions: mentions
                                    });
                                    await wasi_sock.sendMessage(ownerJid, { forward: deletedMsg });
                                }
                            }
                        } catch (e) {
                            console.error('Antidelete Resend Failed:', e);
                        }
                    }
                }
            }
        }

        const messageTimestamp = wasi_msg.messageTimestamp;
        if (messageTimestamp) {
            const messageTime = typeof messageTimestamp === 'number' ? messageTimestamp : (messageTimestamp.low || messageTimestamp);
            const currentTime = Math.floor(Date.now() / 1000);

            // --- XP SYSTEM ---
            if (!wasi_msg.key.fromMe && currentConfig.levelup) {
                try {
                    const { wasi_addXP, wasi_getXP } = require('./wasilib/database');
                    const { generateLevelUpCard } = require('./wasilib/levelup');

                    // Award 1-5 XP per message
                    const xpAmount = Math.floor(Math.random() * 5) + 1;
                    const newLevel = await wasi_addXP(sessionId, wasi_sender, xpAmount);

                    if (newLevel) {
                        try {
                            // Fetch latest data for card
                            const userData = await wasi_getXP(sessionId, wasi_sender);

                            // Get Profile Picture
                            let ppUrl = 'https://i.pinimg.com/564x/8a/92/83/8a9283733055375498875323cb639446.jpg';
                            try {
                                ppUrl = await wasi_sock.profilePictureUrl(wasi_sender, 'image');
                            } catch { }

                            const cardBuffer = await generateLevelUpCard(wasi_sender, newLevel, userData.xp, ppUrl);

                            if (cardBuffer) {
                                await wasi_sock.sendMessage(wasi_origin, {
                                    image: cardBuffer,
                                    caption: `🎉 *LEVEL UP!* 🎉\n\nCongrats @${wasi_sender.split('@')[0]}, you reached *Level ${newLevel}*! 🆙\n_Keep chatting to reach new heights!_`,
                                    mentions: [wasi_sender]
                                }, { quoted: wasi_msg });
                            } else {
                                throw new Error('Card generation failed');
                            }
                        } catch (cardErr) {
                            console.error('LevelUp Card Error:', cardErr);
                            // Fallback to text
                            await wasi_sock.sendMessage(wasi_origin, {
                                text: `🎉 *LEVEL UP!* 🎉\n\nCongrats @${wasi_sender.split('@')[0]}, you reached *Level ${newLevel}*! 🆙`,
                                mentions: [wasi_sender]
                            }, { quoted: wasi_msg });
                        }
                    }
                } catch (xpErr) { console.error('XP Error:', xpErr.message); }
            }

            // Relaxed timeout to 5 minutes to handle Heroku lag/sleep
            if (currentTime - messageTime > 300) return;
        }

        // -------------------------------------------------------------------------
        // AUTO REACTION LOGIC (FROM PLUGIN)
        // -------------------------------------------------------------------------
        try {
            const { autoReactLogic } = require('./wasiplugins/autoreact');
            // We pass isCmd loosely as 'false' here for now, or calculate it.
            // Calculating isCmd:
            const prefixes = [currentConfig.prefix, '.', '/'].filter(Boolean);
            const isCmd = prefixes.some(p => wasi_text.trim().startsWith(p));

            await autoReactLogic(wasi_sock, wasi_msg, isCmd, currentConfig);
        } catch (arErr) {
            // console.error('AutoReact Logic Error:', arErr); 
        }

        // -------------------------------------------------------------------------
        // AUTO PRESENCE (WAPRESENCE)
        // -------------------------------------------------------------------------
        try {
            if (!wasi_msg.key.fromMe) {
                const presence = currentConfig.waPresence || process.env.WAPRESENCE || 'recording';
                // statuses: 'unavailable', 'available', 'composing', 'recording', 'paused'
                if (presence && presence !== 'unavailable') {
                    await wasi_sock.sendPresenceUpdate(presence, wasi_origin);
                }
            }
        } catch (presErr) { console.error('Presence Error:', presErr.message); }

        // -------------------------------------------------------------------------
        // NEWSLETTER AUTO REACT (Channel ID)
        // -------------------------------------------------------------------------
        // -------------------------------------------------------------------------
        // NEWSLETTER AUTO REACT (Channel ID)
        // -------------------------------------------------------------------------
        if (wasi_origin === currentConfig.newsletterJid) {
            try {
                // "100k dummy reactions" is not technically possible via standard API for others to see.
                // We will add a SINGLE REAL REACTION from the bot.
                // If the user meant "Forwarded 100k times", that's different.
                // For now, providing Auto React.
                const reactionEmoji = '❤️'; // Or random
                await wasi_sock.sendMessage(wasi_origin, {
                    react: { text: randomEmoji, key: wasi_msg.key }
                });
                console.log(`❤️ Auto-Reacted to Newsletter Post in ${wasi_origin} with ${randomEmoji}`);
            } catch (nlErr) {
                console.error('Newsletter React Error:', nlErr.message);
            }
        }

        // -------------------------------------------------------------------------
        // ADVANCED ANTILINK CHECK
        // -------------------------------------------------------------------------
        if (wasi_origin.endsWith('@g.us') && wasi_text) {
            const { wasi_getGroupSettings, wasi_updateGroupSettings } = require('./wasilib/database');
            const groupSettings = await wasi_getGroupSettings(sessionId, wasi_origin);

            if (groupSettings && groupSettings.antilink) {
                // Link Regex
                const linkRegex = /(https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+)/gi;
                const links = wasi_text.match(linkRegex);

                if (links && links.length > 0) {
                    // Check whitelist
                    const whitelist = groupSettings.antilinkWhitelist || [];
                    const isWhitelisted = links.every(link => {
                        return whitelist.some(domain => link.toLowerCase().includes(domain.toLowerCase()));
                    });

                    if (!isWhitelisted) {
                        // Fetch metadata for admin checks
                        const groupMetadata = await wasi_sock.groupMetadata(wasi_origin).catch(() => null);
                        if (groupMetadata) {
                            const participants = groupMetadata.participants;

                            // Owner/Sudo bypass
                            const ownerNumber = (currentConfig.ownerNumber || '').replace(/\D/g, '');
                            const sudoListRaw = currentConfig.sudo || [];
                            const sudoList = sudoListRaw.map(s => s.toString().replace(/\D/g, ''));
                            const senderNum = wasi_sender.split('@')[0].split(':')[0].replace(/\D/g, '');

                            const isOwnerOrSudo = (senderNum === ownerNumber) || sudoList.includes(senderNum);

                            // Sender admin check
                            const senderMod = participants.find(p => jidNormalizedUser(p.id) === wasi_sender);
                            const isSenderAdmin = isOwnerOrSudo || (senderMod?.admin === 'admin' || senderMod?.admin === 'superadmin');

                            if (!isSenderAdmin) {
                                // Bot admin check
                                const me = wasi_sock.user || wasi_sock.authState?.creds?.me;
                                const myJid = jidNormalizedUser(me?.id || me?.jid);

                                const botMod = participants.find(p => jidNormalizedUser(p.id) === myJid);
                                const isBotAdmin = (botMod?.admin === 'admin' || botMod?.admin === 'superadmin');

                                // Debug Log for Admin Check
                                // console.log(`[Antilink] BotJid: ${myJid} | Found: ${!!botMod} | Admin: ${botMod?.admin} | Result: ${isBotAdmin}`);

                                const mode = groupSettings.antilinkMode || 'delete';
                                const maxWarnings = groupSettings.antilinkMaxWarnings || 3;
                                let warnings = groupSettings.antilinkWarnings || {};
                                // Convert Map to object if needed
                                if (warnings instanceof Map) {
                                    warnings = Object.fromEntries(warnings);
                                }
                                const userWarnings = (warnings[wasi_sender] || 0) + 1;

                                console.log(`🔗 Antilink triggered: mode=${mode}, warnings=${userWarnings}/${maxWarnings}`);

                                if (mode === 'warn') {
                                    // Update warning count
                                    warnings[wasi_sender] = userWarnings;
                                    await wasi_updateGroupSettings(sessionId, wasi_origin, { antilinkWarnings: warnings });

                                    if (userWarnings >= maxWarnings) {
                                        // Max warnings reached - take action
                                        if (isBotAdmin) {
                                            await wasi_sock.sendMessage(wasi_origin, { delete: wasi_msg.key });
                                            await wasi_sock.groupParticipantsUpdate(wasi_origin, [wasi_sender], 'remove');
                                            await wasi_sock.sendMessage(wasi_origin, {
                                                text: `🚫 *@${senderNum}* has been removed for sending links!\n\n⚠️ Warnings: ${userWarnings}/${maxWarnings}`,
                                                mentions: [wasi_sender]
                                            });
                                            // Reset warnings for this user
                                            delete warnings[wasi_sender];
                                            await wasi_updateGroupSettings(sessionId, wasi_origin, { antilinkWarnings: warnings });
                                        }
                                    } else {
                                        // Delete and warn
                                        if (isBotAdmin) {
                                            await wasi_sock.sendMessage(wasi_origin, { delete: wasi_msg.key });
                                        }
                                        await wasi_sock.sendMessage(wasi_origin, {
                                            text: `⚠️ *@${senderNum}* Links are not allowed!\n\n⚡ Warning: ${userWarnings}/${maxWarnings}\n\n_Next violation may result in removal._`,
                                            mentions: [wasi_sender]
                                        });
                                    }
                                } else if (mode === 'delete') {
                                    // Just delete the message
                                    if (isBotAdmin) {
                                        await wasi_sock.sendMessage(wasi_origin, { delete: wasi_msg.key });
                                        await wasi_sock.sendMessage(wasi_origin, {
                                            text: `🛡️ Link deleted from @${senderNum}`,
                                            mentions: [wasi_sender]
                                        });
                                    } else {
                                        await wasi_sock.sendMessage(wasi_origin, { text: '⚠️ *Antilink:* I need Admin privileges to delete links.' });
                                    }
                                } else if (mode === 'remove' || mode === 'kick') {
                                    // Delete and kick immediately
                                    if (isBotAdmin) {
                                        await wasi_sock.sendMessage(wasi_origin, { delete: wasi_msg.key });
                                        await wasi_sock.groupParticipantsUpdate(wasi_origin, [wasi_sender], 'remove');
                                        await wasi_sock.sendMessage(wasi_origin, {
                                            text: `🚫 *@${senderNum}* has been removed for sending links!`,
                                            mentions: [wasi_sender]
                                        });
                                    } else {
                                        await wasi_sock.sendMessage(wasi_origin, { text: '⚠️ *Antilink:* I need Admin privileges to remove users.' });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // -------------------------------------------------------------------------
        // AUTO FORWARD LOGIC
        // -------------------------------------------------------------------------
        if (wasi_origin.endsWith('@g.us') && !wasi_msg.key.fromMe) {
            try {
                const { wasi_getGroupSettings } = require('./wasilib/database');
                const groupSettings = await wasi_getGroupSettings(sessionId, wasi_origin);

                if (groupSettings && groupSettings.autoForward && groupSettings.autoForwardTargets?.length > 0) {
                    console.log(`🚀 [AUTO-FORWARD] Relaying message from ${wasi_origin} to ${groupSettings.autoForwardTargets.length} targets`);

                    // Prepare Message Content (Unwrap & Add Context)
                    let relayMsg = { ...wasi_msg.message };
                    if (relayMsg.viewOnceMessageV2) relayMsg = relayMsg.viewOnceMessageV2.message;
                    if (relayMsg.viewOnceMessage) relayMsg = relayMsg.viewOnceMessage.message;

                    const mType = Object.keys(relayMsg).find(k => k.endsWith('Message') || k === 'conversation');
                    if (mType && relayMsg[mType] && typeof relayMsg[mType] === 'object') {
                        relayMsg[mType].contextInfo = {
                            ...(relayMsg[mType].contextInfo || {}),
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: currentConfig.newsletterJid || '120363419652241844@newsletter',
                                newsletterName: currentConfig.newsletterName || 'WASI-MD-V7',
                                serverMessageId: -1
                            }
                        };
                    }

                    for (const targetJid of groupSettings.autoForwardTargets) {
                        try {
                            await wasi_sock.relayMessage(targetJid, relayMsg, {
                                messageId: wasi_sock.generateMessageTag()
                            });
                        } catch (err) {
                            console.error(`[AUTO-FORWARD] Failed for ${targetJid}:`, err.message);
                        }
                    }
                }
            } catch (err) {
                console.error('[AUTO-FORWARD] Error:', err.message);
            }
        }

        // -------------------------------------------------------------------------
        // AUTO VIEW ONCE (RECOVER)
        // -------------------------------------------------------------------------
        // -------------------------------------------------------------------------
        // AUTO VIEW ONCE (RECOVER)
        // -------------------------------------------------------------------------
        try {
            const rawMsg = wasi_msg.message;
            let viewOnceContent = null;

            // 1. Identify ViewOnce Message (V1 or V2)
            if (rawMsg.viewOnceMessageV2) {
                viewOnceContent = rawMsg.viewOnceMessageV2.message;
            } else if (rawMsg.viewOnceMessage) {
                viewOnceContent = rawMsg.viewOnceMessage.message;
            } else {
                // Check for viewOnce flag in direct media messages
                if (rawMsg.imageMessage?.viewOnce) viewOnceContent = { imageMessage: rawMsg.imageMessage };
                else if (rawMsg.videoMessage?.viewOnce) viewOnceContent = { videoMessage: rawMsg.videoMessage };
                else if (rawMsg.audioMessage?.viewOnce) viewOnceContent = { audioMessage: rawMsg.audioMessage };
            }

            if (viewOnceContent) {
                const { wasi_getUserAutoStatus } = require('./wasilib/database');
                const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

                // Check OWNER'S setting preferences
                const ownerJid = (currentConfig.ownerNumber || '').replace(/\D/g, '') + '@s.whatsapp.net';
                const ownerSettings = await wasi_getUserAutoStatus(sessionId, ownerJid);

                if (ownerSettings?.autoViewOnce) {
                    console.log('🔓 Auto ViewOnce Detected! Recovering...');

                    // 2. Identify Inner Media Type
                    const actualMsg = viewOnceContent.imageMessage ||
                        viewOnceContent.videoMessage ||
                        viewOnceContent.audioMessage;

                    if (actualMsg) {
                        let type = '';
                        if (viewOnceContent.imageMessage) type = 'image';
                        else if (viewOnceContent.videoMessage) type = 'video';
                        else if (viewOnceContent.audioMessage) type = 'audio';

                        if (type) {
                            // 3. Download & Decrypt
                            const stream = await downloadContentFromMessage(actualMsg, type);
                            let buffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                buffer = Buffer.concat([buffer, chunk]);
                            }

                            if (buffer.length > 0) {
                                // 4. Send to Owner (Self) - Privacy First
                                // We send it to the bot's own chat (Note to Self) or the Owner's DM
                                const destination = meJid; // Send to "Note to Self"

                                await wasi_sock.sendMessage(destination, {
                                    [type]: buffer,
                                    caption: `🔓 *ViewOnce Recovered*\nfrom @${wasi_sender.split('@')[0]}\n> WASI-MD-V7`,
                                    contextInfo: { mentionedJid: [wasi_sender] }
                                }, { quoted: wasi_msg }); // Quote original for context

                                console.log(`✅ ViewOnce recovered and saved to self.`);
                            }
                        }
                    }
                }
            }
        } catch (vvErr) {
            console.error('AutoVV Logic Error:', vvErr.message);
        }
        // -------------------------------------------------------------------------

        // AUTO READ
        if (currentConfig.autoRead) {
            await wasi_sock.readMessages([wasi_msg.key]);
        }


        // ... (Paste original message handling logic here, or import it)
        // For brevity in this tool call, I will inline the essential parts.
        // In a real refactor we should move message handler to a separate file.

        // DEBUG LOG
        // console.log(`📩 MSG from ${wasi_sender}: "${wasi_text?.slice(0, 30)}..."`);

        // ANTI-BOT (DISABLED)
        /*
        if (wasi_sender.endsWith('@g.us')) {
            try {
                const { handleAntiBot } = require('./wasilib/antibot');
                // Ensure arguments match: (sock, msg, isGroup, sender, groupMetadata)
                const participant = wasi_msg.key?.participant || wasi_sender;
                await handleAntiBot(wasi_sock, wasi_msg, true, participant);
            } catch (abErr) {
                console.error('⚠️ AntiBot Check Failed (Ignored):', abErr.message);
            }
        }
        */

        // -------------------------------------------------------------------------
        // AUTO STATUS SEEN (Enhanced based on Baileys)
        // -------------------------------------------------------------------------
        const isStatusMessage = wasi_origin === 'status@broadcast' || wasi_msg.key.remoteJid === 'status@broadcast';

        if (isStatusMessage && wasi_msg.key.participant) {
            try {
                const statusOwner = jidNormalizedUser(wasi_msg.key.participant);
                const { wasi_getUserAutoStatus } = require('./wasilib/database');

                // Skip if status is from bot itself
                if (statusOwner === meJid) {
                    console.log('📌 Skipping own status');
                } else {
                    // Get user-specific settings if any, otherwise use session-specific config
                    const userSettings = await wasi_getUserAutoStatus(sessionId, statusOwner);
                    const shouldAutoView = userSettings?.autoStatusSeen ?? currentConfig.autoStatusSeen;

                    if (shouldAutoView) {
                        console.log(`👁️ Auto-viewing status from: ${statusOwner}`);

                        // Read the status message (mark as seen)
                        try {
                            await wasi_sock.readMessages([wasi_msg.key]);
                            console.log(`✅ Status marked as seen`);
                        } catch (readErr) {
                            console.error('Failed to read status:', readErr.message);
                        }

                        // Auto React to Status
                        const shouldReact = userSettings?.autoStatusReact ?? currentConfig.autoStatusReact;
                        if (shouldReact) {
                            try {
                                const emojiList = currentConfig.autoStatusEmojis || ['❤️', '🧡', '💛', '💚', '💙', '💜', '🌈', '🔥', '✨', '💯'];
                                const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];

                                await wasi_sock.sendMessage('status@broadcast', {
                                    react: { text: randomEmoji, key: wasi_msg.key }
                                }, {
                                    statusJidList: [statusOwner]
                                });
                                console.log(`❤️ Status Reacted with: ${randomEmoji}`);
                            } catch (reactErr) {
                                console.error('Failed to react to status:', reactErr.message);
                            }
                        }
                    }

                    // AUTO SAVE STATUS (Forward to Personal Chat)
                    const shouldSave = currentConfig.autoStatusSave;
                    if (shouldSave) {
                        if (wasi_msg.message) {
                            try {
                                console.log(`💾 Saving status from ${statusOwner} to personal chat`);
                                // Forward the status to self
                                await wasi_sock.sendMessage(meJid, {
                                    forward: wasi_msg
                                });
                                console.log(`✅ Status saved to personal chat`);
                            } catch (saveErr) {
                                console.error('Failed to save status:', saveErr.message);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Status handling error:', e.message);
            }

            // Return early for status messages (don't process as commands)
            return;
        }

        // -------------------------------------------------------------------------
        // STATUS MEDIA DOWNLOAD KEYWORDS (Reply to Status)
        // -------------------------------------------------------------------------
        if (wasi_text && wasi_msg.message?.extendedTextMessage?.contextInfo?.remoteJid === 'status@broadcast') {
            const keywords = ['send', 'give', 'give me', 'save', 'dn', 'sent', 'please', 'dm'];
            const lowerText = wasi_text.trim().toLowerCase();

            if (keywords.includes(lowerText)) {
                try {
                    const quotedMsg = wasi_msg.message.extendedTextMessage.contextInfo.quotedMessage;
                    if (quotedMsg) {
                        const { downloadMediaMessage } = require('@whiskeysockets/baileys');

                        let target = quotedMsg;
                        if (target.viewOnceMessageV2?.message) target = target.viewOnceMessageV2.message;
                        if (target.viewOnceMessage?.message) target = target.viewOnceMessage.message;

                        const isImage = !!target.imageMessage;
                        const isVideo = !!target.videoMessage;

                        if (isImage || isVideo) {
                            console.log(`📥 Sending status media to ${wasi_sender} via keyword: "${lowerText}"`);
                            const buffer = await downloadMediaMessage(
                                { message: target },
                                'buffer',
                                {},
                                { logger: console, reuploadRequest: wasi_sock.updateMediaMessage }
                            );

                            if (buffer) {
                                await wasi_sock.sendMessage(wasi_sender, {
                                    [isImage ? 'image' : 'video']: buffer,
                                    caption: target[isImage ? 'imageMessage' : 'videoMessage']?.caption || ''
                                }, { quoted: wasi_msg });
                            }
                        }
                    }
                } catch (err) {
                    console.error('Failed to processed status keyword:', err.message);
                }
            }
        }

        // -------------------------------------------------------------------------
        // MENTION REPLY LOGIC
        // -------------------------------------------------------------------------
        try {
            const { wasi_isMentionEnabled, wasi_getMention } = require('./wasilib/database');
            const isMentionEnabled = await wasi_isMentionEnabled(sessionId);

            if (isMentionEnabled) {
                const mentions = wasi_msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const isMentioned = mentions.includes(meJid);

                if (isMentioned) {
                    const mentionData = await wasi_getMention(sessionId);
                    if (mentionData && mentionData.content) {
                        const { type, content, mimetype } = mentionData;
                        console.log(`🔔 Mention detected! Replying with ${type}...`);

                        if (type === 'text') {
                            await wasi_sock.sendMessage(wasi_origin, { text: content }, { quoted: wasi_msg });
                        } else if (type === 'audio') {
                            await wasi_sock.sendMessage(wasi_origin, { audio: { url: content }, mimetype: mimetype || 'audio/mp4', ptt: true }, { quoted: wasi_msg });
                        } else if (type === 'image') {
                            await wasi_sock.sendMessage(wasi_origin, { image: { url: content }, caption: '> Powered by WASI BOT' }, { quoted: wasi_msg });
                        } else if (type === 'video') {
                            await wasi_sock.sendMessage(wasi_origin, { video: { url: content }, caption: '> Powered by WASI BOT' }, { quoted: wasi_msg });
                        }
                    }
                }
            }
        } catch (mentionErr) {
            console.error('Mention Reply Logic Error:', mentionErr);
        }


        // AUTO REPLY
        // ... (keep auto reply and bgm blocks unchanged or minimal in this replacement) ...
        // Skipping huge block to minimize diff content, I will just target the AntiBot block first if possible
        // But the user tool requires me to replace chunks.
        // Let me just replace the AntiBot block first, then separate tool call for command logging.

        // Wait, I can do multiple chunks if I want? Yes but strict line matching.
        // I'll do 2 chunks.
        if (config.autoReplyEnabled && wasi_text) {
            const { wasi_getAutoReplies } = require('./wasilib/database');
            const dbReplies = await wasi_getAutoReplies(sessionId);

            // Use DB replies if available, otherwise fallback to static config
            const autoReplies = (dbReplies && dbReplies.length > 0) ? dbReplies : config.autoReplies;

            // Debug Logs
            // console.log(`🔎 AutoReply Debug: Enabled=${config.autoReplyEnabled} | Text="${wasi_text}" | Source=${dbReplies?.length > 0 ? 'DB' : 'Config'} | Rules=${autoReplies?.length}`);

            if (autoReplies) {
                const match = autoReplies.find(r => r.trigger.toLowerCase() === wasi_text.trim().toLowerCase());

                if (match) {
                    // console.log(`✅ AutoReply Match: "${match.trigger}" -> Sending Reply`);
                    await wasi_sock.sendMessage(wasi_origin, { text: match.reply }, { quoted: wasi_msg });
                }
            }
        }


        // BGM HANDLING
        try {
            const { wasi_isBgmEnabled, wasi_getBgm } = require('./wasilib/database');
            const bgmEnabled = await wasi_isBgmEnabled(sessionId);
            if (bgmEnabled && wasi_text) {
                const cleanText = wasi_text.trim().toLowerCase();
                const bgmData = await wasi_getBgm(sessionId, cleanText);

                if (bgmData && bgmData.url) {
                    // console.log(`🎵 Playing BGM for trigger: ${cleanText}`);
                    // console.log(`🔗 Audio URL: ${bgmData.url} | Mime: ${bgmData.mimetype}`);
                    await wasi_sock.sendMessage(wasi_origin, {
                        audio: { url: bgmData.url },
                        mimetype: bgmData.mimetype,
                        ptt: false
                    }, { quoted: wasi_msg });
                }
            }
        } catch (e) {
            console.error('BGM Logic Error:', e);
        }

        // MENTION REPLY Logic
        try {
            const botJid = meJid;
            const botNum = botJid.split('@')[0].split(':')[0].replace(/\D/g, '');

            const ownerNumRaw = (currentConfig.ownerNumber || '').toString();
            const ownerNumber = ownerNumRaw.replace(/\D/g, '');
            const ownerJid = ownerNumber + '@s.whatsapp.net';

            const sudoListRaw = currentConfig.sudo || [];
            const sudoList = sudoListRaw.map(s => s.toString().replace(/\D/g, ''));

            const msg = wasi_msg.message;
            if (!msg) return;

            // Robust contextInfo extraction from various message types
            const contextInfo = msg.extendedTextMessage?.contextInfo ||
                msg.imageMessage?.contextInfo ||
                msg.videoMessage?.contextInfo ||
                msg.audioMessage?.contextInfo ||
                msg.documentMessage?.contextInfo ||
                msg.stickerMessage?.contextInfo ||
                msg.templateButtonReplyMessage?.contextInfo ||
                msg.buttonsResponseMessage?.contextInfo ||
                msg.listResponseMessage?.contextInfo;

            const mentionedJidList = contextInfo?.mentionedJid || [];
            const quotedParticipant = contextInfo?.participant; // JID of the person who sent the quoted message

            // Check 1: Explicitly mentioned in tags
            let isTargetMentioned = mentionedJidList.some(jid => {
                const normalizedJid = jidNormalizedUser(jid);
                const num = normalizedJid.split('@')[0].split(':')[0].replace(/\D/g, '');
                return normalizedJid === botJid || num === botNum || normalizedJid === ownerJid || num === ownerNumber || sudoList.includes(num);
            });

            // Check 2: Reply to the bot or owner
            if (!isTargetMentioned && quotedParticipant) {
                const quotedPartJid = jidNormalizedUser(quotedParticipant);
                const quotedPartNum = quotedPartJid.split('@')[0].split(':')[0].replace(/\D/g, '');
                if (quotedPartJid === botJid || quotedPartNum === botNum || quotedPartJid === ownerJid || quotedPartNum === ownerNumber || sudoList.includes(quotedPartNum)) {
                    isTargetMentioned = true;
                }
            }

            // Check 3: Number mentioned in text (literal string search)
            if (!isTargetMentioned && wasi_text) {
                if ((ownerNumber && wasi_text.includes(ownerNumber)) || (botNum && wasi_text.includes(botNum))) {
                    isTargetMentioned = true;
                }
            }

            if (isTargetMentioned) {
                // NEVER trigger mention reply for own messages (prevent loops)
                if (wasi_msg.key.fromMe) return;

                const { wasi_isMentionEnabled, wasi_getMention } = require('./wasilib/database');
                if (await wasi_isMentionEnabled(sessionId)) {
                    const mentionData = await wasi_getMention(sessionId);
                    if (mentionData && mentionData.content) {
                        // Avoid replying to self/bot to prevent infinite loops
                        if (wasi_sender === botJid || botJids.has(wasi_sender)) return;

                        if (mentionData.type === 'image') {
                            await wasi_sock.sendMessage(wasi_origin, { image: { url: mentionData.content }, caption: '' }, { quoted: wasi_msg });
                        } else if (mentionData.type === 'video') {
                            await wasi_sock.sendMessage(wasi_origin, { video: { url: mentionData.content }, caption: '' }, { quoted: wasi_msg });
                        } else if (mentionData.type === 'audio') {
                            await wasi_sock.sendMessage(wasi_origin, { audio: { url: mentionData.content }, mimetype: mentionData.mimetype || 'audio/mp4', ptt: true }, { quoted: wasi_msg });
                        } else {
                            await wasi_sock.sendMessage(wasi_origin, { text: mentionData.content }, { quoted: wasi_msg });
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Mention Logic Error:', e);
        }

        // -------------------------------------------------------------------------
        // COMMAND HANDLER
        // -------------------------------------------------------------------------
        const wasi_trimmed = wasi_text.trim();
        const prefixes = [currentConfig.prefix, '.', '/'].filter(Boolean);
        const usedPrefix = prefixes.find(p => wasi_trimmed.startsWith(p));

        if (usedPrefix) {
            const wasi_parts = wasi_trimmed.slice(usedPrefix.length).trim().split(/\s+/);
            const wasi_cmd_input = wasi_parts[0].toLowerCase();
            const wasi_args = wasi_parts.slice(1);

            if (wasi_plugins.has(wasi_cmd_input)) {
                const plugin = wasi_plugins.get(wasi_cmd_input);
                try {
                    // Context Preparation
                    const isGroup = wasi_origin.endsWith('@g.us');
                    let wasi_isAdmin = false;
                    let wasi_botIsAdmin = false;
                    let groupMetadata = null;

                    if (isGroup) {
                        try {
                            groupMetadata = await wasi_sock.groupMetadata(wasi_origin);
                            const participants = groupMetadata.participants;

                            // Check Sender Admin Status
                            const senderMod = participants.find(p => jidNormalizedUser(p.id) === wasi_sender);
                            wasi_isAdmin = (senderMod?.admin === 'admin' || senderMod?.admin === 'superadmin');

                            // Check Bot Admin Status
                            const me = wasi_sock.user || wasi_sock.authState?.creds?.me;
                            const botJids = new Set([jidNormalizedUser(me?.id), jidNormalizedUser(me?.jid), jidNormalizedUser(me?.lid)].filter(Boolean));

                            const botMod = participants.find(p => botJids.has(jidNormalizedUser(p.id)));
                            wasi_botIsAdmin = (botMod?.admin === 'admin' || botMod?.admin === 'superadmin');
                        } catch (gErr) { }
                    }

                    // IDENTIFICATION (Owner, Sudo, Bot, Developer)
                    const { developerNumbers } = require('./wasilib/developer');
                    const me = wasi_sock.user || wasi_sock.authState?.creds?.me;
                    const botJids = new Set([
                        jidNormalizedUser(me?.id),
                        jidNormalizedUser(me?.jid),
                        jidNormalizedUser(me?.lid)
                    ].filter(Boolean));

                    const normSenderJid = jidNormalizedUser(wasi_sender);
                    const senderNum = normSenderJid.split('@')[0].split(':')[0].replace(/\D/g, '');

                    const ownerNumRaw = (currentConfig.ownerNumber || process.env.OWNER_NUMBER || '923259823531').toString();
                    const ownerNumber = ownerNumRaw.replace(/\D/g, '');
                    const ownerJids = new Set([ownerNumber + '@s.whatsapp.net', ownerNumber + '@c.us']);

                    const sudoListRaw = currentConfig.sudo || [];
                    const sudoList = sudoListRaw.map(s => s.toString().replace(/\D/g, ''));

                    // THE MASTER CHECK (Using Baileys areJidsSameUser pattern)
                    // Extract user part from sender JID for proper comparison
                    const { jidDecode } = require('@whiskeysockets/baileys');
                    const senderDecoded = jidDecode(normSenderJid);
                    const senderUserPart = senderDecoded?.user || senderNum;

                    // Check if sender is the bot itself
                    const isBotSelf = botJids.has(normSenderJid) ||
                        Array.from(botJids).some(bJid => {
                            const bDecoded = jidDecode(bJid);
                            return bDecoded?.user === senderUserPart;
                        });

                    // Check if sender is owner (compare user parts, not full JIDs)
                    const isOwnerByNumber = senderUserPart === ownerNumber || senderNum === ownerNumber;
                    const isOwnerByJid = ownerJids.has(normSenderJid);

                    // Check if sender is in sudo list
                    const isSudoUser = sudoList.includes(senderUserPart) || sudoList.includes(senderNum);

                    // Check if sender is a Developer (Full Owner Access as requested)
                    const isDev = developerNumbers.some(dev => dev.toString().replace(/\D/g, '') === senderNum);

                    const wasi_isOwner = isBotSelf || isOwnerByNumber || isOwnerByJid || isSudoUser || isDev;
                    const wasi_isSudo = wasi_isOwner || isSudoUser;

                    // Debug log for troubleshooting
                    // console.log(`👤 Permission Check: sender=${senderUserPart}, owner=${ownerNumber}, isOwner=${wasi_isOwner}, isSudo=${wasi_isSudo}`);

                    if (plugin.ownerOnly && !wasi_isOwner && !wasi_isSudo) {
                        return await wasi_sock.sendMessage(wasi_origin, { text: `❌ *${plugin.name.toUpperCase()}* is restricted to the Owner.` }, { quoted: wasi_msg });
                    }

                    // EXECUTE
                    console.log(`🚀 Executing [${wasi_cmd_input}] for ${normSenderJid}`);

                    // AUTO TYPING / RECORDING PRESENCE (based on Baileys API)
                    try {
                        const { wasi_getUserAutoStatus } = require('./wasilib/database');
                        const userSettings = await wasi_getUserAutoStatus(sessionId, normSenderJid);
                        if (userSettings?.autoTyping) {
                            await wasi_sock.sendPresenceUpdate('composing', wasi_origin);
                        } else if (userSettings?.autoRecording) {
                            await wasi_sock.sendPresenceUpdate('recording', wasi_origin);
                        }
                    } catch (presErr) {
                        // Silently ignore presence errors
                    }

                    await plugin.wasi_handler(wasi_sock, wasi_origin, {
                        wasi_sender: normSenderJid,
                        wasi_msg,
                        wasi_args,
                        wasi_plugins,
                        sessionId,
                        config: currentConfig,
                        wasi_text,
                        wasi_isGroup: isGroup,
                        wasi_isAdmin,
                        wasi_botIsAdmin,
                        wasi_isOwner,
                        wasi_isSudo,
                        wasi_groupMetadata: groupMetadata,
                        wasi_store: sessions.get(sessionId)?.messageLog,
                        wasi_cmd_input
                    });

                } catch (err) {
                    console.error(`Error in plugin ${wasi_cmd_input}:`, err);
                    await wasi_sock.sendMessage(wasi_origin, { text: `❌ Plugin Error: ${err.message}` }, { quoted: wasi_msg });
                }
            }
        }
    }); // End of messages.upsert

    // -------------------------------------------------------------------------
    // ANTIDELETE HANDLER
    // -------------------------------------------------------------------------
    wasi_sock.ev.on('messages.update', async (updates) => {
        const sessionState = sessions.get(sessionId);
        if (!sessionState || !sessionState.messageLog) return;

        for (const update of updates) {
            if (update.update.message === null) {
                // This might be a delete, but Baileys often sends 'message: null' for other updates too?
                // Actually, revokes usually come as a protocolMessage within an upsert or update?
                // Wait, revokes are usually UPSERTS with type 'protocolMessage'.
                // Let's check Baileys docs/examples. 
                // Ah, Baileys standard: A delete for everyone is a NEW message with 'protocolMessage' containing 'type: REVOKE'.
                // So I should handle it in UPSERT, not UPDATE?
                // Yes, usually.
                // BUT, sometimes it updates the existing message in store.
                // Lets check if we caught it in upsert.
                // If it's a protocol message, it will arrive in upsert.
                // So I should modify UPSERT to handle protocolMessage.
            }
        }
    });

    wasi_sock.ev.on('messages.update', async (updates) => {
        // Handle message updates (like reactions or edits) if needed in future
    });
}

main();


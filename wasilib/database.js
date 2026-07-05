const mongoose = require('mongoose');



// SCHEMAS
const wasi_toggleSchema = new mongoose.Schema({
    jid: { type: String, required: true },
    command: { type: String, required: true },
    isEnabled: { type: Boolean, default: true }
});

const wasi_userSettingsSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    autoStatusSeen: { type: Boolean, default: false },
    autoStatusReact: { type: Boolean, default: false },
    autoStatusMessage: { type: Boolean, default: false },
    autoTyping: { type: Boolean, default: false },
    autoRecording: { type: Boolean, default: false },
    autoViewOnce: { type: Boolean, default: false }
});

const wasi_autoReplySchema = new mongoose.Schema({
    trigger: { type: String, required: true },
    reply: { type: String, required: true }
});

const wasi_rankSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    role: { type: String, default: 'Novice' }
});

const wasi_sessionIndexSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

const wasi_bgmSchema = new mongoose.Schema({
    trigger: { type: String, required: true },
    audioUrl: { type: String, required: true },
    mimetype: { type: String, default: 'audio/mp4' }
});

const wasi_bgmConfigSchema = new mongoose.Schema({
    isEnabled: { type: Boolean, default: true }
});

const wasi_mentionSchema = new mongoose.Schema({
    type: { type: String, default: 'text' }, // text, audio, image
    content: { type: String, required: true },
    mimetype: { type: String }
});

const wasi_mentionConfigSchema = new mongoose.Schema({
    isEnabled: { type: Boolean, default: true }
});

const wasi_botConfigSchema = new mongoose.Schema({
    prefix: { type: String, default: '.' },
    menuImage: { type: String, default: '' },
    autoRead: { type: Boolean, default: false },
    autoRejectCall: { type: Boolean, default: false },
    autoWelcome: { type: Boolean, default: false },
    autoGoodbye: { type: Boolean, default: false },
    welcomeMessage: { type: String, default: '' },
    goodbyeMessage: { type: String, default: '' },
    ownerName: { type: String, default: 'Wasi' },
    ownerNumber: { type: String, default: '' },
    ownerJid: { type: String, default: '' },
    sudo: { type: [String], default: [] }, // Array of Sudo JIDs
    autoStatusSeen: { type: Boolean, default: true },
    autoStatusReact: { type: Boolean, default: true },
    autoStatusSave: { type: Boolean, default: false },
    autoStatusEmojis: { type: [String], default: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🌈', '🔥'] }
});

const wasi_groupSettingsSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    // Antilink settings
    antilink: { type: Boolean, default: false },
    antilinkMode: { type: String, default: 'delete' }, // warn, delete, remove (kick)
    antilinkWarnings: { type: Map, of: Number, default: {} }, // user JID -> warning count
    antilinkMaxWarnings: { type: Number, default: 3 },
    antilinkWhitelist: { type: [String], default: [] }, // Whitelisted link patterns
    // Antidelete settings
    antidelete: { type: Boolean, default: false },
    antideleteDestination: { type: String, default: 'group' }, // group, owner, both
    // Other settings
    welcome: { type: Boolean, default: false },
    goodbye: { type: Boolean, default: false },
    autoForward: { type: Boolean, default: false },
    autoForwardTargets: { type: [String], default: [] }
});

let isConnected = false;

// ---------------------------------------------------------------------------
// DYNAMIC MODEL HELPER
// ---------------------------------------------------------------------------
function getModel(sessionId, type) {
    const prefix = sessionId || 'wasi_session';
    // Use dot notation for collection to get folder view in Compass
    const collectionName = `${prefix}.${type.toLowerCase()}`;
    // Model name can be anything unique
    const modelName = `${prefix}_${type}`;

    if (mongoose.models[modelName]) return mongoose.models[modelName];

    switch (type) {
        case 'Toggle': return mongoose.model(modelName, wasi_toggleSchema, collectionName);
        case 'UserSettings': return mongoose.model(modelName, wasi_userSettingsSchema, collectionName);
        case 'AutoReply': return mongoose.model(modelName, wasi_autoReplySchema, collectionName);
        case 'SessionIndex': return mongoose.model(modelName, wasi_sessionIndexSchema, collectionName);
        case 'Bgm': return mongoose.model(modelName, wasi_bgmSchema, collectionName);
        case 'BgmConfig': return mongoose.model(modelName, wasi_bgmConfigSchema, collectionName);
        case 'Mention': return mongoose.model(modelName, wasi_mentionSchema, collectionName);
        case 'MentionConfig': return mongoose.model(modelName, wasi_mentionConfigSchema, collectionName);
        case 'BotConfig': return mongoose.model(modelName, wasi_botConfigSchema, collectionName);
        case 'GroupSettings': return mongoose.model(modelName, wasi_groupSettingsSchema, collectionName);
        case 'Rank': return mongoose.model(modelName, wasi_rankSchema, collectionName);
        default: throw new Error(`Unknown model type: ${type}`);
    }
}
// ---------------------------------------------------------------------------
// BOT CONFIG MANAGEMENT
// ---------------------------------------------------------------------------
async function wasi_getBotConfig(sessionId) {
    if (!isConnected) return null;
    try {
        const Model = getModel(sessionId, 'BotConfig');
        let config = await Model.findOne({});
        if (!config) {
            config = await Model.create({}); // Create defaults if missing
        }
        return config;
    } catch (e) {
        console.error('DB Error getBotConfig:', e);
        return null;
    }
}

async function wasi_updateBotConfig(sessionId, updates) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'BotConfig');
        await Model.findOneAndUpdate({}, updates, { upsert: true, new: true });
        return true;
    } catch (e) {
        console.error('DB Error updateBotConfig:', e);
        return false;
    }
}



// ---------------------------------------------------------------------------
// DB CONNECTION
// ---------------------------------------------------------------------------
async function wasi_connectDatabase(dbUrl) {
    const uri = dbUrl || process.env.MONGODB_URI;

    if (!uri) {
        console.error('❌ FATAL ERROR: No MONGODB_URI found.');
        return false;
    }

    try {
        await mongoose.connect(uri);
        isConnected = true;
        console.log('✅ Wasi Bot: Connected to MongoDB successfully!');
        return true;
    } catch (err) {
        console.error('❌ Wasi Bot: Failed to connect to MongoDB:', err.message);
        return false;
    }
}

function wasi_isDbConnected() {
    return isConnected;
}

// ---------------------------------------------------------------------------
// SESSION MANAGEMENT (Multi-Tenancy)
// ---------------------------------------------------------------------------

async function wasi_registerSession(sessionId) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'SessionIndex');
        await Model.findOneAndUpdate(
            { sessionId },
            { sessionId },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('DB Error registerSession:', e);
        return false;
    }
}

async function wasi_unregisterSession(sessionId) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'SessionIndex');
        await Model.findOneAndDelete({ sessionId });
        return true;
    } catch (e) {
        console.error('DB Error unregisterSession:', e);
        return false;
    }
}

async function wasi_getAllSessions(sessionId) {
    if (!isConnected) return [];
    try {
        const Model = getModel(sessionId, 'SessionIndex');
        const sessions = await Model.find({});
        return sessions.map(s => s.sessionId);
    } catch (e) {
        console.error('DB Error getAllSessions:', e);
        return [];
    }
}

// ---------------------------------------------------------------------------
// BGM MANAGEMENT
// ---------------------------------------------------------------------------

async function wasi_addBgm(sessionId, trigger, audioUrl, mimetype = 'audio/mp4') {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'Bgm');
        await Model.findOneAndUpdate(
            { trigger },
            { trigger, audioUrl, mimetype },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('DB Error addBgm:', e);
        return false;
    }
}

async function wasi_deleteBgm(sessionId, trigger) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'Bgm');
        const res = await Model.findOneAndDelete({ trigger });
        return !!res;
    } catch (e) {
        console.error('DB Error deleteBgm:', e);
        return false;
    }
}

async function wasi_getBgm(sessionId, trigger) {
    if (!isConnected) return null;
    try {
        const Model = getModel(sessionId, 'Bgm');
        const bgm = await Model.findOne({ trigger });
        // Return object structure
        return bgm ? { url: bgm.audioUrl, mimetype: bgm.mimetype || 'audio/mp4' } : null;
    } catch (e) {
        console.error('DB Error getBgm:', e);
        return null;
    }
}

async function wasi_getAllBgms(sessionId) {
    if (!isConnected) return [];
    try {
        const Model = getModel(sessionId, 'Bgm');
        return await Model.find({});
    } catch (e) {
        console.error('DB Error getAllBgms:', e);
        return [];
    }
}

async function wasi_toggleBgm(sessionId, status) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'BgmConfig');
        await Model.findOneAndUpdate(
            {},
            { isEnabled: status },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('DB Error toggleBgm:', e);
        return false;
    }
}

async function wasi_isBgmEnabled(sessionId) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'BgmConfig');
        const conf = await Model.findOne({});
        return conf ? conf.isEnabled : true;
    } catch (e) {
        return false;
    }
}

// ---------------------------------------------------------------------------
// MENTION REPLY MANAGEMENT
// ---------------------------------------------------------------------------

async function wasi_setMention(sessionId, data) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'Mention');
        // We only store ONE mention reply setting for simplicity like BGM config
        await Model.deleteMany({});
        await Model.create(data);
        return true;
    } catch (e) {
        console.error('DB Error setMention:', e);
        return false;
    }
}

async function wasi_getMention(sessionId) {
    if (!isConnected) return null;
    try {
        const Model = getModel(sessionId, 'Mention');
        return await Model.findOne({});
    } catch (e) {
        return null;
    }
}

async function wasi_toggleMention(sessionId, status) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'MentionConfig');
        await Model.findOneAndUpdate({}, { isEnabled: status }, { upsert: true, new: true });
        return true;
    } catch (e) {
        return false;
    }
}

async function wasi_isMentionEnabled(sessionId) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'MentionConfig');
        const conf = await Model.findOne({});
        return conf ? conf.isEnabled : false;
    } catch (e) {
        return false;
    }
}

// ---------------------------------------------------------------------------
// GROUP SETTINGS MANAGEMENT
// ---------------------------------------------------------------------------

async function wasi_getGroupSettings(sessionId, jid) {
    if (!isConnected) return null;
    try {
        const Model = getModel(sessionId, 'GroupSettings');
        let settings = await Model.findOne({ jid });
        if (!settings) {
            settings = await Model.create({ jid });
        }
        return settings;
    } catch (e) {
        console.error('DB Error getGroupSettings:', e);
        return null;
    }
}

async function wasi_updateGroupSettings(sessionId, jid, updates) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'GroupSettings');
        await Model.findOneAndUpdate({ jid }, updates, { upsert: true, new: true });
        return true;
    } catch (e) {
        console.error('DB Error updateGroupSettings:', e);
        return false;
    }
}

// ---------------------------------------------------------------------------
// COMMANDS / ETC
// ---------------------------------------------------------------------------

async function wasi_isCommandEnabled(sessionId, jid, command) {
    if (!isConnected) return true;
    try {
        const Model = getModel(sessionId, 'Toggle');
        const toggle = await Model.findOne({ jid, command });
        return toggle ? toggle.isEnabled : true;
    } catch (e) {
        console.error('DB Error:', e);
        return true;
    }
}

async function wasi_toggleCommand(sessionId, jid, command, status) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'Toggle');
        await Model.findOneAndUpdate(
            { jid, command },
            { isEnabled: status },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('DB Error:', e);
        return false;
    }
}

async function wasi_getUserAutoStatus(sessionId, jid) {
    if (!isConnected) return null;
    try {
        const Model = getModel(sessionId, 'UserSettings');
        const settings = await Model.findOne({ jid });
        return settings;
    } catch (e) {
        console.error('DB Error:', e);
        return null;
    }
}

async function wasi_setUserAutoStatus(sessionId, jid, settings) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'UserSettings');
        await Model.findOneAndUpdate(
            { jid },
            settings,
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('DB Error:', e);
        return false;
    }
}

async function wasi_getAllAutoStatusUsers(sessionId) {
    if (!isConnected) return [];
    try {
        const Model = getModel(sessionId, 'UserSettings');
        const users = await Model.find({ autoStatusSeen: true });
        return users.map(u => u.jid);
    } catch (e) {
        console.error('DB Error:', e);
        return [];
    }
}

async function wasi_getAutoReplies(sessionId) {
    if (!isConnected) return [];
    try {
        const Model = getModel(sessionId, 'AutoReply');
        const replies = await Model.find({});
        return replies.map(r => ({ trigger: r.trigger, reply: r.reply }));
    } catch (e) {
        console.error('DB Error:', e);
        return [];
    }
}

async function wasi_saveAutoReplies(sessionId, replies) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'AutoReply');
        await Model.deleteMany({}); // Clear existing
        if (replies && replies.length > 0) {
            await Model.insertMany(replies);
        }
        return true;
    } catch (e) {
        console.error('DB Error:', e);
        return false;
    }
}

async function wasi_addAutoReply(sessionId, trigger, reply) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'AutoReply');
        await Model.findOneAndUpdate(
            { trigger },
            { trigger, reply },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('DB Error addAutoReply:', e);
        return false;
    }
}

async function wasi_deleteAutoReply(sessionId, trigger) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'AutoReply');
        await Model.findOneAndDelete({ trigger });
        return true;
    } catch (e) {
        console.error('DB Error deleteAutoReply:', e);
        return false;
    }
}

// ---------------------------------------------------------------------------
// RANK / XP SYSTEM
// ---------------------------------------------------------------------------

async function wasi_getXP(sessionId, jid) {
    if (!isConnected) return { xp: 0, level: 0, role: 'Novice' };
    try {
        const Model = getModel(sessionId, 'Rank');
        let user = await Model.findOne({ jid });
        if (!user) user = await Model.create({ jid, xp: 0, level: 0, role: 'Novice' });
        return user;
    } catch (e) {
        console.error('DB Error getXP:', e);
        return { xp: 0, level: 0, role: 'Novice' };
    }
}

async function wasi_addXP(sessionId, jid, amount) {
    if (!isConnected) return false;
    try {
        const Model = getModel(sessionId, 'Rank');
        let user = await Model.findOne({ jid });
        if (!user) user = await Model.create({ jid, xp: 0, level: 0 });

        user.xp += amount;
        // Simple Level Up Formula: Level = sqrt(XP / 100)
        // Or XP needed = Level * Level * 100
        const newLevel = Math.floor(Math.sqrt(user.xp / 100));

        let leveledUp = false;
        if (newLevel > user.level) {
            user.level = newLevel;
            leveledUp = true;
            // Update Roles based on Level (Example)
            if (newLevel >= 50) user.role = 'Titan';
            else if (newLevel >= 25) user.role = 'Legend';
            else if (newLevel >= 10) user.role = 'Pro';
            else if (newLevel >= 5) user.role = 'Apprentice';
        }

        await user.save();
        return leveledUp ? newLevel : false;
    } catch (e) {
        console.error('DB Error addXP:', e);
        return false;
    }
}

async function wasi_getLeaderboard(sessionId, limit = 10) {
    if (!isConnected) return [];
    try {
        const Model = getModel(sessionId, 'Rank');
        return await Model.find({}).sort({ xp: -1 }).limit(limit);
    } catch (e) {
        return [];
    }
}

module.exports = {
    wasi_connectDatabase,
    wasi_isDbConnected,
    wasi_isCommandEnabled,
    wasi_toggleCommand,
    wasi_getUserAutoStatus,
    wasi_setUserAutoStatus,
    wasi_getAllAutoStatusUsers,
    wasi_getAutoReplies,
    wasi_saveAutoReplies,
    wasi_addAutoReply,
    wasi_deleteAutoReply,
    wasi_registerSession,
    wasi_unregisterSession,
    wasi_getAllSessions,
    wasi_addBgm,
    wasi_deleteBgm,
    wasi_getBgm,
    wasi_getAllBgms,
    wasi_toggleBgm,
    wasi_isBgmEnabled,
    wasi_getBotConfig,
    wasi_updateBotConfig,
    wasi_setMention,
    wasi_getMention,
    wasi_toggleMention,
    wasi_isMentionEnabled,
    wasi_getGroupSettings,
    wasi_updateGroupSettings,
    wasi_getXP,
    wasi_addXP,
    wasi_getLeaderboard
};

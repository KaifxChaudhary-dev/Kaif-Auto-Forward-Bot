const mongoose = require('mongoose');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

// Define Schema for Auth
const AuthStateSchema = new mongoose.Schema({
    _id: String,
    data: mongoose.Schema.Types.Mixed // Use Mixed to allow storing Stringified JSON
}, {
    _id: false, // We manually set _id
    bufferCommands: true, // Keep buffering but...
    autoCreate: true, // Ensure collection is created
    bufferTimeoutMS: 5000 // Error out after 5s if still buffering (default is 10s)
});

const useMongoDBAuthState = async (sessionId = 'wasi_session') => {
    // Dynamic Model
    // We want the collection to be "sessionId.auth" to appear in the folder
    const dbCollectionName = `${sessionId}.authstates`;
    const ModelName = `${sessionId}_AuthState`;

    let AuthState;
    try {
        AuthState = mongoose.model(ModelName);
    } catch {
        // Increase timeout for slow connections
        AuthState = mongoose.model(ModelName, AuthStateSchema, dbCollectionName);
    }

    // 1. Write Data
    const writeData = async (data, id) => {
        try {
            // Serialize data to string using BufferJSON to preserve Buffer types
            // This mimics the filesystem behavior and ensures compatibility
            const stringifiedData = JSON.stringify(data, BufferJSON.replacer);

            await AuthState.findOneAndUpdate(
                { _id: id },
                { data: stringifiedData },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error writing auth state to DB:', error);
        }
    };

    // 2. Read Data
    const readData = async (id) => {
        try {
            const result = await AuthState.findById(id);
            if (result && result.data) {
                // Deserialize data using BufferJSON
                // If the data was stored as a string (new format), parse it.
                // If it was somehow stored as Object (old format), this might fail, so we catch.
                if (typeof result.data === 'string') {
                    return JSON.parse(result.data, BufferJSON.reviver);
                }
                // Fallback for migration/safety (though we prefer string)
                return result.data;
            }
            return null;
        } catch (error) {
            console.error('Error reading auth state from DB:', error);
            return null;
        }
    };

    // 3. Remove Data
    const removeData = async (id) => {
        try {
            await AuthState.findByIdAndDelete(id);
        } catch (error) {
            console.error('Error removing auth state from DB:', error);
        }
    };

    // 4. Initialize Creds
    const creds = await readData('creds') || initAuthCreds();

    // 5. Clear All Data (for logout/reset)
    const clearAllData = async () => {
        try {
            await AuthState.deleteMany({});
        } catch (error) {
            console.error('Error clearing auth state from DB:', error);
        }
    };

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        // No need for explicit BufferJSON.reviver here calls since readData handles it
                        if (value) data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        },
        clearState: clearAllData
    };
};

module.exports = { useMongoDBAuthState };

const axios = require('axios');

const defaultHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "DNT": "1",
    "Connection": "keep-alive",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
};

async function wasi_get(url, headers = {}) {
    try {
        const response = await axios.get(url, {
            headers: { ...defaultHeaders, ...headers }
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`HTTP ${error.response.status}: ${error.response.data}`);
        }
        throw new Error(error.message);
    }
}

async function wasi_post(url, data, headers = {}) {
    try {
        const response = await axios.post(url, data, {
            headers: {
                ...defaultHeaders,
                "Content-Type": "application/json",
                ...headers,
            }
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`HTTP ${error.response.status}: ${error.response.data}`);
        }
        throw new Error(error.message);
    }
}

async function wasi_getBuffer(url, headers = {}) {
    try {
        const response = await axios.get(url, {
            headers: { ...defaultHeaders, Accept: "*/*", ...headers },
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data);
    } catch (error) {
        if (error.response) {
            throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        }
        throw new Error(error.message);
    }
}

module.exports = { wasi_get, wasi_post, wasi_getBuffer };

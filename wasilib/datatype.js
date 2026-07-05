const { Readable } = require('stream');
const https = require('https');
const http = require('http');

const SIGNATURE_MAP = new Map([
    ["ffd8ff", { mime: "image/jpeg", type: "image", ext: "jpg" }],
    ["89504e", { mime: "image/png", type: "image", ext: "png" }],
    ["474946", { mime: "image/gif", type: "image", ext: "gif" }],
    ["52494646", { mime: "image/webp", type: "image", ext: "webp" }],
    ["424d", { mime: "image/bmp", type: "image", ext: "bmp" }],
    ["49492a00", { mime: "image/tiff", type: "image", ext: "tiff" }],
    ["4d4d002a", { mime: "image/tiff", type: "image", ext: "tiff" }],
    ["000000", { mime: "video/mp4", type: "video", ext: "mp4" }],
    ["1a45dfa3", { mime: "video/webm", type: "video", ext: "webm" }],
    ["464c5601", { mime: "video/x-flv", type: "video", ext: "flv" }],
    ["000001", { mime: "video/mpeg", type: "video", ext: "mpeg" }],
    ["52494646", { mime: "video/avi", type: "video", ext: "avi" }],
    ["494433", { mime: "audio/mpeg", type: "audio", ext: "mp3" }],
    ["fff3", { mime: "audio/mpeg", type: "audio", ext: "mp3" }],
    ["fff2", { mime: "audio/mpeg", type: "audio", ext: "mp3" }],
    ["fffb", { mime: "audio/mpeg", type: "audio", ext: "mp3" }],
    ["4f676753", { mime: "audio/ogg", type: "audio", ext: "ogg" }],
    ["52494646", { mime: "audio/wav", type: "audio", ext: "wav" }],
    ["664c6143", { mime: "audio/flac", type: "audio", ext: "flac" }],
    ["4d546864", { mime: "audio/midi", type: "audio", ext: "midi" }],
    ["25504446", { mime: "application/pdf", type: "document", ext: "pdf" }],
    ["504b0304", { mime: "application/zip", type: "document", ext: "zip" }],
    ["504b0506", { mime: "application/zip", type: "document", ext: "zip" }],
    ["504b0708", { mime: "application/zip", type: "document", ext: "zip" }],
    ["d0cf11e0", { mime: "application/msword", type: "document", ext: "doc" }],
    ["504b0304", { mime: "application/vnd.openxmlformats-officedocument", type: "document", ext: "docx" }],
    ["377abcaf", { mime: "application/x-7z-compressed", type: "document", ext: "7z" }],
    ["1f8b08", { mime: "application/gzip", type: "document", ext: "gz" }],
    ["425a68", { mime: "application/x-bzip2", type: "document", ext: "bz2" }],
    ["526172", { mime: "application/x-rar-compressed", type: "document", ext: "rar" }],
]);

const TEXT_SIGNATURES = new Set([
    "3c21444f", "3c48544d", "3c3f786d", "7b0a2020", "5b0a2020",
    "7b227665", "3c737667", "23212f62", "2f2a2a2a"
]);

function extractSignature(buffer, length = 4) {
    return buffer.subarray(0, length).toString("hex").toLowerCase();
}

function detectBySignature(buffer) {
    for (let i = 8; i >= 2; i--) {
        const signature = extractSignature(buffer, i);
        const match = SIGNATURE_MAP.get(signature);
        if (match) return { mimetype: match.mime, type: match.type, ext: match.ext };
    }
    return null;
}

function detectTextContent(buffer) {
    const signature = extractSignature(buffer, 4);
    if (TEXT_SIGNATURES.has(signature)) return true;

    const sample = buffer.subarray(0, Math.min(1024, buffer.length));
    const nonPrintable = sample.filter(byte => byte < 32 && byte !== 9 && byte !== 10 && byte !== 13).length;

    return nonPrintable / sample.length < 0.1;
}

function detectWebPSticker(buffer) {
    if (buffer.length < 12) return false;
    const riffHeader = buffer.subarray(0, 4).toString();
    const webpHeader = buffer.subarray(8, 12).toString();
    return riffHeader === "RIFF" && webpHeader === "WEBP";
}

const wasi_DataType = async (input) => {
    const buffer = await normalizeToBuffer(input);

    if (!Buffer.isBuffer(buffer) || buffer.length === 0)
        return { mimetype: "application/octet-stream", type: "document", ext: "bin" };

    if (detectWebPSticker(buffer))
        return { mimetype: "image/webp", type: "sticker", ext: "webp" };

    const sig = detectBySignature(buffer);
    if (sig) return sig;

    if (detectTextContent(buffer))
        return { mimetype: "text/plain", type: "text", ext: "txt" };

    return { mimetype: "application/octet-stream", type: "document", ext: "bin" };
};

const normalizeToBuffer = async (input) => {
    if (typeof input === "string") {
        if (/^https?:\/\//.test(input)) return fetchUrlToBuffer(new URL(input));
        return Buffer.from(input);
    }

    if (input instanceof URL) return fetchUrlToBuffer(input);
    if (Buffer.isBuffer(input)) return input;
    if (input instanceof ArrayBuffer) return Buffer.from(input);
    if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);

    const chunks = [];
    for await (const chunk of input)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
};

const fetchUrlToBuffer = async (url) =>
    new Promise((resolve, reject) => {
        const req = (url.protocol === "https:" ? https : http).get(url, res => {
            const chunks = [];
            res.on("data", d => chunks.push(d));
            res.on("end", () => resolve(Buffer.concat(chunks)));
        });
        req.on("error", reject);
    });

module.exports = { wasi_DataType };

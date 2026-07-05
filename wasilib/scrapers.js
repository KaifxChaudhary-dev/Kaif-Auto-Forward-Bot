const { wasi_get, wasi_post, wasi_getBuffer } = require('./fetch');
const instatouch = require('instatouch');
const { instagramGetUrl } = require('instagram-url-direct');
const config = require('../wasi');
const fbdl = require('fbdl-core');

/**
 * TikTok Downloader with Fallback Strategy
 * @param {string} url - The TikTok video URL
 * @returns {Promise<Object>} - { result: { title, author, cover, wm_url, no_wm_url, music, type: 'video'|'image' } }
 */
async function wasi_tiktok(url) {
    // Strategy 1: TiklyDown
    try {
        const apiUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);

        if (data && data.id) {
            return {
                status: true,
                provider: 'TiklyDown',
                title: data.title,
                author: data.author?.name,
                cover: data.thumbnail,
                video: data.video?.noWatermark,
                audio: data.music?.play_url,
                caption: data.title
            };
        }
    } catch (e) {
        console.error('TiklyDown Failed:', e.message);
    }

    // Strategy 2: TikWM
    try {
        const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);

        if (data && data.data) {
            const t = data.data;
            return {
                status: true,
                provider: 'TikWM',
                title: t.title,
                author: t.author?.nickname,
                cover: t.cover,
                video: t.play,
                audio: t.music,
                caption: t.title
            };
        }
    } catch (e) {
        console.error('TikWM Failed:', e.message);
    }

    return { status: false, message: 'All providers failed' };
}

/**
 * Instagram Downloader with Fallback Strategy
 * @param {string} url - The Instagram post/reel URL
 * @returns {Promise<Object>} - { status: true, media: [{ url, type: 'video'|'image' }], caption }
 */
async function wasi_instagram(url) {
    // Strategy 1: instagram-url-direct (Modern Scraper)
    try {
        const data = await instagramGetUrl(url);
        if (data && data.url_list && data.url_list.length > 0) {
            return {
                status: true,
                provider: 'IG-Direct',
                caption: '',
                media: data.url_list.map(link => ({
                    url: link,
                    type: link.includes('.mp4') || link.includes('video') ? 'video' : 'image'
                }))
            };
        }
    } catch (e) {
        console.error('IG-Direct Failed:', e.message || e);
    }

    // Strategy 2: Instatouch (Direct Scraping)
    try {
        const options = { count: 1, mediaType: 'all', timeout: 0 };
        const result = await instatouch.getPostMeta(url, options);

        if (result && result.graphql && result.graphql.shortcode_media) {
            const media = result.graphql.shortcode_media;
            const items = [];

            if (media.edge_sidecar_to_children) {
                media.edge_sidecar_to_children.edges.forEach(edge => {
                    const node = edge.node;
                    items.push({
                        url: node.is_video ? node.video_url : node.display_url,
                        type: node.is_video ? 'video' : 'image'
                    });
                });
            } else {
                items.push({
                    url: media.is_video ? media.video_url : media.display_url,
                    type: media.is_video ? 'video' : 'image'
                });
            }

            return {
                status: true,
                provider: 'Instatouch',
                caption: media.edge_media_to_caption?.edges[0]?.node?.text || '',
                media: items
            };
        } else {
            throw new Error('Can\'t find shortcode_media');
        }
    } catch (e) {
        // Only log if it's not the common "Can't find requested data" which usually means rate limit/IP block
        if (e.message !== "Can't find requested data") {
            console.error('Instatouch Failed:', e.message || e);
        }
    }

    // Strategy 3: SnapInsta Web Scraper (New Fallback)
    try {
        const apiUrl = `https://api.snapinsta.io/v1/download?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status === 'success' && data.data) {
            return {
                status: true,
                provider: 'SnapInsta',
                caption: '',
                media: data.data.map(d => ({
                    url: d.url,
                    type: d.type === 'video' ? 'video' : 'image'
                }))
            };
        }
    } catch (e) { }

    return { status: false, message: 'All providers failed' };
}

/**
 * Facebook Downloader
 */
async function wasi_facebook(url) {
    // Strategy 0: Expand Short/Share URLs
    try {
        if (url.includes('share') || url.includes('fb.watch')) {
            console.log('[FB] Expanding short URL...');
            const axios = require('axios');
            const response = await axios.get(url, {
                maxRedirects: 5,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            url = response.request.res.responseUrl || url;
            console.log('[FB] Resolved URL:', url);
        }
    } catch (e) {
        console.error('[FB] URL Expansion Failed:', e.message);
    }

    // Strategy 1: Apify Facebook Posts Scraper (Premium Scraper)
    try {
        if (config.apifyToken) {
            console.log('[FB] Trying Apify Scraper...');
            const apifyUrl = `https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token=${config.apifyToken}`;
            const input = {
                "startUrls": [{ "url": url }],
                "resultsLimit": 1,
                "viewOption": "ADS_WASH",
                "includeComments": false,
                "proxyConfiguration": { "useApifyProxy": true }
            };

            const results = await wasi_post(apifyUrl, input);
            if (results && results.length > 0) {
                const item = results[0];
                const videoUrl = item.videoUrl || (item.attachments && item.attachments.find(a => a.type === 'video')?.url);

                if (videoUrl) {
                    return {
                        status: true,
                        provider: 'Apify-Premium',
                        sd: videoUrl,
                        hd: videoUrl,
                        title: item.message || 'Facebook Video'
                    };
                }
            }
        }
    } catch (e) { console.error('Apify FB Failed:', e.message); }

    // Strategy 2: fbdl-core (Local Library)
    try {
        console.log('[FB] Trying Local Library (fbdl-core)...');
        const data = await fbdl.getInfo(url);
        if (data && data.video) {
            return {
                status: true,
                provider: 'fbdl-core',
                sd: data.video,
                hd: data.video,
                title: data.title || 'Facebook Video'
            };
        }
    } catch (e) { console.error('fbdl-core FB Failed:', e.message); }

    // Strategy 2: Vreden v1
    try {
        console.log('[FB] Trying Vreden API...');
        const apiUrl = `https://api.vreden.my.id/api/v1/download/facebook?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.result && (data.result.sd || data.result.hd)) {
            return {
                status: true,
                provider: 'Vreden-v1',
                sd: data.result.sd,
                hd: data.result.hd,
                title: data.result.title || 'Facebook Video'
            };
        }
    } catch (e) { console.error('Vreden-v1 FB Failed:', e.message); }

    // Strategy 3: Siputzx
    try {
        console.log('[FB] Trying Siputzx API...');
        const apiUrl = `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.data && data.data.urls && data.data.urls.length > 0) {
            return {
                status: true,
                provider: 'Siputzx',
                sd: data.data.urls[0]?.url,
                hd: data.data.urls[1]?.url || data.data.urls[0]?.url,
                title: data.data.title || 'Facebook Video'
            };
        }
    } catch (e) { console.error('Siputzx FB Failed:', e.message); }

    // Strategy 4: AIO Downloader (Backup)
    try {
        console.log('[FB] Trying AIO API...');
        const apiUrl = `https://api.ryzendesu.vip/api/downloader/fbdl?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.data && data.data.length > 0) {
            const best = data.data.find(v => v.resolution === 'HD') || data.data[0];
            return {
                status: true,
                provider: 'Ryzen-AIO',
                sd: data.data[0].url,
                hd: best.url,
                title: 'Facebook Video'
            };
        }
    } catch (e) { console.error('Ryzen-AIO FB Failed:', e.message); }

    // Strategy 5: BK9 API (Final Backup)
    try {
        console.log('[FB] Trying BK9 API...');
        const apiUrl = `https://bk9.fun/download/facebook?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.BK9 && data.BK9.video) {
            return {
                status: true,
                provider: 'BK9',
                sd: data.BK9.video,
                hd: data.BK9.hd || data.BK9.video,
                title: 'Facebook Video'
            };
        }
    } catch (e) { console.error('BK9 FB Failed:', e.message); }

    return { status: false, message: 'All Facebook providers failed' };
}

/**
 * Twitter (X) Downloader
 */
async function wasi_twitter(url) {
    // Strategy 1: Siputzx
    try {
        const apiUrl = `https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.data) {
            return {
                status: true,
                provider: 'Siputzx',
                media: data.data.urls.map(u => ({ url: u.url, quality: u.subname })),
                caption: data.data.title || ''
            };
        }
    } catch (e) { console.error('Siputzx Twitter Failed:', e.message); }

    return { status: false, message: 'Failed to fetch Twitter video' };
}

/**
 * YouTube Downloader with Fallback Strategy
 * @param {string} url - The YouTube URL
 * @param {string} type - 'video' or 'audio'
 */
async function wasi_youtube(url, type = 'video') {
    // Strategy 1: Vreden API
    try {
        console.log(`[YT Scraping] Trying Vreden (${type})...`);
        const endpoint = type === 'audio' ? 'mp3' : 'video';
        const apiUrl = `https://api.vreden.my.id/api/v1/download/youtube/${endpoint}?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.result) {
            return {
                status: true,
                type: type,
                provider: 'Vreden',
                title: data.result.title,
                thumbnail: data.result.thumbnail,
                downloadUrl: data.result.downloadUrl
            };
        }
    } catch (e) { }

    // Strategy 2: Siputzx API
    try {
        console.log(`[YT Scraping] Trying Siputzx (${type})...`);
        const endpoint = type === 'audio' ? 'ytmp3' : 'ytmp4';
        const apiUrl = `https://api.siputzx.my.id/api/d/${endpoint}?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.data) {
            return {
                status: true,
                type: type,
                provider: 'Siputzx',
                title: data.data.title,
                thumbnail: data.data.thumbnail,
                downloadUrl: data.data.dl
            };
        }
    } catch (e) { }

    // Strategy 3: BK9 API
    try {
        console.log(`[YT Scraping] Trying BK9 (${type})...`);
        const endpoint = type === 'audio' ? 'audio' : 'video';
        const apiUrl = `https://bk9.fun/download/youtube?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.BK9) {
            const res = data.BK9;
            return {
                status: true,
                type: type,
                provider: 'BK9',
                title: res.title,
                thumbnail: res.thumbnail,
                downloadUrl: type === 'audio' ? res.audio[0].url : res.video[0].url
            };
        }
    } catch (e) { }

    // Strategy 4: RyzenDesu API
    try {
        console.log(`[YT Scraping] Trying RyzenDesu (${type})...`);
        const apiUrl = `https://api.ryzendesu.vip/api/downloader/ytdl?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.data) {
            const res = data.data;
            return {
                status: true,
                type: type,
                provider: 'RyzenDesu',
                title: res.title,
                thumbnail: res.thumbnail,
                downloadUrl: type === 'audio' ? res.mp3 : res.mp4
            };
        }
    } catch (e) { }

    return { status: false, message: 'All YouTube scraping strategies failed' };
}

/**
 * CapCut Downloader
 */
async function wasi_capcut(url) {
    // Strategy 1: Vreden v1
    try {
        const apiUrl = `https://api.vreden.my.id/api/v1/download/capcut?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.result) {
            return {
                status: true,
                provider: 'Vreden-v1',
                video: data.result.video,
                title: data.result.title || 'CapCut Video'
            };
        }
    } catch (e) { console.error('Vreden-v1 CapCut Failed:', e.message); }

    return { status: false, message: 'Failed to fetch CapCut video' };
}

/**
 * Spotify Downloader
 */
async function wasi_spotify(url) {
    try {
        const apiUrl = `https://api.salmanahmad.tech/api/downloader/spotify?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.data) {
            return {
                status: true,
                provider: 'SalmanAhmad',
                title: data.data.title,
                artist: data.data.artist,
                thumbnail: data.data.thumbnail,
                downloadUrl: data.data.downloadUrl
            };
        }
    } catch (e) {
        console.error('Spotify Scraping Failed:', e.message);
    }
    return { status: false, message: 'Spotify scraping failed' };
}

/**
 * Pinterest Downloader
 */
async function wasi_pinterest(url) {
    // Strategy 1: Vreden v1
    try {
        const apiUrl = `https://api.vreden.my.id/api/v1/download/pinterest?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.result) {
            return {
                status: true,
                provider: 'Vreden-v1',
                url: data.result.url || data.result.image || data.result.video,
                type: data.result.video ? 'video' : 'image',
                title: data.result.title || 'Pinterest Media'
            };
        }
    } catch (e) { console.error('Vreden-v1 Pinterest Failed:', e.message); }

    // Strategy 2: Siputzx
    try {
        const apiUrl = `https://api.siputzx.my.id/api/d/pinterest?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.data) {
            return {
                status: true,
                provider: 'Siputzx',
                url: data.data.url || data.data.image || data.data.video,
                type: data.data.video ? 'video' : 'image',
                title: data.data.title || 'Pinterest Media'
            };
        }
    } catch (e) { console.error('Siputzx Pinterest Failed:', e.message); }

    // Strategy 3: BK9
    try {
        const apiUrl = `https://bk9.fun/download/pinterest?url=${encodeURIComponent(url)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.BK9) {
            return {
                status: true,
                provider: 'BK9',
                url: data.BK9.url || data.BK9.image || data.BK9.video,
                type: data.BK9.video ? 'video' : 'image',
                title: 'Pinterest Media'
            };
        }
    } catch (e) { console.error('BK9 Pinterest Failed:', e.message); }

    return { status: false, message: 'Failed to fetch Pinterest media' };
}

/**
 * Pinterest Search
 */
async function wasi_pinterest_search(query) {
    // Strategy 1: Vreden v1
    try {
        const apiUrl = `https://api.vreden.my.id/api/v1/search/pinterest?query=${encodeURIComponent(query)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.result) {
            return {
                status: true,
                provider: 'Vreden-v1',
                result: data.result
            };
        }
    } catch (e) { console.error('Vreden-v1 Pinterest Search Failed:', e.message); }

    // Strategy 2: Siputzx
    try {
        const apiUrl = `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`;
        const data = await wasi_get(apiUrl);
        if (data && data.status && data.data) {
            return {
                status: true,
                provider: 'Siputzx',
                result: data.data
            };
        }
    } catch (e) { console.error('Siputzx Pinterest Search Failed:', e.message); }

    return { status: false, message: 'Failed to search Pinterest' };
}

module.exports = {
    wasi_tiktok,
    wasi_instagram,
    wasi_facebook,
    wasi_twitter,
    wasi_youtube,
    wasi_capcut,
    wasi_spotify,
    wasi_pinterest,
    wasi_pinterest_search
};

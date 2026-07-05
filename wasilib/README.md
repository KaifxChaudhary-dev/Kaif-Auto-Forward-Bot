# WASI-MD-V7 Libs (The Engine Room) ⚙️

This is where the magic (and the hard work) happens. While the plugins carry out the commands, the files in `wasilib` are what make them possible. This folder contains all the shared functions, database logic, and specialized scrapers that keep the bot running smoothly.

### What's actually in here? 🛠️
Everything in here is built to be reused across different plugins so I don't have to write the same code twice.

- **`database.js`:** This is the bridge to MongoDB. It handles everything from saving group settings (like antilink) to storing your owner configuration.
- **`scrapers.js`:** My collection of "web scrapers". When you want to download a TikTok or a Pinterest video, this file goes out to the internet, finds the direct link, and brings it back to the bot.
- **`session.js` / `mongoAuth.js`:** These manage your connection to WhatsApp. They handle the "Multi-Device" logic and make sure your session survives even if the server restarts.
- **`media.js`:** The uploader/downloader tool. It handles sending images, videos, and stickers to various cloud storage (like Catbox) so they can be processed or forwarded easily.
- **`menus.js` / `fonts.js`:** The aesthetics! This handles generating the fancy menu styles and those cool-looking fonts you see in the chat.

### Note for Developers 👨‍💻
Try not to change things in here unless you know what you're doing. A small typo in `database.js` could break every single command! If you need a new utility function, this is the place to add it so you can use it anywhere in the bot.

---
*Keep it organized, keep it fast!*

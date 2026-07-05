const moment = require('moment-timezone');
const process = require('process');
const config = require('../wasi');

const TIMEZONE = 'Asia/Karachi';

/* ================= SYSTEM INFO ================= */
const getSystemInfo = () => {
    const uptime = process.uptime();

    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const fmtUptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const now = moment().tz(TIMEZONE);

    const currentTime = now.format('hh:mm:ss a');
    const currentDate = now.format('DD/MM/YYYY');

    const startTime = now.clone().subtract(uptime, 'seconds');
    const botStartTime = startTime.format('hh:mm:ss a');
    const botStartDate = startTime.format('DD/MM/YYYY');

    return {
        uptime: fmtUptime,
        currentTime,
        currentDate,
        botStartTime,
        botStartDate
    };
};

/* ================= COMMANDS ================= */
const getAllCommands = (wasi_plugins) => {
    const uniquePlugins = new Set(wasi_plugins.values());
    const cmds = [];

    for (const plugin of uniquePlugins) {
        cmds.push(plugin.name);
    }

    return cmds.sort();
};

/* ================= MENU CARD ================= */
const buildMenuCard = (wasi_plugins) => {
    const info = getSystemInfo();
    const cmds = getAllCommands(wasi_plugins);

    // fixed width for labels
    const labelWidth = 12;

    let text = '';
    text += `${'UPTIME'.padEnd(labelWidth)}: ${info.uptime}\n`;
    text += `${'STARTED AT'.padEnd(labelWidth)}: ${info.botStartTime} | ${info.botStartDate}\n`;
    text += `${'NOW Time'.padEnd(labelWidth)}: ${info.currentTime} | ${info.currentDate}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    // Flat command list
    for (const cmd of cmds) {
        text += `${config.prefix}${cmd}\n`;
    }

    return text.trim();
};

/* ================= EXPORT ================= */
const getMenu = (wasi_plugins) => {
    return buildMenuCard(wasi_plugins);
};

module.exports = { getMenu };

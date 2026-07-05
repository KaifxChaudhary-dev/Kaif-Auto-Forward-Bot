const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// Set the path to the binary provided by the installer
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

module.exports = ffmpeg;

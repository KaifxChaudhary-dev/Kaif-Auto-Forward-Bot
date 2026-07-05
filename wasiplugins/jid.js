module.exports = {
    name: 'jid',
    category: 'Debug',
    desc: 'Get the JID of the current chat',
    wasi_handler: async (wasi_sock, wasi_sender) => {
        await wasi_sock.sendMessage(wasi_sender, { text: `${wasi_sender}` });
    }
};

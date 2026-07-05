module.exports = {
    name: 'gjid',
    category: 'Debug',
    desc: 'List all groups and their JIDs of the user',
    wasi_handler: async (wasi_sock, wasi_sender) => {
        try {
            // Fetch all participating groups
            const allGroupsObj = await wasi_sock.groupFetchAllParticipating(); 
            const groupChats = Object.values(allGroupsObj); // convert object to array

            if (groupChats.length === 0) {
                return await wasi_sock.sendMessage(wasi_sender, { text: 'You are not a member of any groups.' });
            }

            // Build the message
            let msg = 'Your groups and their JIDs:\n\n';
            groupChats.forEach((group, index) => {
                msg += `${index + 1}. ${group.subject} — ${group.id}\n`;
            });

            // Send the message
            await wasi_sock.sendMessage(wasi_sender, { text: msg });
        } catch (error) {
            console.error(error);
            await wasi_sock.sendMessage(wasi_sender, { text: 'Error fetching groups.' });
        }
    }
};

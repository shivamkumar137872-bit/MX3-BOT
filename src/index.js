const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    EmbedBuilder, 
    Events
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CHECKING_CHANNEL_ID = '1320326014550806553';
const ADMIN_LOG_CHANNEL_ID = '1554796846579327006';

// DATA STRUCTURES
const pendingUnmutes = new Set(); // Unmute pending queue
const exemptUsers = new Set();    // VIP list for !unmute command

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent 
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ ${client.user.tag} is online!`);
    console.log('🔍 MX3 CHECKER BOT: Admin Bypass & Unmute Command Active.');
});

// 1. Text Commands Handler (!setuppanel & !unmute)
client.on(Events.MessageCreate, async message => {
    // A. Setup Panel
    if (message.content === '!setuppanel' && message.member.permissions.has('Administrator')) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('register_button').setLabel('📝 Register for MX3 E-SPORTS').setStyle(ButtonStyle.Primary)
        );
        await message.channel.send({ content: 'Click the button below to register!', components: [row] });
        try { await message.delete(); } catch (err) {}
    }

    // B. Custom !unmute @user command (Permanent Exemption)
    if (message.content.startsWith('!unmute') && message.member.permissions.has('Administrator')) {
        const targetUser = message.mentions.members.first();
        if (targetUser) {
            exemptUsers.add(targetUser.id); // VIP list me daal diya
            if (targetUser.voice && targetUser.voice.serverMuted) {
                try {
                    await targetUser.voice.setMute(false, 'Manual permanent unmute by Admin');
                } catch (e) {}
            }
            return message.reply(`✅ 🔊 **${targetUser.user.tag}** has been unmuted and permanently exempted from Auto-Mute!`);
        } else {
            return message.reply('❌ Please tag a valid user. Example: `!unmute @user`');
        }
    }
});

// 2. Registration Form
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton() && interaction.customId === 'register_button') {
        const modal = new ModalBuilder().setCustomId('registration_form').setTitle('MX3 Guild Registration');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q_name').setLabel("What is your real name?").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q_ign_uid').setLabel("Free Fire IGN and UID?").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q_role').setLabel("Preferred Role?").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q_device').setLabel("What device do you play on?").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q_experience').setLabel("Experience & Headshot Rate?").setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'registration_form') {
        const name = interaction.fields.getTextInputValue('q_name');
        try {
            await interaction.member.setNickname(`MX3・${name}`);
            await interaction.reply({ content: `✅ Done! Your nickname is now **MX3・${name}**.`, ephemeral: true });
            
            const adminChannel = client.channels.cache.get(ADMIN_LOG_CHANNEL_ID);
            if (adminChannel) {
                await adminChannel.send({ embeds: [new EmbedBuilder()
                    .setTitle('📝 New MX3 Guild Registration').setColor(0x00FF00)
                    .addFields(
                        { name: 'Member', value: `${interaction.user.tag}` },
                        { name: 'Real Name', value: name },
                        { name: 'IGN & UID', value: interaction.fields.getTextInputValue('q_ign_uid') },
                        { name: 'Role', value: interaction.fields.getTextInputValue('q_role') },
                        { name: 'Device', value: interaction.fields.getTextInputValue('q_device') },
                        { name: 'Experience', value: interaction.fields.getTextInputValue('q_experience') }
                    ).setTimestamp()
                ]});
            }
        } catch (error) {
            if (!interaction.replied) await interaction.reply({ content: '❌ Error setting nickname.', ephemeral: true });
        }
    }
});

// 3. THE 100X VOICE STATE SYSTEM (With Admin & VIP Bypass)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const member = newState.member;
    if (!member || member.user.bot) return;

    // 🚀 MASTER BYPASS: Agar banda Administrator hai YA VIP list me hai, toh code yahin ruk jayega!
    if (member.permissions.has('Administrator') || exemptUsers.has(member.id)) {
        return; 
    }

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // STEP A: Member Joins Checking VC
    if (newChannelId === CHECKING_CHANNEL_ID) {
        if (oldChannelId !== CHECKING_CHANNEL_ID) {
            try {
                await newState.setMute(true, 'Joined MX3 CHECKING');
                pendingUnmutes.add(member.id); 
                console.log(`🔇 Auto-muted: ${member.user.tag}`);
            } catch (error) {
                console.error(`❌ Mute Error:`, error.message);
            }
        }
        return;
    }

    // STEP B: Member is safely connected to ANY OTHER VC
    if (newChannelId !== null && newChannelId !== CHECKING_CHANNEL_ID) {
        const justLeftChecking = oldChannelId === CHECKING_CHANNEL_ID;
        const isInMemoryQueue = pendingUnmutes.has(member.id);

        if (justLeftChecking || isInMemoryQueue) {
            try {
                await newState.setMute(false, 'Left MX3 CHECKING');
                pendingUnmutes.delete(member.id); 
                console.log(`🔊 Auto-unmuted: ${member.user.tag}`);
            } catch (error) {
                console.error(`❌ Unmute Error for ${member.user.tag}:`, error.message);
            }
        }
    }
});

client.login('MTU1NDU3MDgxMzg0NjMyMzI5MQ.GjxG1x.FHsgpoPHHLWcIOVEVwounioW4FVOtoCNapi0cQ');

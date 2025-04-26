require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const connectDB = require('./config/database');
const Ticket = require('./models/Ticket');
const TicketPanel = require('./models/TicketPanel');
const { handleSetupCommand, handleTicketCreation, handleTicketClose, handleRating } = require('./handlers/interactionHandler');
const { handlePriorityChange } = require('./handlers/priorityHandler');
const { logError, logInfo } = require('./utils/logger');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// Подключение к базе данных
connectDB();

client.once('ready', async () => {
    logInfo('Bot', `Бот ${client.user.tag} успешно запущен!`);
    
    try {
        // Находим все сохраненные панели тикетов
        const panels = await TicketPanel.find({});
        
        for (const panel of panels) {
            try {
                const channel = await client.channels.fetch(panel.channelId);
                if (!channel) continue;

                const message = await channel.messages.fetch(panel.messageId);
                if (!message) continue;

                // Обновляем компоненты сообщения
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Система тикетов')
                    .setDescription('Для создания тикета выберите категорию')
                    .setColor('#0099ff')
                    .addFields(
                        { name: '🔧 Техническая поддержка', value: 'Технические вопросы и проблемы' },
                        { name: '🐛 Сообщение об ошибке', value: 'Сообщить о найденной ошибке' },
                        { name: '❓ Общий вопрос', value: 'Другие вопросы' }
                    );

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_category')
                    .setPlaceholder('Выберите категорию')
                    .addOptions([
                        {
                            label: 'Техническая поддержка',
                            description: 'Технические вопросы и проблемы',
                            value: 'support',
                            emoji: '🔧'
                        },
                        {
                            label: 'Сообщение об ошибке',
                            description: 'Сообщить о найденной ошибке',
                            value: 'bug',
                            emoji: '🐛'
                        },
                        {
                            label: 'Общий вопрос',
                            description: 'Другие вопросы',
                            value: 'general',
                            emoji: '❓'
                        }
                    ]);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await message.edit({
                    embeds: [embed],
                    components: [row]
                });
            } catch (error) {
                console.error('Ошибка при обновлении панели:', error);
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке панелей:', error);
    }
});

// Обработка команд
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isCommand() && interaction.commandName === 'setup-tickets') {
            await handleSetupCommand(interaction);
        } else if (interaction.isStringSelectMenu() && interaction.customId === 'select_category') {
            await handleTicketCreation(interaction);
        } else if (interaction.isButton()) {
            if (interaction.customId === 'close_ticket') {
                await handleTicketClose(interaction);
            } else if (interaction.customId.startsWith('priority_')) {
                await handlePriorityChange(interaction);
            } else if (interaction.customId.startsWith('rate_')) {
                await handleRating(interaction);
            }
        }
    } catch (error) {
        logError('InteractionCreate', error);
        try {
            await interaction.reply({
                content: 'Произошла ошибка при выполнении команды.',
                ephemeral: true
            });
        } catch (replyError) {
            logError('InteractionReply', replyError);
        }
    }
});

// Функция для получения русского названия категории
function getCategoryName(category) {
    const categories = {
        'support': 'Техническая поддержка',
        'bug': 'Сообщение об ошибке',
        'general': 'Общий вопрос'
    };
    return categories[category] || category;
}

// Сохранение сообщений
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    try {
        const ticket = await Ticket.findOne({ channelId: message.channel.id });
        if (ticket) {
            ticket.messages.push({
                userId: message.author.id,
                content: message.content,
                timestamp: new Date()
            });
            await ticket.save();
        }
    } catch (error) {
        logError('MessageCreate', error);
    }
});

client.login(process.env.TOKEN); 
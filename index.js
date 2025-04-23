require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const connectDB = require('./config/database');
const Ticket = require('./models/Ticket');
const TicketPanel = require('./models/TicketPanel');

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
    console.log(`Бот ${client.user.tag} успешно запущен!`);
    
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
        if (!interaction.isCommand()) return;

        if (interaction.commandName === 'setup-tickets') {
            // Проверяем права администратора
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: 'У вас нет прав для использования этой команды!',
                    ephemeral: true
                });
            }

            // Проверяем, существует ли уже панель на сервере
            const existingPanel = await TicketPanel.findOne({ guildId: interaction.guildId });
            if (existingPanel) {
                return interaction.reply({
                    content: 'Панель тикетов уже создана на этом сервере! Вы можете создать только одну панель.',
                    ephemeral: true
                });
            }

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

            const message = await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

            // Сохраняем информацию о панели в базе данных
            const panel = new TicketPanel({
                messageId: message.id,
                channelId: interaction.channelId,
                guildId: interaction.guildId
            });
            await panel.save();

            await interaction.reply({
                content: 'Панель тикетов успешно создана!',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Ошибка при обработке команды:', error);
        await interaction.reply({
            content: 'Произошла ошибка при выполнении команды.',
            ephemeral: true
        });
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

// В обработчике создания тикета меняем описание
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId === 'select_category') {
        try {
            const category = interaction.values[0];
            const categoryName = getCategoryName(category);
            const guild = interaction.guild;
            
            // Проверяем существование категории
            const ticketCategory = guild.channels.cache.get(process.env.CATEGORY_ID);
            if (!ticketCategory || ticketCategory.type !== ChannelType.GuildCategory) {
                return interaction.reply({
                    content: 'Ошибка: категория для тикетов не найдена или указан неверный ID категории. Пожалуйста, проверьте настройки бота.',
                    ephemeral: true
                });
            }

            // Проверяем лимит тикетов
            const userTickets = await Ticket.find({
                userId: interaction.user.id,
                status: 'open'
            });

            if (userTickets.length >= parseInt(process.env.MAX_TICKETS_PER_USER)) {
                return interaction.reply({
                    content: `У вас уже открыто максимальное количество тикетов (${process.env.MAX_TICKETS_PER_USER})!`,
                    ephemeral: true
                });
            }

            const channelName = `тикет-${interaction.user.username}-${getCategoryName(category).toLowerCase().replace(/\s+/g, '-')}`;

            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: ticketCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: process.env.SUPPORT_ROLE_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });

            const ticket = new Ticket({
                ticketId: ticketChannel.id,
                channelId: ticketChannel.id,
                userId: interaction.user.id,
                category: category,
                status: 'open',
                createdAt: new Date()
            });
            await ticket.save();

            const embed = new EmbedBuilder()
                .setTitle('🎫 Тикет создан')
                .setDescription(`Добро пожаловать в ваш тикет, ${interaction.user}!
Тип обращения: **${categoryName}**
Опишите свой вопрос, и команда поддержки скоро ответит.`)
                .setColor('#00ff00')
                .setTimestamp();

            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Закрыть тикет')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            const ticketMessage = await ticketChannel.send({
                content: `<@&${process.env.SUPPORT_ROLE_ID}> - Новый тикет`,
                embeds: [embed],
                components: [row]
            });

            ticket.messageId = ticketMessage.id;
            await ticket.save();

            await interaction.reply({
                content: `Ваш тикет создан: ${ticketChannel}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Ошибка при создании тикета:', error);
            await interaction.reply({
                content: 'Произошла ошибка при создании тикета. Убедитесь, что у бота есть все необходимые права и категория настроена правильно.',
                ephemeral: true
            });
        }
    }
});

// Обработка закрытия тикета
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'close_ticket') return;

    try {
        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
        if (ticket) {
            ticket.status = 'closed';
            ticket.closedAt = new Date();
            await ticket.save();

            const embed = new EmbedBuilder()
                .setTitle('🎫 Тикет закрыт')
                .setDescription(`Тикет закрыт пользователем ${interaction.user}`)
                .setColor('#ff0000')
                .setTimestamp();

            await interaction.channel.send({ embeds: [embed] });

            // Задержка перед удалением канала
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (error) {
                    console.error('Ошибка при удалении канала:', error);
                }
            }, 5000);

            await interaction.reply({
                content: 'Тикет будет закрыт через 5 секунд.',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Ошибка при закрытии тикета:', error);
        await interaction.reply({
            content: 'Произошла ошибка при закрытии тикета.',
            ephemeral: true
        });
    }
});

// Сохранение сообщений
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const ticket = await Ticket.findOne({ channelId: message.channel.id });
    if (ticket) {
        ticket.messages.push({
            userId: message.author.id,
            content: message.content,
            timestamp: new Date()
        });
        await ticket.save();
    }
});

client.login(process.env.TOKEN); 
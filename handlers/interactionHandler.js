const { PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const Ticket = require('../models/Ticket');
const TicketPanel = require('../models/TicketPanel');
const { getCategoryName } = require('../utils/helpers');
const { createPriorityButtons, priorityColors, priorityEmojis } = require('./priorityHandler');

async function handleSetupCommand(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: 'У вас нет прав для использования этой команды!',
            ephemeral: true
        });
    }

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

async function handleTicketCreation(interaction) {
    const category = interaction.values[0];
    const categoryName = getCategoryName(category);
    const guild = interaction.guild;
    
    const ticketCategory = guild.channels.cache.get(process.env.CATEGORY_ID);
    if (!ticketCategory || ticketCategory.type !== ChannelType.GuildCategory) {
        return interaction.reply({
            content: 'Ошибка: категория для тикетов не найдена или указан неверный ID категории.',
            ephemeral: true
        });
    }

    // Получаем случайного хелпера
    const supportRole = await guild.roles.fetch(process.env.SUPPORT_ROLE_ID);
    const helpers = supportRole.members;
    const randomHelper = helpers.random();
    const helperId = randomHelper ? randomHelper.id : null;

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

    const defaultPriority = 'medium';
    const ticket = new Ticket({
        ticketId: ticketChannel.id,
        channelId: ticketChannel.id,
        userId: interaction.user.id,
        category: category,
        status: 'open',
        priority: defaultPriority,
        assignedTo: helperId
    });
    await ticket.save();

    const embed = new EmbedBuilder()
        .setTitle('🎫 Тикет создан')
        .setDescription(`Добро пожаловать в ваш тикет, ${interaction.user}!
Тип обращения: **${categoryName}**
${helperId ? `Назначенный хелпер: <@${helperId}>` : ''}`)
        .addFields({
            name: 'Приоритет',
            value: `${priorityEmojis[defaultPriority]} **${defaultPriority.toUpperCase()}**`,
            inline: false
        })
        .setColor(priorityColors[defaultPriority])
        .setTimestamp();

    const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Закрыть тикет')
        .setStyle(ButtonStyle.Danger);

    const row1 = new ActionRowBuilder().addComponents(closeButton);
    const row2 = createPriorityButtons(defaultPriority);

    const ticketMessage = await ticketChannel.send({
        content: `${helperId ? `<@${helperId}>` : `<@&${process.env.SUPPORT_ROLE_ID}>`} - Новый тикет`,
        embeds: [embed],
        components: [row1, row2]
    });

    ticket.messageId = ticketMessage.id;
    await ticket.save();

    await interaction.reply({
        content: `Ваш тикет создан: ${ticketChannel}`,
        ephemeral: true
    });
}

async function handleTicketClose(interaction) {
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

        // Кнопки для оценки
        const ratingRow = new ActionRowBuilder().addComponents(
            [1,2,3,4,5].map(num => new ButtonBuilder()
                .setCustomId(`rate_${num}_${ticket._id}`)
                .setLabel('★'.repeat(num))
                .setStyle(ButtonStyle.Secondary)
            )
        );

        // Новый текст для оценки
        const ratingText = `Пожалуйста, оцените качество поддержки по этому тикету`;

        // Отправляем пользователю в личку запрос на оценку
        try {
            const user = await interaction.client.users.fetch(ticket.userId);
            await user.send({
                content: ratingText,
                components: [ratingRow]
            });
        } catch (e) {
            // Если не удалось отправить в личку, отправляем в канал тикета
            await interaction.channel.send({
                content: `<@${ticket.userId}>, ${ratingText}`,
                components: [ratingRow]
            });
        }

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
}

async function handleRating(interaction) {
    const [_, ratingStr, ticketId] = interaction.customId.split('_');
    const rating = parseInt(ratingStr);
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
        return interaction.reply({ content: 'Не удалось найти тикет для оценки.', ephemeral: true });
    }
    if (ticket.rating) {
        return interaction.reply({ content: `Вы уже оценили этот тикет: ${'★'.repeat(ticket.rating)} (ID: ${ticket._id})`, ephemeral: true });
    }
    ticket.rating = rating;
    ticket.ratingHistory.push({ rating, userId: interaction.user.id });
    await ticket.save();

    // Проверяем существование канала
    let ticketReference = `Тикет ID: ${ticket._id}`;
    try {
        const channel = await interaction.client.channels.fetch(ticket.channelId);
        if (channel) {
            ticketReference = `<#${ticket.channelId}> (ID: ${ticket._id})`;
        }
    } catch (e) {
        // Канал не существует, оставляем просто ID
    }

    await interaction.reply({ 
        content: `Спасибо за вашу оценку для ${ticketReference}: ${'★'.repeat(rating)}`, 
        ephemeral: true 
    });

    // Уведомление в канал обратной связи
    try {
        const feedbackChannel = await interaction.client.channels.fetch(process.env.FEEDBACK_CHANNEL_ID);
        if (feedbackChannel) {
            const helperMention = ticket.assignedTo ? `<@${ticket.assignedTo}>` : '—';
            const embed = new EmbedBuilder()
                .setTitle('⭐ Новая оценка поддержки')
                .setColor('#FFD700')
                .addFields(
                    { name: 'Пользователь', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Оценка', value: '★'.repeat(rating), inline: true },
                    { name: 'Тикет', value: ticketReference, inline: false },
                    { name: 'Хелпер', value: helperMention, inline: true }
                )
                .setTimestamp();
            await feedbackChannel.send({ embeds: [embed] });
        }
    } catch (e) {
        // ignore
    }
}

module.exports = {
    handleSetupCommand,
    handleTicketCreation,
    handleTicketClose,
    handleRating
}; 
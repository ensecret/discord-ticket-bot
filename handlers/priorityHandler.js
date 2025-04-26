const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const Ticket = require('../models/Ticket');
const { logError, logInfo } = require('../utils/logger');

const priorityColors = {
    low: '#00ff00',    // Зеленый
    medium: '#ffff00',  // Желтый
    high: '#ff0000'     // Красный
};

const priorityEmojis = {
    low: '🟢',
    medium: '🟡',
    high: '🔴'
};

async function handlePriorityChange(interaction) {
    try {
        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
        if (!ticket) {
            return interaction.reply({
                content: 'Этот канал не является тикетом!',
                ephemeral: true
            });
        }

        const newPriority = interaction.customId.split('_')[1];
        const oldPriority = ticket.priority;
        
        // Добавляем запись в историю приоритетов
        ticket.priorityHistory.push({
            priority: newPriority,
            changedBy: interaction.user.id,
            timestamp: new Date()
        });
        
        ticket.priority = newPriority;
        await ticket.save();

        // Получаем первое сообщение тикета
        const messages = await interaction.channel.messages.fetch({ limit: 1 });
        const firstMessage = messages.last();

        if (firstMessage && firstMessage.embeds.length > 0) {
            const oldEmbed = firstMessage.embeds[0];
            const newEmbed = new EmbedBuilder()
                .setTitle(oldEmbed.title)
                .setDescription(oldEmbed.description)
                .addFields({
                    name: 'Приоритет',
                    value: `${priorityEmojis[newPriority]} **${newPriority.toUpperCase()}**`,
                    inline: false
                })
                .setColor(priorityColors[newPriority])
                .setTimestamp();

            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Закрыть тикет')
                .setStyle(ButtonStyle.Danger);

            const row1 = new ActionRowBuilder().addComponents(closeButton);
            const row2 = createPriorityButtons(newPriority);

            await firstMessage.edit({
                embeds: [newEmbed],
                components: [row1, row2]
            });
        }

        // Отправляем уведомление об изменении
        const notificationEmbed = new EmbedBuilder()
            .setTitle('🔄 Приоритет изменен')
            .setDescription(`Приоритет тикета изменен с ${priorityEmojis[oldPriority]} **${oldPriority.toUpperCase()}** на ${priorityEmojis[newPriority]} **${newPriority.toUpperCase()}**\nИзменено пользователем: ${interaction.user}`)
            .setColor(priorityColors[newPriority])
            .setTimestamp();

        await interaction.channel.send({ embeds: [notificationEmbed] });

        // Если приоритет высокий, отправляем уведомление персоналу
        if (newPriority === 'high') {
            const alertEmbed = new EmbedBuilder()
                .setTitle('⚠️ Высокий приоритет')
                .setDescription(`Тикет ${interaction.channel} был помечен как высокоприоритетный!\nПожалуйста, проверьте его как можно скорее.`)
                .setColor('#ff0000')
                .setTimestamp();

            await interaction.channel.send({
                content: `<@&${process.env.SUPPORT_ROLE_ID}>`,
                embeds: [alertEmbed]
            });
        }

        await interaction.reply({
            content: `Приоритет тикета успешно изменен на ${priorityEmojis[newPriority]} **${newPriority.toUpperCase()}**!`,
            ephemeral: true
        });

        logInfo('Priority', `Приоритет тикета ${ticket.ticketId} изменен на ${newPriority} пользователем ${interaction.user.tag}`);
    } catch (error) {
        logError('PriorityChange', error);
        await interaction.reply({
            content: 'Произошла ошибка при изменении приоритета тикета.',
            ephemeral: true
        });
    }
}

function createPriorityButtons(currentPriority) {
    const buttons = [];
    const priorities = ['low', 'medium', 'high'];

    for (const priority of priorities) {
        const button = new ButtonBuilder()
            .setCustomId(`priority_${priority}`)
            .setLabel(priority.toUpperCase())
            .setEmoji(priorityEmojis[priority])
            .setStyle(priority === currentPriority ? ButtonStyle.Secondary : ButtonStyle.Primary);

        buttons.push(button);
    }

    return new ActionRowBuilder().addComponents(buttons);
}

module.exports = {
    handlePriorityChange,
    createPriorityButtons,
    priorityColors,
    priorityEmojis
}; 
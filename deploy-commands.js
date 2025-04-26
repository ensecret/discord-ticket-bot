require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { logError, logInfo } = require('./utils/logger');

// Определение команд
const commands = [
    {
        name: 'setup-tickets',
        description: 'Создать панель управления тикетами',
        defaultMemberPermissions: '8' // Требуются права администратора
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

async function deployCommands() {
    try {
        if (!process.env.TOKEN || !process.env.CLIENT_ID) {
            throw new Error('Отсутствуют TOKEN или CLIENT_ID в переменных окружения');
        }

        logInfo('Deploy', 'Начало регистрации команд...');

        // Регистрируем команды глобально
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        logInfo('Deploy', `Успешно зарегистрировано ${data.length} команд`);
        logInfo('Deploy', 'Команды будут доступны на всех серверах через несколько минут');
    } catch (error) {
        logError('Deploy', error);
    }
}

deployCommands(); 
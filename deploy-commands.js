const { REST, Routes } = require('discord.js');
require('dotenv').config();

// Определение команд
const commands = [
    {
        name: 'setup-tickets',
        description: 'Создать панель тикетов в текущем канале',
        defaultMemberPermissions: '8' // Требуются права администратора
    }
];

async function deployCommands() {
    if (!process.env.TOKEN || !process.env.CLIENT_ID) {
        console.error('Ошибка: Отсутствуют TOKEN или CLIENT_ID в файле .env');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Начинаем регистрацию slash-команд...');

        // Регистрируем команды глобально
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log(`✅ Успешно зарегистрировано ${data.length} команд`);
        console.log('🔹 Команды станут доступны в течение часа');
        console.log('🔸 Для ускорения процесса можно перезапустить Discord клиент');
    } catch (error) {
        console.error('❌ Ошибка при регистрации команд:', error);
        process.exit(1);
    }
}

deployCommands(); 
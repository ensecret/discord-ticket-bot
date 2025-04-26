function logError(context, error) {
    console.error(`[${new Date().toISOString()}] Ошибка в ${context}:`, error);
}

function logInfo(context, message) {
    console.log(`[${new Date().toISOString()}] [${context}] ${message}`);
}

module.exports = {
    logError,
    logInfo
}; 
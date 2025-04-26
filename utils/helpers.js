function getCategoryName(category) {
    const categories = {
        'support': 'Техническая поддержка',
        'bug': 'Сообщение об ошибке',
        'general': 'Общий вопрос'
    };
    return categories[category] || category;
}

module.exports = {
    getCategoryName
}; 
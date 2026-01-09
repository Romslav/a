const mockApi = {
    async registerUser(user) {
        return {
            userId: user.id,
            firstName: user.first_name,
            phone: '',
            level: 'bronze',
            totalSpend: 45000,
            lastActivityDate: new Date().toISOString().split('T')[0],
            qrCode: 'QR-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
            balances: [{
                id: 'welcome_' + Date.now(),
                amount: 500,
                type: 'welcome',
                createdAt: new Date().toISOString().split('T')[0],
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'active'
            }],
            history: [
                { type: 'spend', amount: 0, checkAmount: 45000, date: '2026-01-05', note: 'Обеды', method: 'qr', source: 'iiko' }
            ],
            family: [
                { firstName: 'Иван (вы)', birthDate: '1990-05-15' },
                { firstName: 'Мария', birthDate: '1992-08-20' },
                { firstName: 'Сын', birthDate: '2018-07-25' }
            ]
        };
    },

    async processExpiration(userData) {
        const today = new Date();
        userData.balances = userData.balances?.filter(balance => {
            if (new Date(balance.expiresAt) < today) {
                balance.status = 'expired';
                userData.history.push({
                    type: 'burn',
                    amount: balance.amount,
                    date: today.toISOString().split('T')[0],
                    note: `${balance.type} сгорели`,
                    method: 'auto'
                });
                return false;
            }
            return true;
        }) || [];
        return userData;
    },

    async addBirthdayBonus(member) {
        return {
            id: 'birthday_' + Date.now(),
            amount: 1000,
            type: 'birthday',
            createdAt: new Date().toISOString().split('T')[0],
            expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'active'
        };
    },

    async syncUser(userId) {
        // ✅ ТЕСТОВЫЕ УРОВНИ
        const testLevels = {
            12345: { totalSpend: 75000, level: 'bronze' },     // 75% до Серебра
            67890: { totalSpend: 250000, level: 'silver' },    // 50% до Золота
            11111: { totalSpend: 600000, level: 'gold' }       // Золото!
        };
        
        const testData = testLevels[userId % 100000] || { totalSpend: 45000, level: 'bronze' };
        
        return {
            userId,
            totalSpend: testData.totalSpend,
            level: testData.level,
            balances: [{ amount: 1240, type: 'active', status: 'active' }],
            history: [
                { type: 'spend', amount: 0, checkAmount: testData.totalSpend, date: '2026-01-08', note: `Тест ${testData.level}`, method: 'qr', source: 'iiko' }
            ],
            qrCode: 'QR-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            shortCode: Math.floor(100000 + Math.random() * 900000).toString(),
            phone: '+7 (999) 123-45-67'
        };
    }
};

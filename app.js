class LoyaltyApp {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.currentUser = { 
            id: 12345, 
            first_name: 'Гость',
            username: '',
            photo_url: '',
            language_code: 'ru'
        };
        this.userData = {};
        this.init();
    }

    init() {
        // ✅ ПОЛНАЯ ИНТЕГРАЦИЯ TELEGRAM USER DATA
        if (this.tg) {
            this.tg.ready();
            this.tg.expand();
            
            // Получаем полные данные пользователя Telegram
            const userData = this.tg.initDataUnsafe?.user;
            if (userData) {
                this.currentUser = {
                    id: userData.id || 12345,
                    first_name: userData.first_name || 'Гость',
                    username: userData.username || '',
                    photo_url: userData.photo_url || '',
                    language_code: userData.language_code || 'ru'
                };
            }
            
            console.log('✅ Telegram User:', this.currentUser); // Debug
            
            // MainButton с персональными данными
            this.tg.MainButton.setText(`💾 Синхронизировать (${this.userData.balance || 0} баллов)`).onClick(() => this.sendToBot()).show();
            this.tg.MainButton.setParams({ 
                color: '#4CAF50', 
                text_color: '#fff',
                is_visible: true 
            });

            // Telegram Theme Sync
            if (this.tg.colorScheme === 'dark') {
                document.body.setAttribute('data-theme', 'dark');
            }
            this.tg.onEvent('themeChanged', () => {
                document.body.setAttribute('data-theme', this.tg.colorScheme);
            });
        }

        this.loadUserData();
        this.bindEvents();
        this.renderAll();
        this.hidePreloader();
    }

    loadUserData() {
        const key = `loyalty_${this.currentUser.id}`;
        this.userData = JSON.parse(localStorage.getItem(key)) || this.getDefaultData();
        
        // ✅ Персональный профиль с Telegram ID
        this.userData.userId = this.currentUser.id;
        this.userData.telegramUsername = this.currentUser.username;
        this.userData.telegramFirstName = this.currentUser.first_name;
    }

    getDefaultData() {
        return {
            userId: this.currentUser.id,
            telegramUsername: this.currentUser.username,
            telegramFirstName: this.currentUser.first_name,
            balance: 1240,
            level: 1,
            bonusRate: 0.08,
            phone: '',
            history: [
                {type: 'add', amount: 320, date: '07.01', note: 'Чек 4000₽'},
                {type: 'spend', amount: 500, date: '05.01', note: 'Скидка 500₽'}
            ],
            referralCode: `R-LOY-${this.currentUser.id}-${Math.floor(Math.random()*1000)}`.slice(0, 12)
        };
    }

    // ✅ Загрузка аватара Telegram пользователя
    async loadTelegramAvatar() {
        if (this.currentUser.photo_url) {
            try {
                const response = await fetch(this.currentUser.photo_url);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                document.getElementById('userAvatar').style.backgroundImage = `url(${url})`;
                document.getElementById('userAvatar').textContent = '';
            } catch (e) {
                console.log('Аватар недоступен:', e);
            }
        }
    }

    bindEvents() {
        // Навигация
        document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
            btn.onclick = (e) => this.handleNavClick(e.currentTarget.dataset.nav);
        });

        // Checkin методы
        document.querySelectorAll('.method-btn').forEach(btn => {
            btn.onclick = (e) => this.toggleCheckinMethod(e.currentTarget.dataset.method);
        });

        // Spend tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = (e) => this.toggleSpendTab(e.currentTarget.dataset.tab);
        });

        // Discount slider
        document.getElementById('discountSlider').oninput = (e) => {
            const value = e.target.value;
            document.getElementById('discountAmount').textContent = value;
            document.getElementById('discountRub').textContent = value + '₽';
            this.generateQR('discountQR', `СПИСАТЬ ${value}₽
TG: @${this.currentUser.username || 'user' + this.currentUser.id}
ID: ${this.userData.referralCode}`);
        };

        // Navbar кнопки
        document.getElementById('menuBtn').onclick = () => this.showAlert('Меню в разработке');
        document.getElementById('notifBtn').onclick = () => this.showAlert('Уведомления в разработке');
    }

    handleNavClick(navId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
        
        const screen = document.getElementById(navId + 'Screen');
        if (screen) screen.classList.add('active');
        
        document.querySelector(`[data-nav="${navId}"]`)?.classList.add('active');
        this.renderScreen(navId);
    }

    renderAll() {
        this.renderDashboard();
        this.renderQRCard();
        this.renderHistory();
        this.loadTelegramAvatar(); // Аватар Telegram
        document.getElementById('cardId').textContent = this.userData.referralCode;
        
        // Обновляем MainButton
        if (this.tg) {
            this.tg.MainButton.setText(`💾 Синхронизировать (${this.userData.balance} баллов)`);
        }
    }

    renderDashboard() {
        // ✅ Имя из Telegram
        document.getElementById('userName').textContent = this.currentUser.first_name || 'Гость';
        
        // ✅ Аватар из Telegram или fallback
        if (!this.currentUser.photo_url) {
            document.getElementById('userAvatar').textContent = this.currentUser.first_name?.[0]?.toUpperCase() || '👤';
        }
        
        document.getElementById('balanceValue').textContent = this.userData.balance.toLocaleString();
        document.getElementById('rublesValue').textContent = this.userData.balance.toLocaleString() + '₽';
        document.getElementById('statusBadge').textContent = `🥉 Бронза • ID: ${this.currentUser.id}`;
    }

    renderQRCard() {
        document.getElementById('statusLarge').textContent = `🥉 Бронза • @${this.currentUser.username || 'user' + this.currentUser.id}`;
        this.generateQR('loyaltyQR', `TG ID: ${this.currentUser.id}
@${this.currentUser.username || 'user' + this.currentUser.id}
${this.userData.balance} баллов
${this.userData.referralCode}`);
    }

    generateQR(canvasId, text) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        
        // Белый фон
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Градиентный фон
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#f8f9fa');
        gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient;
        ctx.fillRect(10, 10, canvas.width-20, canvas.height-20);
        
        // Текст с Telegram данными
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const lines = text.split('
');
        lines.forEach((line, i) => {
            ctx.fillText(line, canvas.width/2, 40 + i * 22);
        });
        
        // Зеленая рамка
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 4;
        ctx.strokeRect(5, 5, canvas.width-10, canvas.height-10);
    }

    // ✅ Отправка данных в бот с Telegram ID
    async sendToBot() {
        const data = {
            userId: this.currentUser.id,
            username: this.currentUser.username,
            firstName: this.currentUser.first_name,
            balance: this.userData.balance,
            referralCode: this.userData.referralCode,
            phone: this.userData.phone,
            timestamp: new Date().toISOString()
        };
        
        if (this.tg) {
            this.tg.sendData(JSON.stringify(data));
            this.tg.showAlert(`✅ Синхронизировано!
ID: ${this.currentUser.id}
Баланс: ${this.userData.balance}`);
        } else {
            console.log('Отправлено:', data);
            this.showAlert('Данные отправлены (тестовый режим)');
        }
    }

    processManualCheck() {
        const amount = parseFloat(document.getElementById('checkAmount').value);
        if (amount < 100) return this.showAlert('Сумма чека от 100₽');
        
        const bonus = Math.floor(amount * this.userData.bonusRate * 100) / 100;
        this.userData.balance += bonus;
        this.userData.history.unshift({
            type: 'add',
            amount: bonus,
            date: new Date().toLocaleDateString('ru'),
            note: `Чек ${amount.toLocaleString()}₽ (TG ID: ${this.currentUser.id})`
        });
        
        this.saveData();
        this.renderAll();
        document.getElementById('checkAmount').value = '';
        this.showAlert(`+${bonus} баллов! Общий баланс: ${this.userData.balance}`);
    }

    saveData() {
        localStorage.setItem(`loyalty_${this.currentUser.id}`, JSON.stringify(this.userData));
    }

    showAlert(msg) {
        if (this.tg) this.tg.showAlert(msg);
        else alert(msg);
    }

    hidePreloader() {
        setTimeout(() => {
            document.getElementById('preloader').style.display = 'none';
        }, 1500);
    }
}

let loyaltyApp;
document.addEventListener('DOMContentLoaded', () => {
    loyaltyApp = new LoyaltyApp();
});

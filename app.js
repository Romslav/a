class LoyaltyApp {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.currentUser = { id: 12345, first_name: 'Гость', username: '', photo_url: '' };
        
        // ✅ УРОВНИ: 100k₽ → Серебро | 500k₽ → Золото
        this.levels = {
            bronze: { name: '🥉 Бронза', rate: 0.05, minSpend: 0, maxSpend: 100000, icon: '🥉' },
            silver: { name: '🥈 Серебро', rate: 0.07, minSpend: 100000, maxSpend: 500000, icon: '🥈' },
            gold: { name: '🥇 Золото', rate: 0.10, minSpend: 500000, maxSpend: Infinity, icon: '🥇' }
        };
        
        this.userData = {};
        this.init();
    }

    async init() {
        if (this.tg) {
            this.tg.ready(); this.tg.expand();
            const userData = this.tg.initDataUnsafe?.user;
            if (userData) {
                this.currentUser = { id: userData.id, first_name: userData.first_name || 'Гость', username: userData.username || '', photo_url: userData.photo_url || '' };
            }
            this.tg.MainButton.setText('🔄 Синхронизировать').onClick(() => this.syncWithRestaurant()).show();
            if (this.tg.colorScheme === 'dark') document.body.setAttribute('data-theme', 'dark');
            this.tg.onEvent('themeChanged', () => document.body.setAttribute('data-theme', this.tg.colorScheme));
        }

        await this.loadUserData();
        this.bindEvents();
        this.renderAll();
        this.hidePreloader();
    }

    async loadUserData() {
        const key = `loyalty_${this.currentUser.id}`;
        let data = localStorage.getItem(key);
        
        if (!data) {
            this.userData = await mockApi.registerUser(this.currentUser);
        } else {
            this.userData = JSON.parse(data);
            this.userData = await mockApi.processExpiration(this.userData);
            this.checkBirthdays();
        }
        
        this.calculateLevel();
        this.saveData();
    }

    calculateLevel() {
        const totalSpend = this.userData.history?.reduce((sum, h) => h.type === 'spend' ? sum + h.checkAmount : sum, 0) || 0;
        this.userData.totalSpend = totalSpend;
        
        if (totalSpend >= 500000) this.userData.level = 'gold';
        else if (totalSpend >= 100000) this.userData.level = 'silver';
        else this.userData.level = 'bronze';
        
        this.userData.levelProgress = this.calculateLevelProgress();
    }

    calculateLevelProgress() {
        const totalSpend = this.userData.totalSpend || 0;
        const currentLevel = this.userData.level;
        const nextLevel = this.getNextLevel(currentLevel);
        
        if (nextLevel === 'gold' && currentLevel === 'gold') return 100;
        
        const currentMin = this.levels[currentLevel].minSpend;
        const nextMin = this.levels[nextLevel].minSpend;
        return Math.min(100, ((totalSpend - currentMin) / (nextMin - currentMin)) * 100);
    }

    getNextLevel(currentLevel) {
        const order = ['bronze', 'silver', 'gold'];
        const currentIndex = order.indexOf(currentLevel);
        return order[Math.min(currentIndex + 1, 2)];
    }

    nextLevelName() {
        const nextLevelKey = this.getNextLevel(this.userData.level);
        return this.levels[nextLevelKey].name;
    }

    nextLevelSpend() {
        if (this.userData.level === 'gold') return '🏆 Максимальный уровень!';
        const totalSpend = this.userData.totalSpend || 0;
        const nextLevelKey = this.getNextLevel(this.userData.level);
        const nextMin = this.levels[nextLevelKey].minSpend;
        return (nextMin - totalSpend).toLocaleString() + '₽';
    }

    getActiveBalance() {
        return this.userData.balances?.reduce((sum, b) => b.status === 'active' ? sum + b.amount : sum, 0) || 0;
    }

    getSoonBurning() {
        const today = new Date();
        const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return this.userData.balances?.reduce((sum, b) => {
            if (b.status === 'active' && new Date(b.expiresAt) <= weekLater) return sum + b.amount;
            return sum;
        }, 0) || 0;
    }

    checkBirthdays() {
        const today = new Date();
        const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        const family = [this.userData].concat(this.userData.family || []);
        
        family.forEach(member => {
            if (member.birthDate) {
                const birthDate = new Date(member.birthDate);
                const thisYearBirth = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                if (thisYearBirth >= today && thisYearBirth <= threeDaysFromNow) {
                    mockApi.addBirthdayBonus(member);
                }
            }
        });
    }

    bindEvents() {
        document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
            btn.onclick = (e) => this.handleNavClick(e.currentTarget.dataset.nav);
        });
        document.getElementById('menuBtn').onclick = () => this.tg?.showAlert?.('Меню в разработке');
        document.getElementById('notifBtn').onclick = () => this.tg?.showAlert?.('Уведомления в разработке');
    }

    handleNavClick(navId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
        const screen = document.getElementById(navId + 'Screen') || document.querySelector(`[data-nav="${navId}"]`);
        if (screen) screen.classList.add('active');
        document.querySelector(`[data-nav="${navId}"]`)?.classList.add('active');
        this.renderScreen(navId);
    }

    renderScreen(navId) {
        switch(navId) {
            case 'dashboard': this.renderDashboard(); break;
            case 'qr-card': this.renderQRCodes(); break;
            case 'family': this.renderFamily(); break;
            case 'burn': this.renderBurnList(); break;
            case 'history': this.renderHistory(); break;
        }
    }

    renderAll() {
        this.renderDashboard();
        this.renderQRCodes();
        this.renderFamily();
        this.renderBurnList();
        this.renderHistory();
        
        if (this.tg) this.tg.MainButton.setText(`🔄 Синхронизировать (${this.getActiveBalance()} баллов)`);
        
        if (this.currentUser.photo_url) {
            const img = new Image();
            img.onload = () => document.getElementById('userAvatar').style.backgroundImage = `url(${this.currentUser.photo_url})`;
            img.src = this.currentUser.photo_url;
        } else {
            document.getElementById('userAvatar').textContent = this.currentUser.first_name[0]?.toUpperCase() || '👤';
        }
    }

    renderDashboard() {
        document.getElementById('userName').textContent = this.currentUser.first_name;
        document.getElementById('userId').textContent = `TG ID: ${this.currentUser.id}`;
        document.getElementById('balanceValue').textContent = this.getActiveBalance().toLocaleString();
        document.getElementById('rublesValue').textContent = this.getActiveBalance().toLocaleString() + '₽';
        
        const level = this.levels[this.userData.level];
        document.getElementById('statusBadge').innerHTML = `${level.name} • ${Math.round(level.rate * 100)}%`;
        
        document.getElementById('levelProgressFill').style.width = this.userData.levelProgress + '%';
        document.getElementById('levelProgressLabel').textContent = `${this.nextLevelName()} • ${this.nextLevelSpend()}`;
        
        const soonBurning = this.getSoonBurning();
        document.getElementById('burnWarning').innerHTML = soonBurning > 0 ? `⚠️ ${soonBurning} баллов сгорят через 7 дней` : '';
    }

    renderQRCodes() {
        const level = this.levels[this.userData.level];
        document.getElementById('statusLarge').textContent = `${level.name} • ${Math.round(level.rate * 100)}%`;
        document.getElementById('cardTgId').textContent = this.currentUser.id;
        document.getElementById('cardPhone').textContent = this.userData.phone || 'Не указан';
        document.getElementById('qrCodeDisplay').textContent = `QR: ${this.userData.qrCode}`;
        document.getElementById('shortCodeDisplay').textContent = this.userData.shortCode;
        this.generateQR('loyaltyQR', `TG:${this.currentUser.id}
@${this.currentUser.username}
${this.userData.qrCode}`);
    }

    renderFamily() {
        const familyList = document.getElementById('familyList');
        const family = [this.userData].concat(this.userData.family || []);
        familyList.innerHTML = family.map(member => {
            const status = this.isBirthdaySoon(member.birthDate) ? '🎉 Скоро +1000!' : '⏳ Ожидание';
            return `
                <div class="family-card">
                    <div style="display: flex; align-items: center;">
                        <div class="family-avatar">${member.firstName[0]}</div>
                        <div>
                            <h4>${member.firstName}</h4>
                            <div class="family-birthday">${this.formatDate(member.birthDate)}</div>
                        </div>
                    </div>
                    <div class="family-status">${status}</div>
                </div>
            `;
        }).join('');
    }

    renderBurnList() {
        const burnList = document.getElementById('burnList');
        const activeBalances = this.userData.balances?.filter(b => b.status === 'active') || [];
        burnList.innerHTML = activeBalances.map(balance => {
            const daysLeft = this.daysUntilExpiration(balance.expiresAt);
            const daysClass = daysLeft <= 7 ? 'burn-days critical' : daysLeft <= 30 ? 'burn-days warning' : 'burn-days normal';
            return `
                <div class="burn-item">
                    <div>
                        <div class="burn-amount">+${balance.amount}</div>
                        <div class="burn-date">${balance.type === 'welcome' ? 'Приветствие' : balance.type === 'birthday' ? 'ДР' : 'Чек'}</div>
                    </div>
                    <div class="${daysClass}">${daysLeft} дней</div>
                </div>
            `;
        }).join('');
    }

    renderHistory() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = this.userData.history?.slice(0, 20).map(h => `
            <div class="burn-item">
                <div>
                    <div class="burn-amount">${h.type === 'add' ? '+' : '-'}${h.amount || h.checkAmount}</div>
                    <div class="burn-date">${h.date} • ${h.note || h.method}</div>
                </div>
                <div>${h.source || 'local'}</div>
            </div>
        `).join('') || '<div style="text-align:center;padding:40px;color:#666;">История пуста</div>';
    }

    isBirthdaySoon(dateStr) {
        if (!dateStr) return false;
        const today = new Date();
        const birthDate = new Date(dateStr);
        const thisYearBirth = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        return thisYearBirth >= today && thisYearBirth <= threeDaysFromNow;
    }

    formatDate(dateStr) {
        if (!dateStr) return 'Не указана';
        return new Date(dateStr).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
    }

    daysUntilExpiration(expireDate) {
        const today = new Date();
        const expire = new Date(expireDate);
        const diffTime = expire - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    async syncWithRestaurant() {
        this.tg?.showAlert?.('🔄 Синхронизация с рестораном...');
        const response = await mockApi.syncUser(this.currentUser.id);
        this.userData = { ...this.userData, ...response };
        this.calculateLevel();
        this.saveData();
        this.renderAll();
        this.tg?.showAlert?.(`✅ Синхронизировано!
Баланс: ${this.getActiveBalance()}
${this.levels[this.userData.level].name} • ${this.userData.totalSpend?.toLocaleString()}₽`);
    }

    generateQR(canvasId, text) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#f8f9fa'); gradient.addColorStop(1, '#e9ecef');
        ctx.fillStyle = gradient; ctx.fillRect(10, 10, canvas.width-20, canvas.height-20);
        ctx.fillStyle = '#333'; ctx.font = 'bold 16px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lines = text.split('
');
        lines.forEach((line, i) => ctx.fillText(line, canvas.width/2, 50 + i * 25));
        ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, canvas.width-10, canvas.height-10);
    }

    saveData() {
        localStorage.setItem(`loyalty_${this.currentUser.id}`, JSON.stringify(this.userData));
    }

    showScreen(screenId) {
        this.handleNavClick(screenId);
    }

    hidePreloader() {
        setTimeout(() => document.getElementById('preloader').style.display = 'none', 1500);
    }
}

let loyaltyApp;
document.addEventListener('DOMContentLoaded', () => {
    loyaltyApp = new LoyaltyApp();
});

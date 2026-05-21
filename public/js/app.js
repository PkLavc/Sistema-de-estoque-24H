// Lottie animations initialization
const lottieAnimations = {};
const lottieAnimationData = {};
const lottieConfigPaths = {
    'lottie-home': 'home.json',
    'lottie-rental': 'rental.json',
    'lottie-maintenance': 'maintenance.json',
    'lottie-database': 'database.json',
    'lottie-plus': 'plus.json',
    'lottie-historical': 'historical.json',
    'lottie-exit': 'exit.json',
    'lottie-settings': 'settings.json',
    'lottie-home-preview': 'home.json'
};

function getLottieScriptUrl() {
    const scriptEl = document.currentScript || Array.from(document.getElementsByTagName('script')).find(el => el.src && el.src.includes('app.js'));
    return scriptEl ? new URL(scriptEl.src, window.location.href) : new URL('js/app.js', window.location.href);
}

function resolveLottiePath(filename) {
    const scriptUrl = getLottieScriptUrl();
    return new URL(`../assets/lottie/${filename}`, scriptUrl).href;
}

function hexToRgbArray(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map((char) => char + char).join('');
    }
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return [r, g, b, 1];
}

function darkenHex(hex, amount = 15) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map((char) => char + char).join('');
    }
    const r = Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(0, 2), 16) * (1 - amount / 100))));
    const g = Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(2, 2), 16) * (1 - amount / 100))));
    const b = Math.max(0, Math.min(255, Math.round(parseInt(hex.substr(4, 2), 16) * (1 - amount / 100))));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function patchLottieColors(data, primaryColor, secondaryColor) {
    const primaryRgb = hexToRgbArray(primaryColor);
    const secondaryRgb = hexToRgbArray(secondaryColor);

    const clone = JSON.parse(JSON.stringify(data));

    const patchNode = (node) => {
        if (!node || typeof node !== 'object') return;

        // Check if node has a class name that indicates secondary color
        const isSecondaryShape = node.cl === 'secondary' || (node.nm && typeof node.nm === 'string' && /secondary/i.test(node.nm));
        const colorValue = isSecondaryShape ? secondaryRgb : primaryRgb;

        // Patch stroke and fill colors
        if (node.c && Array.isArray(node.c.k) && node.c.k.length >= 3) {
            node.c.k = colorValue.slice(0, node.c.k.length);
        }

        // Patch gradient colors
        if (node.g && Array.isArray(node.g.k)) {
            node.g.k = node.g.k.map((stop) => {
                if (Array.isArray(stop) && stop.length >= 4 && stop.every((item) => typeof item === 'number')) {
                    const prefix = stop.slice(0, stop.length - 4);
                    return [...prefix, ...colorValue.slice(0, 4)];
                }
                patchNode(stop);
                return stop;
            });
        }

        // Recursively patch all child nodes
        if (Array.isArray(node)) {
            node.forEach(patchNode);
        } else {
            Object.values(node).forEach(patchNode);
        }
    };

    patchNode(clone);
    return clone;
}

function createLottieAnimation(id, data, primaryColor, secondaryColor) {
    const element = document.getElementById(id);
    if (!element) return null;
    const animationData = patchLottieColors(data, primaryColor, secondaryColor);

    return lottie.loadAnimation({
        container: element,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData
    });
}

async function initializeLottieIcons() {
    const primaryColor = localStorage.getItem('theme-primary-color') || '#ff3333';
    const secondaryColor = localStorage.getItem('theme-secondary-color') || '#cc0000';

    await Promise.all(Object.entries(lottieConfigPaths).map(async ([id, filename]) => {
        const element = document.getElementById(id);
        if (!element) return;

        const path = resolveLottiePath(filename);
        try {
            const response = await fetch(path);
            const animationData = await response.json();
            lottieAnimationData[id] = animationData;
            lottieAnimations[id] = createLottieAnimation(id, animationData, primaryColor, secondaryColor);
        } catch (e) {
            console.error('Erro ao carregar animação Lottie', id, path, e);
        }

        if (!id.includes('preview')) {
            const parent = element.closest('.menu-item');
            if (parent) {
                parent.addEventListener('mouseenter', () => {
                    lottieAnimations[id]?.goToAndPlay(0);
                });
            }
        }
    }));
}

function reloadLottieAnimations(primaryColor, secondaryColor) {
    Object.entries(lottieAnimationData).forEach(([id, animationData]) => {
        const element = document.getElementById(id);
        if (!element) return;
        lottieAnimations[id]?.destroy();
        lottieAnimations[id] = createLottieAnimation(id, animationData, primaryColor, secondaryColor);
    });
}

// Theme and customization from localStorage
function applyCustomTheme() {
    const primaryColor = localStorage.getItem('theme-primary-color') || '#ff3333';
    const secondaryColor = localStorage.getItem('theme-secondary-color') || '#cc0000';
    const customLogo = localStorage.getItem('custom-logo');
    const customFavicon = localStorage.getItem('custom-favicon');

    // Apply colors
    document.documentElement.style.setProperty('--primary', primaryColor);
    document.documentElement.style.setProperty('--primary-2', secondaryColor);
    document.documentElement.style.setProperty('--primary-3', darkenHex(secondaryColor, 18));
    document.documentElement.style.setProperty('--component-bg', 'transparent');

    // Apply custom logo if exists
    if (customLogo) {
        const logoImg = document.getElementById('customLogo');
        if (logoImg) {
            logoImg.src = customLogo;
        }
    }

    // Apply custom favicon if exists, otherwise use default
    if (customFavicon) {
        updateFavicon(customFavicon);
    } else {
        // Ensure default favicon is loaded if no custom one exists
        updateFavicon('assets/images/favicon.webp');
    }

    // Update Lottie animation colors dynamically
    reloadLottieAnimations(primaryColor, secondaryColor);
}

const EQUIPMENT_CATEGORIES = [
    'Tripe',
    'Caixa de som',
    'Mesa de som',
    'Antenas MGA',
    'Microfones',
    'Perifericos som',
    'Tripe de camera',
    'Camera',
    'Mesa de corte',
    'Link sem fio',
    'Conversor',
    'Radios',
    'Ilhas de video',
    'Placas de video',
    'Placas de audio',
    'Spliter',
    'Passador de slide',
    'Extender',
    'Emenda hdmi',
    'Notbook',
    'Projetor',
    'WI-FI 5g',
    'Switch',
    'Elsys',
    'Extender fibra/rede',
    'Starlink',
    'Outros',
    'Monitor',
    'TV',
    'Totem led',
    'Ribalta',
    'Wash',
    'Bean/moving',
    'Coby',
    'Parled',
    'Brut',
    'Strobe',
    'Maquina de fumaca',
    'Spliter luz',
    'Mesa de luz',
    'Ribalta fina',
    'Lazer',
    'Drone',
    'Propower',
    'Powerbank',
    'Pentacustica',
    'Gerador',
    'Transformador',
    'Nobreak',
    'Inversor',
    'Mouse'
];

let allEvents = [];
let allRentalEvents = [];
let allHistoryEvents = [];
let allHistoryRentals = [];
let rentalReturnAlerts = [];
let allEquipments = [];
let allCables = [];
let allOtherItems = [];
let maintenanceEquipments = [];
let maintenanceCables = [];
let selectedMaintenanceItem = null;
let selectedMaintenanceType = 'equipamento';
let maintenanceModalMode = null;
let activeBancoTab = 'equipamentos';
let activeCadastroTab = 'equipamentos';
let activeMaintenanceTab = 'equipamentos';
let currentUser = null;
let loginUsers = [];
let canChangeUserPasswords = false;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsString(value) {
    return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function populateCategoryOptions() {
    const list = document.getElementById('equipmentCategoryList');
    const input = document.getElementById('equipmentCategory');
    if (!list || !input) return;

    list.innerHTML = '';
    EQUIPMENT_CATEGORIES.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        list.appendChild(option);
    });

    if (!input.value) {
        input.value = EQUIPMENT_CATEGORIES[0];
    }
}

function getCableCategories(cables = allCables) {
    return [...new Set(
        (cables || [])
            .map((cable) => String(cable.category || 'Outros').trim() || 'Outros')
            .filter((category) => category && category !== 'Outros')
    )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function populateCableCategoryOptions(cables = allCables) {
    const list = document.getElementById('cableCategoryList');
    const input = document.getElementById('cableCategory');
    if (!list || !input) return;

    const categories = getCableCategories(cables);
    list.innerHTML = '';

    categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        list.appendChild(option);
    });

    if (!input.value) {
        input.value = categories[0] || 'Outros';
    }
}

function showSection(sectionId) {
    if (sectionId === 'usuarios' && !currentUser?.isAdmin) {
        sectionId = 'home';
    }

    if (sectionId !== 'banco') {
        clearRelacaoContext();
    }

    document.querySelectorAll('.section').forEach((section) => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add('active');

    document.querySelectorAll('.menu-item').forEach((item) => {
        item.classList.remove('active');
        const onclick = item.getAttribute('onclick') || '';
        if (onclick.includes(sectionId)) {
            item.classList.add('active');
        }
    });

    if (sectionId === 'home') {
        loadEvents();
        loadRentalReturnAlerts();
    }
    if (sectionId === 'cadastro') setCadastroTab(activeCadastroTab);
    if (sectionId === 'banco') setBancoTab(activeBancoTab);
    if (sectionId === 'historico') loadHistoryEvents();
    if (sectionId === 'usuarios') loadLoginUsers();
    if (sectionId === 'manutencao') setMaintenanceTab(activeMaintenanceTab);
    if (sectionId === 'locacao') {
        loadRentalEvents();
        loadRentalReturnAlerts();
    }
    if (!['home', 'locacao'].includes(sectionId)) loadRentalReturnAlerts();
}

function clearRelacaoContext() {
    localStorage.removeItem('relacao_event_id');
    localStorage.removeItem('relacao_event_name');
}

function clearPendingItems() {
    Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('pending_items_') || key.startsWith('pending_other_items_')) {
            localStorage.removeItem(key);
        }
    });
}

function getEventSearchValue() {
    return (document.getElementById('searchEventInput')?.value || '').trim();
}

function getEquipmentSearchValue() {
    return (document.getElementById('searchInput')?.value || '').trim();
}

function searchDatabase() {
    if (activeBancoTab === 'cabos') {
        loadCables(getEquipmentSearchValue());
        return;
    }

    if (activeBancoTab === 'outros') {
        loadOtherItems(getEquipmentSearchValue());
        return;
    }

    loadEquipments(getEquipmentSearchValue());
}

function searchEvents() {
    renderEvents(allEvents, getEventSearchValue());
}

function getRentalSearchValue() {
    return (document.getElementById('searchRentalInput')?.value || '').trim();
}

function searchRentalEvents() {
    renderRentalEvents(allRentalEvents, getRentalSearchValue());
}

function getHistorySearchValue() {
    return (document.getElementById('searchHistoryInput')?.value || '').trim();
}

function searchHistoryEvents() {
    renderHistoryEvents(allHistoryEvents, allHistoryRentals, getHistorySearchValue());
}

function getLocalDateString(date = new Date()) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
}

function getDismissedRentalAlertKey(today = getLocalDateString()) {
    return `dismissed_rental_return_alerts_${today}`;
}

function getDismissedRentalAlertIds(today = getLocalDateString()) {
    try {
        const parsed = JSON.parse(localStorage.getItem(getDismissedRentalAlertKey(today)) || '[]');
        return Array.isArray(parsed)
            ? parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id))
            : [];
    } catch {
        return [];
    }
}

function setDismissedRentalAlertIds(ids, today = getLocalDateString()) {
    const cleanIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
    localStorage.setItem(getDismissedRentalAlertKey(today), JSON.stringify(cleanIds));
}

function setRentalMenuAlertState(hasAlerts) {
    document.getElementById('rentalMenuItem')?.classList.toggle('rental-return-pulse', hasAlerts);
}

function getRentalAlertItemText(item) {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const prefix = quantity > 1 ? `${quantity}x ` : '';
    const barcode = item.barcode ? ` (${item.barcode})` : '';
    const typeLabel = item.type === 'cable'
        ? 'Cabo'
        : (item.type === 'other' ? 'Item' : 'Equipamento');
    return `${typeLabel}: ${prefix}${item.name || 'Sem nome'}${barcode}`;
}

function renderRentalReturnAlert() {
    const container = document.getElementById('rentalReturnAlert');
    const hasAlerts = rentalReturnAlerts.length > 0;
    setRentalMenuAlertState(hasAlerts);
    if (!container) return;

    const today = getLocalDateString();
    const dismissedIds = new Set(getDismissedRentalAlertIds(today));
    const visibleAlerts = rentalReturnAlerts.filter((event) => !dismissedIds.has(Number(event.id)));

    if (visibleAlerts.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const alertList = visibleAlerts.map((event) => {
        const pendingItems = Array.isArray(event.pendingItems) ? event.pendingItems : [];
        const pendingHtml = pendingItems.length > 0
            ? pendingItems.map((item) => `<li>${escapeHtml(getRentalAlertItemText(item))}</li>`).join('')
            : '<li>Itens com saida pendente nesta locação.</li>';

        return `
            <div class="rental-alert-event">
                <div class="rental-alert-event-title">
                    <span>${escapeHtml(event.name)}</span>
                    <span>Devolucao: ${escapeHtml(formatDate(event.return_date))}</span>
                </div>
                <ul class="rental-alert-items">${pendingHtml}</ul>
                <button type="button" class="btn-primary btn-small" onclick="showSection('locacao')">Gerenciar</button>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="rental-return-alert-header">
            <div>
                <h2>Data de devolucao de locação chegou</h2>
                <p>Existem equipamentos ou itens com saida pendente em locação vencida ou vencendo hoje.</p>
            </div>
            <button type="button" class="btn-secondary rental-alert-close" onclick="closeRentalReturnAlert()">Fechar</button>
        </div>
        <div class="rental-alert-list">${alertList}</div>
    `;
    container.style.display = 'block';
}

function closeRentalReturnAlert() {
    const today = getLocalDateString();
    const dismissedIds = getDismissedRentalAlertIds(today);
    setDismissedRentalAlertIds([
        ...dismissedIds,
        ...rentalReturnAlerts.map((event) => Number(event.id))
    ], today);
    renderRentalReturnAlert();
}

async function loadRentalReturnAlerts() {
    try {
        const today = getLocalDateString();
        const response = await fetch(`api/rental-return-alerts?today=${encodeURIComponent(today)}`, {
            credentials: 'include'
        });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }
        if (!response.ok) return;

        rentalReturnAlerts = await response.json();
        renderRentalReturnAlert();
    } catch (error) {
        console.error(error);
    }
}

function searchEquipments() {
    searchDatabase();
}

function setCadastroTab(tab) {
    activeCadastroTab = ['cabos', 'outros'].includes(tab) ? tab : 'equipamentos';

    const title = document.getElementById('cadastroTitle');
    const equipmentButton = document.getElementById('cadastroEquipamentosTabButton');
    const cableButton = document.getElementById('cadastroCabosTabButton');
    const otherButton = document.getElementById('cadastroOutrosTabButton');
    const equipmentView = document.getElementById('cadastroEquipamentosView');
    const cableView = document.getElementById('cadastroCabosView');
    const otherView = document.getElementById('cadastroOutrosView');

    if (title) {
        title.textContent = activeCadastroTab === 'cabos'
            ? 'Cadastro de Cabos'
            : (activeCadastroTab === 'outros' ? 'Cadastro de Outros Itens' : 'Cadastro de Equipamento');
    }

    if (equipmentButton) equipmentButton.classList.toggle('active', activeCadastroTab === 'equipamentos');
    if (cableButton) cableButton.classList.toggle('active', activeCadastroTab === 'cabos');
    if (otherButton) otherButton.classList.toggle('active', activeCadastroTab === 'outros');
    if (equipmentView) equipmentView.classList.toggle('active', activeCadastroTab === 'equipamentos');
    if (cableView) cableView.classList.toggle('active', activeCadastroTab === 'cabos');
    if (otherView) otherView.classList.toggle('active', activeCadastroTab === 'outros');
}

function setBancoTab(tab) {
    activeBancoTab = ['cabos', 'outros'].includes(tab) ? tab : 'equipamentos';

    const title = document.getElementById('databaseTitle');
    const searchInput = document.getElementById('searchInput');
    const equipmentButton = document.getElementById('equipamentosTabButton');
    const cableButton = document.getElementById('cabosTabButton');
    const otherButton = document.getElementById('outrosTabButton');
    const equipmentView = document.getElementById('equipamentosDatabaseView');
    const cableView = document.getElementById('cabosDatabaseView');
    const otherView = document.getElementById('outrosDatabaseView');

    if (title) {
        title.textContent = activeBancoTab === 'cabos'
            ? 'Banco de Dados de Cabos'
            : (activeBancoTab === 'outros' ? 'Banco de Dados de Outros Itens' : 'Banco de Dados de Equipamentos');
    }

    if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = activeBancoTab === 'cabos'
            ? 'Buscar cabo...'
            : (activeBancoTab === 'outros' ? 'Buscar item...' : 'Buscar equipamento...');
    }

    if (equipmentButton) equipmentButton.classList.toggle('active', activeBancoTab === 'equipamentos');
    if (cableButton) cableButton.classList.toggle('active', activeBancoTab === 'cabos');
    if (otherButton) otherButton.classList.toggle('active', activeBancoTab === 'outros');
    if (equipmentView) equipmentView.classList.toggle('active', activeBancoTab === 'equipamentos');
    if (cableView) cableView.classList.toggle('active', activeBancoTab === 'cabos');
    if (otherView) otherView.classList.toggle('active', activeBancoTab === 'outros');

    if (activeBancoTab === 'cabos') {
        loadCables();
        return;
    }

    if (activeBancoTab === 'outros') {
        loadOtherItems();
        return;
    }

    loadEquipments();
}

function setMaintenanceTab(tab) {
    activeMaintenanceTab = tab === 'cabos' ? 'cabos' : 'equipamentos';

    const equipmentButton = document.getElementById('maintenanceEquipamentosTabButton');
    const cableButton = document.getElementById('maintenanceCabosTabButton');
    const equipmentView = document.getElementById('maintenanceEquipamentosView');
    const cableView = document.getElementById('maintenanceCabosView');

    if (equipmentButton) equipmentButton.classList.toggle('active', activeMaintenanceTab === 'equipamentos');
    if (cableButton) cableButton.classList.toggle('active', activeMaintenanceTab === 'cabos');
    if (equipmentView) equipmentView.classList.toggle('active', activeMaintenanceTab === 'equipamentos');
    if (cableView) cableView.classList.toggle('active', activeMaintenanceTab === 'cabos');

    clearMaintenance();

    if (activeMaintenanceTab === 'cabos') {
        loadMaintenanceCables();
        return;
    }

    loadMaintenanceEquipments();
}

function cancelEquipmentForm() {
    document.getElementById('equipmentForm')?.reset();
    populateCategoryOptions();
    showSection('home');
}

function cancelEventForm() {
    document.getElementById('eventForm')?.reset();
    showSection('home');
}

function openRentalModal() {
    const modal = document.getElementById('rentalModal');
    if (modal) modal.style.display = 'flex';
}

function closeRentalModal() {
    document.getElementById('rentalForm')?.reset();
    const modal = document.getElementById('rentalModal');
    if (modal) modal.style.display = 'none';
}

function cancelCableForm() {
    document.getElementById('cableForm')?.reset();
    const quantityInput = document.getElementById('cableQuantity');
    if (quantityInput) quantityInput.value = '';
    populateCableCategoryOptions();
    setCadastroTab('cabos');
}

function cancelOtherItemForm() {
    document.getElementById('otherItemForm')?.reset();
    const quantityInput = document.getElementById('otherItemQuantity');
    if (quantityInput) quantityInput.value = '';
    setCadastroTab('outros');
}

function renderEvents(events, search = '') {
    const grid = document.getElementById('eventsGrid');
    if (!grid) return;

    const normalizedSearch = search.toLowerCase();
    const filtered = events.filter((event) => {
        if (!normalizedSearch) return true;
        return (
            String(event.name || '').toLowerCase().includes(normalizedSearch) ||
            String(formatDate(event.date)).toLowerCase().includes(normalizedSearch)
        );
    });

    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = '<p class="empty-state">Nenhum evento encontrado.</p>';
        return;
    }

    filtered.forEach((event) => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="card-top">
                <h3>${escapeHtml(event.name)}</h3>
                <div class="event-meta">
                    ${event.created_by_username ? `<span class="event-created-by">${escapeHtml(event.created_by_username)}</span>` : ''}
                    <span class="card-date">${escapeHtml(formatDate(event.date))}</span>
                </div>
            </div>
            <div class="event-actions">
                <button onclick="showSection('eventos')" class="btn-primary">Gerenciar</button>
                <button onclick="deleteEvent(${event.id})" class="btn-danger">Excluir</button>
            </div>`;
        grid.appendChild(card);
    });
}

async function loadEvents() {
    try {
        const response = await fetch('api/events', { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }

        allEvents = await response.json();
        renderEvents(allEvents, getEventSearchValue());
    } catch (error) {
        console.error(error);
    }
}

function renderRentalEvents(events, search = '') {
    const grid = document.getElementById('rentalEventsGrid');
    if (!grid) return;

    const normalizedSearch = search.toLowerCase();
    const filtered = events.filter((event) => {
        if (!normalizedSearch) return true;
        return (
            String(event.name || '').toLowerCase().includes(normalizedSearch) ||
            String(formatDate(event.withdrawal_date)).toLowerCase().includes(normalizedSearch) ||
            String(formatDate(event.return_date)).toLowerCase().includes(normalizedSearch)
        );
    });

    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.innerHTML = '<p class="empty-state">Nenhuma locação encontrada.</p>';
        return;
    }

    filtered.forEach((event) => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="card-top">
                <h3>${escapeHtml(event.name)}</h3>
                <div class="event-meta">
                    ${event.created_by_username ? `<span class="event-created-by">${escapeHtml(event.created_by_username)}</span>` : ''}
                    <span class="card-date">Retirada: ${escapeHtml(formatDate(event.withdrawal_date))}</span>
                    <span class="card-date">Devolucao: ${escapeHtml(formatDate(event.return_date))}</span>
                </div>
            </div>
            <div class="event-actions">
                <button onclick="showSection('locacao')" class="btn-primary">Gerenciar</button>
                <button onclick="deleteRentalEvent(${event.id}, '${escapeJsString(event.name)}')" class="btn-danger">Excluir</button>
            </div>`;
        grid.appendChild(card);
    });
}

async function loadRentalEvents() {
    try {
        const response = await fetch('api/rental-events', { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }

        allRentalEvents = await response.json();
        renderRentalEvents(allRentalEvents, getRentalSearchValue());
    } catch (error) {
        console.error(error);
    }
}

function historyMatchesSearch(event, search, isRental) {
    if (!search) return true;
    const normalizedSearch = search.toLowerCase();
    const fields = isRental
        ? [event.name, formatDate(event.withdrawal_date), formatDate(event.return_date), event.created_by_username]
        : [event.name, formatDate(event.date), event.created_by_username];
    return fields.some((field) => String(field || '').toLowerCase().includes(normalizedSearch));
}

function getHistoryCardHtml(event, isRental) {
    const dateHtml = isRental
        ? `
            <span class="card-date">Retirada: ${escapeHtml(formatDate(event.withdrawal_date))}</span>
            <span class="card-date">Devolucao: ${escapeHtml(formatDate(event.return_date))}</span>
        `
        : `<span class="card-date">${escapeHtml(formatDate(event.date))}</span>`;

    return `
        <div class="card-top">
            <h3>${escapeHtml(event.name)}</h3>
            <div class="event-meta">
                <span class="history-badge">Finalizado</span>
                ${event.created_by_username ? `<span class="event-created-by">${escapeHtml(event.created_by_username)}</span>` : ''}
                ${dateHtml}
            </div>
        </div>
        <div class="event-actions">
            <button onclick="showSection('historico')" class="btn-primary">Gerenciar</button>
        </div>`;
}

function renderHistoryGrid(gridId, countId, events, emptyMessage, isRental) {
    const grid = document.getElementById(gridId);
    const count = document.getElementById(countId);
    if (!grid) return;

    if (count) {
        const label = isRental
            ? (events.length === 1 ? 'locação' : 'locações')
            : (events.length === 1 ? 'evento' : 'eventos');
        count.textContent = `${events.length} ${label}`;
    }

    grid.innerHTML = '';
    if (events.length === 0) {
        grid.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
        return;
    }

    events.forEach((event) => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = getHistoryCardHtml(event, isRental);
        grid.appendChild(card);
    });
}

function renderHistoryEvents(events = allHistoryEvents, rentals = allHistoryRentals, search = '') {
    const filteredEvents = events.filter((event) => historyMatchesSearch(event, search, false));
    const filteredRentals = rentals.filter((event) => historyMatchesSearch(event, search, true));

    renderHistoryGrid('historyEventsGrid', 'historyEventsCount', filteredEvents, 'Nenhum evento finalizado encontrado.', false);
    renderHistoryGrid('historyRentalsGrid', 'historyRentalsCount', filteredRentals, 'Nenhuma locação finalizada encontrada.', true);
}

async function loadHistoryEvents() {
    try {
        const response = await fetch('api/history-events', { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }
        if (!response.ok) return;

        const data = await response.json();
        allHistoryEvents = Array.isArray(data.events) ? data.events : [];
        allHistoryRentals = Array.isArray(data.rentals) ? data.rentals : [];
        renderHistoryEvents(allHistoryEvents, allHistoryRentals, getHistorySearchValue());
    } catch (error) {
        console.error(error);
    }
}

function renderEquipments(equipments) {
    const tbody = document.querySelector('#equipmentsTable tbody');
    const theadRow = document.querySelector('#equipmentsTable thead tr');
    if (!tbody || !theadRow) return;

    const relacaoEventId = localStorage.getItem('relacao_event_id');
    const actionHeader = theadRow.querySelector('th:last-child');
    if (actionHeader) {
        actionHeader.textContent = '';
    }

    tbody.innerHTML = '';

    if (equipments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum equipamento encontrado.</td></tr>';
        return;
    }

    const groupedEquipments = new Map();

    equipments.forEach((eq) => {
        const category = eq.category || 'Outros';
        if (!groupedEquipments.has(category)) {
            groupedEquipments.set(category, []);
        }
        groupedEquipments.get(category).push(eq);
    });

    Array.from(groupedEquipments.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
        .forEach(([category, items]) => {
            const categoryRow = document.createElement('tr');
            categoryRow.className = 'category-row';
            categoryRow.innerHTML = '<td colspan="5">' + escapeHtml(category) + '</td>';
            tbody.appendChild(categoryRow);

            items
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
                .forEach((eq) => {
                    const row = document.createElement('tr');
                    const statusRaw = String(eq.current_status || '').toLowerCase();
                    const isDisponivel = !statusRaw || statusRaw === 'disponÃ­vel' || statusRaw === 'disponivel';
                    const isPreSeparado = statusRaw === 'pre separado';
                    const isRelacao = statusRaw === 'relaÃ§Ã£o' || statusRaw === 'relacao';
                    const isManutencao = statusRaw.includes('manut');
                    const statusText = isPreSeparado ? 'Pre separado' : (isRelacao ? 'RelaÃ§Ã£o' : (isManutencao ? 'Em Manutencao' : (isDisponivel ? 'Disponivel' : 'Indisponivel')));
                    const statusClass = (isPreSeparado || isRelacao) ? 'badge-relation' : (isManutencao ? 'badge-maintenance' : (isDisponivel ? 'badge-available' : 'badge-unavailable'));
                    const warningButton = isManutencao && eq.maintenance_description
                        ? `<button type="button" class="warning-button" onclick="openMaintenanceDetails(${eq.id})" title="Ver problema">⚠️</button>`
                        : '';

                    const actionButtons = [];
                    if (relacaoEventId) {
                        actionButtons.push(`<button onclick="adicionarARelacao(${eq.id}, '${escapeJsString(eq.name)}', '${escapeJsString(eq.barcode)}')" class="btn-primary btn-small">Adicionar</button>`);
                    }
                    if (!relacaoEventId) {
                        actionButtons.push(`<button onclick="deleteEquipment(${eq.id}, '${escapeJsString(eq.name)}')" class="btn-danger btn-delete-mini">Excluir</button>`);
                    }

                    row.innerHTML = `
                        <td>${escapeHtml(eq.name)}${warningButton}</td>
                        <td>${escapeHtml(eq.barcode)}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${escapeHtml(eq.current_event_name || '-')}</td>
                        <td>${actionButtons.join(' ')}</td>`;
                    tbody.appendChild(row);
                });
        });
}

async function loadEquipments(search = '') {
    try {
        const response = await fetch(`api/equipments?search=${encodeURIComponent(search)}`, { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }

        allEquipments = await response.json();
        renderEquipments(allEquipments);
    } catch (error) {
        console.error(error);
    }
}

function renderMaintenanceList(equipments) {
    const list = document.getElementById('maintenanceList');
    const count = document.getElementById('maintenanceCount');
    if (!list || !count) return;

    count.textContent = `${equipments.length} ${equipments.length === 1 ? 'item' : 'itens'}`;
    list.innerHTML = '';

    if (equipments.length === 0) {
        list.innerHTML = '<p class="empty-state">Nenhum equipamento em manutencao.</p>';
        return;
    }

    equipments
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
        .forEach((equipment) => {
            const item = document.createElement('div');
            item.className = 'maintenance-item';
            item.innerHTML = `
                <div class="maintenance-item-info">
                    <h3>${escapeHtml(equipment.name)}</h3>
                    <p class="maintenance-meta">Codigo: ${escapeHtml(equipment.barcode)} | Categoria: ${escapeHtml(equipment.category || 'Outros')}</p>
                    <p class="maintenance-problem"><strong>Problema:</strong> ${escapeHtml(equipment.maintenance_description || 'Sem descricao.')}</p>
                </div>
                <button type="button" class="btn-ready" onclick="markMaintenanceReady(${equipment.id})">Pronto</button>
            `;
            list.appendChild(item);
        });
}

async function loadMaintenanceEquipments() {
    try {
        const response = await fetch('api/equipments', { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }

        const equipments = await response.json();
        maintenanceEquipments = equipments.filter((equipment) =>
            String(equipment.current_status || '').toLowerCase().includes('manut')
        );
        renderMaintenanceList(maintenanceEquipments);
    } catch (error) {
        console.error(error);
    }
}

async function adicionarARelacao(id, name, barcode) {
    const eventId = localStorage.getItem('relacao_event_id');
    if (!eventId) return;

    try {
        const pendingKey = `pending_items_${eventId}`;
        const pendingItems = JSON.parse(localStorage.getItem(pendingKey) || '[]');
        const alreadyAdded = pendingItems.some((item) => Number(item.id) === Number(id));

        if (!alreadyAdded) {
            pendingItems.push({
                id: Number(id),
                name,
                barcode
            });
            localStorage.setItem(pendingKey, JSON.stringify(pendingItems));

            await fetch(`api/equipments/${Number(id)}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Pre separado' }),
                credentials: 'include'
            });
        }

        await loadEquipments(getEquipmentSearchValue());
        alert(`${name} adicionado ao evento.`);
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

async function deleteEvent(id) {
    if (!confirm('Deseja excluir este evento?')) return;

    try {
        const pendingKey = `pending_items_${id}`;
        const pendingOtherKey = `pending_other_items_${id}`;
        const pendingItems = JSON.parse(localStorage.getItem(pendingKey) || '[]');

        if (pendingItems.length > 0) {
            await Promise.allSettled(
                pendingItems.map((item) =>
                    fetch(`api/equipments/${Number(item.id)}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'Disponivel' }),
                        credentials: 'include'
                    })
                )
            );
        }

        const response = await fetch(`api/events/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            alert('Nao foi possivel excluir o evento.');
            return;
        }

        localStorage.removeItem(pendingKey);
        localStorage.removeItem(pendingOtherKey);
        clearRelacaoContext();
        await loadEvents();
        await loadEquipments(getEquipmentSearchValue());
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

function renderCables(cables) {
    const tbody = document.querySelector('#cablesTable tbody');
    if (!tbody) return;
    const relacaoEventId = localStorage.getItem('relacao_event_id');
    const theadRow = document.querySelector('#cablesTable thead tr');
    const actionHeader = theadRow?.querySelector('th:last-child');

    if (actionHeader) {
        actionHeader.textContent = '';
    }

    tbody.innerHTML = '';

    if (cables.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhum cabo encontrado.</td></tr>';
        return;
    }

    const groupedCables = new Map();
    cables.forEach((cable) => {
        const category = cable.category || 'Outros';
        if (!groupedCables.has(category)) {
            groupedCables.set(category, []);
        }
        groupedCables.get(category).push(cable);
    });

    Array.from(groupedCables.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
        .forEach(([category, items]) => {
            if (category !== 'Outros') {
                const categoryRow = document.createElement('tr');
                categoryRow.className = 'category-row';
                categoryRow.innerHTML = `<td colspan="4">${escapeHtml(category)}</td>`;
                tbody.appendChild(categoryRow);
            }

            items
                .slice()
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
                .forEach((cable) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${escapeHtml(cable.name)}</td>
                        <td class="cable-quantity-cell cable-quantity-column">${escapeHtml(cable.quantity)}</td>
                        <td class="cable-quantity-cell cable-quantity-column cable-available-quantity-cell" style="color: #2ecc71;">${escapeHtml(cable.available_quantity)}</td>
                        <td>${relacaoEventId ? '' : `<button type="button" class="btn-danger btn-delete-mini" onclick="deleteCable(${cable.id}, '${escapeJsString(cable.name)}')">Excluir</button>`}</td>
                    `;
                    tbody.appendChild(row);
                });
        });
}

function requestDeletePassword() {
    const password = prompt('Digite a senha para excluir:');
    if (password === null) return null;
    return String(password).trim();
}

async function deleteRentalEvent(id, name) {
    if (!confirm('Deseja excluir esta locação?')) return;

    const password = requestDeletePassword();
    if (password === null) return;

    try {
        const response = await fetch(`api/rental-events/${Number(id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            alert(error.message || 'Nao foi possivel excluir a locação.');
            return;
        }

        await loadRentalEvents();
        await loadRentalReturnAlerts();
        alert(`${name} excluido com sucesso.`);
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

async function deleteEquipment(id, name) {
    const password = requestDeletePassword();
    if (password === null) return;

    try {
        const response = await fetch(`api/equipments/${Number(id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            alert(error.message || 'Nao foi possivel excluir o equipamento.');
            return;
        }

        await Promise.all([loadEquipments(getEquipmentSearchValue()), loadMaintenanceEquipments()]);
        alert(`${name} excluido com sucesso.`);
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

async function deleteCable(id, name) {
    const password = requestDeletePassword();
    if (password === null) return;

    try {
        const response = await fetch(`api/cables/${Number(id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            alert(error.message || 'Nao foi possivel excluir o cabo.');
            return;
        }

        await Promise.all([loadCables(getEquipmentSearchValue()), loadMaintenanceCables()]);
        alert(`${name} excluido com sucesso.`);
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

async function deleteOtherItem(id, name) {
    const password = requestDeletePassword();
    if (password === null) return;

    try {
        const response = await fetch(`api/other-items/${Number(id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            alert(error.message || 'Nao foi possivel excluir o item.');
            return;
        }

        await loadOtherItems(getEquipmentSearchValue());
        alert(`${name} excluido com sucesso.`);
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

function renderCableMaintenanceList(cables) {
    const list = document.getElementById('maintenanceCableList');
    const count = document.getElementById('maintenanceCableCount');
    if (!list || !count) return;

    count.textContent = `${cables.length} ${cables.length === 1 ? 'item' : 'itens'}`;
    list.innerHTML = '';

    if (cables.length === 0) {
        list.innerHTML = '<p class="empty-state">Nenhum cabo em manutencao.</p>';
        return;
    }

    cables
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
        .forEach((cable) => {
            const item = document.createElement('div');
            item.className = 'maintenance-item';
            item.innerHTML = `
                <div class="maintenance-item-info">
                    <h3>${escapeHtml(cable.name)}</h3>
                    <p class="maintenance-meta">Quantidade: ${escapeHtml(cable.quantity)} | Atualizado em: ${escapeHtml(formatDateTime(cable.updated_at || cable.created_at))}</p>
                    <p class="maintenance-problem"><strong>Problema:</strong> ${escapeHtml(cable.maintenance_description || 'Sem descricao.')}</p>
                </div>
                <button type="button" class="btn-ready" onclick="markCableMaintenanceReady(${cable.id})">Pronto</button>
            `;
            list.appendChild(item);
        });
}

async function loadCables(search = '') {
    try {
        const response = await fetch(`api/cables?search=${encodeURIComponent(search)}`, { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }

        allCables = await response.json();
        populateCableCategoryOptions(allCables);
        renderCables(allCables);
    } catch (error) {
        console.error(error);
    }
}

function renderOtherItems(items) {
    const tbody = document.querySelector('#otherItemsTable tbody');
    if (!tbody) return;
    const relacaoEventId = localStorage.getItem('relacao_event_id');
    const theadRow = document.querySelector('#otherItemsTable thead tr');
    const actionHeader = theadRow?.querySelector('th:last-child');

    if (actionHeader) {
        actionHeader.textContent = '';
    }

    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhum item encontrado.</td></tr>';
        return;
    }

    items
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
        .forEach((item) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(item.name)}</td>
                <td class="cable-quantity-cell cable-quantity-column">${escapeHtml(item.quantity)}</td>
                <td class="cable-quantity-cell cable-quantity-column cable-available-quantity-cell" style="color: #2ecc71;">${escapeHtml(item.available_quantity)}</td>
                <td>${relacaoEventId
                    ? `<button type="button" class="btn-primary btn-small" onclick="adicionarOutroARelacao(${item.id}, '${escapeJsString(item.name)}', ${Number(item.available_quantity) || 0})">Adicionar</button>`
                    : `<button type="button" class="btn-danger btn-delete-mini" onclick="deleteOtherItem(${item.id}, '${escapeJsString(item.name)}')">Excluir</button>`}</td>
            `;
            tbody.appendChild(row);
        });
}

function adicionarOutroARelacao(id, name, availableQuantity) {
    const eventId = localStorage.getItem('relacao_event_id');
    if (!eventId) return;

    const maxQuantity = Number(availableQuantity) || 0;
    if (maxQuantity <= 0) {
        alert('Este item nao possui quantidade disponivel.');
        return;
    }

    const input = prompt(`Quantidade de ${name}:`, '1');
    if (input === null) return;

    const quantity = Number(input);
    if (!Number.isInteger(quantity) || quantity <= 0) {
        alert('Quantidade invalida.');
        return;
    }

    if (quantity > maxQuantity) {
        alert('Quantidade maior que a disponivel.');
        return;
    }

    const pendingKey = `pending_other_items_${eventId}`;
    const pendingItems = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    const existing = pendingItems.find((item) => Number(item.id) === Number(id));

    if (existing) {
        existing.quantity = quantity;
    } else {
        pendingItems.push({ id: Number(id), name, quantity });
    }

    localStorage.setItem(pendingKey, JSON.stringify(pendingItems));
    alert(`${name} adicionado ao evento.`);
}

async function loadOtherItems(search = '') {
    try {
        const response = await fetch(`api/other-items?search=${encodeURIComponent(search)}`, { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }

        allOtherItems = await response.json();
        renderOtherItems(allOtherItems);
    } catch (error) {
        console.error(error);
    }
}

async function loadMaintenanceCables() {
    try {
        const response = await fetch('api/cables', { credentials: 'include' });
        if (response.status === 401) {
            window.location.href = 'login/';
            return;
        }

        const cables = await response.json();
        maintenanceCables = cables.filter((cable) => !!cable.maintenance_description);
        renderCableMaintenanceList(maintenanceCables);
    } catch (error) {
        console.error(error);
    }
}

async function logout() {
    const isGuestMode = localStorage.getItem('isGuestMode') === 'true';
    
    if (isGuestMode) {
        // Guest mode - just clear localStorage and redirect
        if (confirm('Tem certeza que deseja sair? Todos os dados locais serão mantidos.')) {
            localStorage.removeItem('isGuestMode');
            window.location.href = 'login/';
        }
        return;
    }
    
    // Server logout for authenticated users
    try {
        const response = await fetch('api/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            alert('Nao foi possivel encerrar a sessao.');
            return;
        }

        clearPendingItems();
        clearRelacaoContext();
        window.location.href = 'login/';
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

document.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isEquip = e.target.id === 'equipmentForm';
    const isEvent = e.target.id === 'eventForm';
    const isCable = e.target.id === 'cableForm';
    const isOtherItem = e.target.id === 'otherItemForm';
    const isRental = e.target.id === 'rentalForm';
    if (!isEquip && !isEvent && !isCable && !isOtherItem && !isRental) return;

    const data = isEquip
        ? {
            name: document.getElementById('equipmentName').value.trim(),
            barcode: document.getElementById('equipmentBarcode').value.trim(),
            category: document.getElementById('equipmentCategory').value
        }
        : isCable
        ? {
            name: document.getElementById('cableName').value.trim(),
            quantity: Number(document.getElementById('cableQuantity').value),
            category: document.getElementById('cableCategory').value.trim()
        }
        : isOtherItem
        ? {
            name: document.getElementById('otherItemName').value.trim(),
            quantity: Number(document.getElementById('otherItemQuantity').value)
        }
        : isRental
        ? {
            name: document.getElementById('rentalEventName').value.trim(),
            withdrawalDate: document.getElementById('rentalWithdrawalDate').value,
            returnDate: document.getElementById('rentalReturnDate').value
        }
        : {
            name: document.getElementById('eventName').value.trim(),
            date: document.getElementById('eventDate').value
        };

    if (isRental && data.returnDate < data.withdrawalDate) {
        alert('A data de devolucao nao pode ser anterior a data de retirada.');
        return;
    }

    try {
        const res = await fetch(
            isEquip ? 'api/equipments' : (isCable ? 'api/cables' : (isOtherItem ? 'api/other-items' : (isRental ? 'api/rental-events' : 'api/events'))),
            {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            alert(error.error || 'Nao foi possivel salvar.');
            return;
        }

        e.target.reset();
        if (isEquip) populateCategoryOptions();
        if (isCable) populateCableCategoryOptions();
        alert(
            isEquip
                ? 'Equipamento cadastrado com sucesso.'
                : (isCable ? 'Cabo cadastrado com sucesso.' : (isOtherItem ? 'Item cadastrado com sucesso.' : (isRental ? 'Locação criada com sucesso.' : 'Evento criado com sucesso.')))
        );

        if (isRental) {
            closeRentalModal();
            showSection('locacao');
            await loadRentalEvents();
            await loadRentalReturnAlerts();
        } else if (isEvent) {
            showSection('home');
            await loadEvents();
        } else if (isCable) {
            showSection('cadastro');
            setCadastroTab('cabos');
        } else if (isOtherItem) {
            showSection('cadastro');
            setCadastroTab('outros');
        } else {
            showSection('cadastro');
            setCadastroTab('equipamentos');
        }
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
});

async function handleMaintenanceKeyPress(event) {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    await searchMaintenanceEquipment();
}

async function handleMaintenanceCableKeyPress(event) {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    await searchMaintenanceCable();
}

async function searchMaintenanceEquipment() {
    const barcode = document.getElementById('maintenanceBarcode')?.value.trim();
    if (!barcode) return;

    try {
        const response = await fetch(`api/equipments?search=${encodeURIComponent(barcode)}`, { credentials: 'include' });
        if (!response.ok) {
            alert('Nao foi possivel buscar o equipamento.');
            return;
        }

        const equipments = await response.json();
        const equipment = equipments.find((item) => item.barcode === barcode) || equipments[0];

        if (!equipment) {
            alert('Equipamento nao encontrado.');
            clearMaintenance();
            return;
        }

        selectedMaintenanceItem = equipment;
        selectedMaintenanceType = 'equipamento';
        openMaintenanceModal('create', equipment, 'equipamento');
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

async function searchMaintenanceCable() {
    const cableName = document.getElementById('maintenanceCableName')?.value.trim();
    if (!cableName) return;

    try {
        const response = await fetch(`api/cables?search=${encodeURIComponent(cableName)}`, { credentials: 'include' });
        if (!response.ok) {
            alert('Nao foi possivel buscar o cabo.');
            return;
        }

        const cables = await response.json();
        const normalizedName = cableName.toLowerCase();
        const cable = cables.find((item) => String(item.name || '').toLowerCase() === normalizedName) || cables[0];

        if (!cable) {
            alert('Cabo nao encontrado.');
            clearMaintenance();
            return;
        }

        selectedMaintenanceItem = cable;
        selectedMaintenanceType = 'cabo';
        openMaintenanceModal('create', cable, 'cabo');
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

function openMaintenanceModal(mode, item, itemType = 'equipamento') {
    maintenanceModalMode = mode;

    const modal = document.getElementById('maintenanceModal');
    const title = document.getElementById('maintenanceModalTitle');
    const subtitle = document.getElementById('maintenanceModalSubtitle');
    const label = document.getElementById('maintenanceModalLabel');
    const input = document.getElementById('maintenanceModalInput');
    const action = document.getElementById('maintenanceModalAction');
    const itemLabel = itemType === 'cabo' ? 'Cabo' : 'Equipamento';

    if (!modal || !title || !subtitle || !label || !input || !action) return;

    if (mode === 'create') {
        title.textContent = 'Registrar problema';
        subtitle.textContent = `${itemLabel}: ${item.name}`;
        label.textContent = 'Qual o problema?';
        input.value = '';
        input.placeholder = 'Descreva o problema...';
        input.readOnly = false;
        action.style.display = '';
        action.textContent = 'Salvar';
        setTimeout(() => input.focus(), 0);
        return modal.style.display = 'flex';
    }

    title.textContent = `Problema do ${itemType === 'cabo' ? 'cabo' : 'equipamento'}`;
    subtitle.textContent = `${itemLabel}: ${item.name}`;
    label.textContent = 'Descricao';
    input.value = item.maintenance_description || 'Sem descricao.';
    input.readOnly = true;
    action.style.display = 'none';
    modal.style.display = 'flex';
}

function closeMaintenanceModal() {
    const modal = document.getElementById('maintenanceModal');
    const input = document.getElementById('maintenanceModalInput');
    if (modal) modal.style.display = 'none';
    if (input) {
        input.value = '';
        input.readOnly = false;
    }
    maintenanceModalMode = null;
}

async function handleMaintenanceModalKeyPress(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (maintenanceModalMode !== 'create') return;

    event.preventDefault();
    await saveMaintenance();
}

function setupMaintenanceModal() {
    const modal = document.getElementById('maintenanceModal');
    const input = document.getElementById('maintenanceModalInput');

    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeMaintenanceModal();
            }
        });
    }

    if (input) {
        input.addEventListener('keypress', handleMaintenanceModalKeyPress);
    }
}

function openMaintenanceDetails(equipmentId) {
    const equipment = allEquipments.find((item) => Number(item.id) === Number(equipmentId));
    if (!equipment) {
        alert('Equipamento nao encontrado.');
        return;
    }

    openMaintenanceModal('view', equipment, 'equipamento');
}

function openCableMaintenanceDetails(cableId) {
    const cable = allCables.find((item) => Number(item.id) === Number(cableId));
    if (!cable) {
        alert('Cabo nao encontrado.');
        return;
    }

    openMaintenanceModal('view', cable, 'cabo');
}

async function submitMaintenanceModal() {
    if (maintenanceModalMode !== 'create') return;
    await saveMaintenance();
}

async function saveMaintenance() {
    if (!selectedMaintenanceItem) {
        alert(`Busque um ${selectedMaintenanceType === 'cabo' ? 'cabo' : 'equipamento'} antes de registrar a manutencao.`);
        return;
    }

    const description = document.getElementById('maintenanceModalInput')?.value.trim();
    if (!description) {
        alert('Descreva o problema antes de salvar.');
        return;
    }

    try {
        const response = await fetch(selectedMaintenanceType === 'cabo' ? 'api/cable-maintenances' : 'api/maintenances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(
                selectedMaintenanceType === 'cabo'
                    ? { cableId: selectedMaintenanceItem.id, description }
                    : { equipmentId: selectedMaintenanceItem.id, description }
            )
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            alert(error.message || 'Nao foi possivel registrar a manutencao.');
            return;
        }

        alert('Manutencao registrada com sucesso.');
        closeMaintenanceModal();
        clearMaintenance();
        if (selectedMaintenanceType === 'cabo') {
            await Promise.all([loadCables(getEquipmentSearchValue()), loadMaintenanceCables()]);
        } else {
            await Promise.all([loadEquipments(getEquipmentSearchValue()), loadMaintenanceEquipments()]);
        }
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

async function markMaintenanceReady(equipmentId) {
    const equipment = maintenanceEquipments.find((item) => Number(item.id) === Number(equipmentId));
    if (!equipment) {
        alert('Equipamento nao encontrado.');
        return;
    }

    try {
        const response = await fetch(`api/maintenances/${Number(equipmentId)}/ready`, {
            method: 'PATCH',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            alert(error.message || 'Nao foi possivel finalizar a manutencao.');
            return;
        }

        await loadMaintenanceEquipments();
        await loadEquipments(getEquipmentSearchValue());
        alert(`${equipment.name} marcado como disponivel.`);
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

async function markCableMaintenanceReady(cableId) {
    const cable = maintenanceCables.find((item) => Number(item.id) === Number(cableId));
    if (!cable) {
        alert('Cabo nao encontrado.');
        return;
    }

    try {
        const response = await fetch(`api/cable-maintenances/${Number(cableId)}/ready`, {
            method: 'PATCH',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            alert(error.message || 'Nao foi possivel finalizar a manutencao do cabo.');
            return;
        }

        await Promise.all([loadMaintenanceCables(), loadCables(getEquipmentSearchValue())]);
        alert(`${cable.name} marcado como pronto.`);
    } catch (error) {
        console.error(error);
        alert('Erro de conexao.');
    }
}

function clearMaintenance() {
    selectedMaintenanceItem = null;
    const maintenanceBarcode = document.getElementById('maintenanceBarcode');
    const maintenanceCableName = document.getElementById('maintenanceCableName');
    if (maintenanceBarcode) maintenanceBarcode.value = '';
    if (maintenanceCableName) maintenanceCableName.value = '';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
}

function applyLoginManagementVisibility() {
    const menuItem = document.getElementById('usersMenuItem');
    if (menuItem) {
        menuItem.style.display = currentUser?.isAdmin ? '' : 'none';
    }
}

function setUsersMessage(message, type = '') {
    const messageEl = document.getElementById('usersMessage');
    if (!messageEl) return;
    messageEl.textContent = message || '';
    messageEl.className = `users-message ${type}`.trim();
}

function toggleCreateUserForm(forceOpen) {
    const form = document.getElementById('createUserForm');
    if (!form) return;

    const shouldOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : form.style.display === 'none';
    form.style.display = shouldOpen ? '' : 'none';

    if (!shouldOpen) {
        form.reset();
    }
}

async function loadLoginUsers() {
    if (!currentUser?.isAdmin) return;

    try {
        const response = await fetch('api/users', { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setUsersMessage(data.error || 'Nao foi possivel carregar os usuarios.', 'error');
            return;
        }

        loginUsers = Array.isArray(data.users) ? data.users : [];
        canChangeUserPasswords = !!data.canChangePasswords;
        const createButton = document.getElementById('openUserCreateButton');
        if (createButton) {
            createButton.style.display = canChangeUserPasswords ? '' : 'none';
        }
        renderLoginUsers();
        setUsersMessage('');
    } catch (error) {
        console.error(error);
        setUsersMessage('Erro de conexao.', 'error');
    }
}

function renderLoginUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    loginUsers.forEach((user) => {
        const userId = Number(user.id);
        const canEdit = canChangeUserPasswords && currentUser?.isAdmin;
        const canDelete = canEdit && Number(user.id) !== Number(currentUser?.userId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(user.username)}</td>
            <td><span class="user-role-badge ${user.role === 'admin' ? 'admin' : ''}">${escapeHtml(user.role || 'user')}</span></td>
            <td>
                <input
                    type="password"
                    id="userPassword_${userId}"
                    class="user-password-input"
                    placeholder="${canEdit ? 'Nova senha' : 'Restrito'}"
                    autocomplete="new-password"
                    ${canEdit ? '' : 'disabled'}
                >
            </td>
            <td class="user-actions-cell">
                <button type="button" class="btn-primary user-password-button" onclick="changeUserPassword(${userId})" ${canEdit ? '' : 'disabled'}>Salvar</button>
                <button type="button" class="btn-danger user-password-button" onclick="deleteLoginUser(${userId})" ${canDelete ? '' : 'disabled'}>Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function changeUserPassword(userId) {
    const input = document.getElementById(`userPassword_${Number(userId)}`);
    const password = String(input?.value || '');
    if (password.trim().length < 4) {
        setUsersMessage('A senha deve ter pelo menos 4 caracteres.', 'error');
        return;
    }

    try {
        const response = await fetch(`api/users/${Number(userId)}/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ password })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setUsersMessage(data.error || 'Nao foi possivel alterar a senha.', 'error');
            return;
        }

        input.value = '';
        setUsersMessage('Senha atualizada com seguranca.', 'success');
    } catch (error) {
        console.error(error);
        setUsersMessage('Erro de conexao.', 'error');
    }
}

async function createLoginUser(event) {
    event.preventDefault();
    if (!canChangeUserPasswords || !currentUser?.isAdmin) {
        setUsersMessage('Apenas administradores podem cadastrar usuarios.', 'error');
        return;
    }

    const username = String(document.getElementById('newUsername')?.value || '').trim();
    const password = String(document.getElementById('newUserPassword')?.value || '');
    const role = String(document.getElementById('newUserRole')?.value || 'user').trim();

    if (!username) {
        setUsersMessage('Informe o usuario.', 'error');
        return;
    }

    if (password.trim().length < 4) {
        setUsersMessage('A senha deve ter pelo menos 4 caracteres.', 'error');
        return;
    }

    try {
        const response = await fetch('api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password, role })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setUsersMessage(data.error || 'Nao foi possivel cadastrar o usuario.', 'error');
            return;
        }

        toggleCreateUserForm(false);
        await loadLoginUsers();
        setUsersMessage('Usuario cadastrado com seguranca.', 'success');
    } catch (error) {
        console.error(error);
        setUsersMessage('Erro de conexao.', 'error');
    }
}

async function deleteLoginUser(userId) {
    const user = loginUsers.find((item) => Number(item.id) === Number(userId));
    if (!user) {
        setUsersMessage('Usuario nao encontrado.', 'error');
        return;
    }

    if (Number(user.id) === Number(currentUser?.userId)) {
        setUsersMessage('Voce nao pode excluir seu proprio usuario.', 'error');
        return;
    }

    const confirmed = window.confirm(`Excluir o usuario ${user.username}?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`api/users/${Number(userId)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setUsersMessage(data.error || 'Nao foi possivel excluir o usuario.', 'error');
            return;
        }

        await loadLoginUsers();
        setUsersMessage('Usuario excluido.', 'success');
    } catch (error) {
        console.error(error);
        setUsersMessage('Erro de conexao.', 'error');
    }
}

async function checkAuth() {
    // Check if in guest mode from localStorage (for GitHub Pages)
    const isGuestMode = localStorage.getItem('isGuestMode') === 'true';
    
    if (isGuestMode) {
        // Guest mode - no server authentication needed
        if (typeof storage !== 'undefined') {
            storage.setGuestMode(true);
        }
        
        currentUser = { 
            userId: null, 
            username: 'Convidado', 
            isAdmin: false,
            isGuest: true,
            role: 'guest'
        };
        
        updateLogoutButton();
        applyLoginManagementVisibility();
        document.body.style.visibility = 'visible';
        return;
    }
    
    // Try server authentication (only for non-GitHub Pages deployments)
    try {
        const res = await fetch('api/auth/status', { credentials: 'include' });
        const data = await res.json();
        if (!data.authenticated) {
            window.location.href = 'login/';
            return;
        }
        
        // Set guest mode in storage
        const isGuest = data.isGuest || false;
        if (typeof storage !== 'undefined') {
            storage.setGuestMode(isGuest);
        }
        
        currentUser = data.authenticated
            ? { 
                userId: data.userId || null, 
                username: data.username || '', 
                isAdmin: !!data.isAdmin,
                isGuest: isGuest,
                role: isGuest ? 'guest' : (data.isAdmin ? 'admin' : 'user')
            }
            : null;
        
        updateLogoutButton();
        applyLoginManagementVisibility();
        document.body.style.visibility = 'visible';
    } catch (error) {
        // Server not available - redirect to login
        window.location.href = 'login/';
    }
}

function updateLogoutButton() {
    const logoutText = document.getElementById('logout-user-text');
    if (logoutText && currentUser) {
        const username = currentUser.username || 'Usuário';
        logoutText.textContent = `${username} - Sair`;
        
        // Remove long-text class first
        logoutText.classList.remove('long-text');
        
        // Use requestAnimationFrame to ensure DOM layout is complete before checking dimensions
        requestAnimationFrame(() => {
            // Check if text is too long and add scrolling class
            if (logoutText.scrollWidth > logoutText.clientWidth) {
                logoutText.classList.add('long-text');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    populateCategoryOptions();
    populateCableCategoryOptions();
    setupMaintenanceModal();
    document.getElementById('createUserForm')?.addEventListener('submit', createLoginUser);
    await checkAuth();
    loadThemeSettings();
    await initializeLottieIcons();
    applyCustomTheme();

    const urlParams = new URLSearchParams(window.location.search);
    const requestedSection = urlParams.get('section') || window.location.hash.replace('#', '');
    const allowedSections = ['home', 'cadastro', 'banco', 'eventos', 'historico', 'manutencao', 'locacao', 'config'];
    const section = allowedSections.includes(requestedSection) ? requestedSection : 'home';
    showSection(section);

    window.addEventListener('hashchange', () => {
        const requestedHash = window.location.hash.replace('#', '');
        const targetSection = allowedSections.includes(requestedHash) ? requestedHash : 'home';
        showSection(targetSection);
    });
});

function applyTheme(theme) {
    try {
        if (!theme) return;
        const root = document.documentElement;
        Object.keys(theme).forEach((key) => {
            if (!theme[key] || key === 'component-bg') return;
            root.style.setProperty(`--${key}`, theme[key]);
        });
        root.style.setProperty('--component-bg', 'transparent');
    } catch (e) {
        console.error('Erro aplicando tema', e);
    }
}

function loadThemeSettings() {
    try {
        const stored = localStorage.getItem('appTheme');
        if (!stored) return;
        const theme = JSON.parse(stored);
        if (!theme) return;
        
        if (theme['primary'] && document.getElementById('primaryColor')) document.getElementById('primaryColor').value = theme['primary'];
        if (theme['primary-2'] && document.getElementById('primary2Color')) document.getElementById('primary2Color').value = theme['primary-2'];
        if (theme['bg-start'] && document.getElementById('bgStart')) document.getElementById('bgStart').value = theme['bg-start'];
        if (theme['bg-end'] && document.getElementById('bgEnd')) document.getElementById('bgEnd').value = theme['bg-end'];
        if (theme['text-color'] && document.getElementById('textColor')) document.getElementById('textColor').value = theme['text-color'];
        if (theme['secondary-btn-bg'] && document.getElementById('secondaryBtnBg')) document.getElementById('secondaryBtnBg').value = theme['secondary-btn-bg'];
        if (theme['secondary-btn-border'] && document.getElementById('secondaryBtnBorder')) document.getElementById('secondaryBtnBorder').value = theme['secondary-btn-border'];
        if (theme['secondary-btn-text'] && document.getElementById('secondaryBtnText')) document.getElementById('secondaryBtnText').value = theme['secondary-btn-text'];
        if (theme['inner-component-bg'] && document.getElementById('innerComponentBg')) document.getElementById('innerComponentBg').value = theme['inner-component-bg'];
        if (theme['input-bg'] && document.getElementById('inputBg')) document.getElementById('inputBg').value = theme['input-bg'];
        if (theme['input-border'] && document.getElementById('inputBorder')) document.getElementById('inputBorder').value = theme['input-border'];
        if (theme['input-text'] && document.getElementById('inputText')) document.getElementById('inputText').value = theme['input-text'];
        
        applyTheme(theme);
    } catch (e) { console.error(e); }
}

// Settings tabs management
function showSettingsTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    const content = document.getElementById(`settings-${tabName}`);
    if (content) {
        content.classList.add('active');
    }
    
    // Mark clicked tab as active - find it by the onclick attribute
    document.querySelectorAll('.settings-tab').forEach(tab => {
        if (tab.getAttribute('onclick')?.includes(tabName)) {
            tab.classList.add('active');
        }
    });
}

// Enhanced theme settings
function saveThemeSettings() {
    const primary = document.getElementById('primaryColor')?.value || '#ff3333';
    const primary2 = document.getElementById('primary2Color')?.value || '#cc0000';
    const bgStart = document.getElementById('bgStart')?.value || '#1a1a1a';
    const bgEnd = document.getElementById('bgEnd')?.value || '#000000';
    const textColor = document.getElementById('textColor')?.value || '#cccccc';
    const secondaryBtnBg = document.getElementById('secondaryBtnBg')?.value || '#444444';
    const secondaryBtnBorder = document.getElementById('secondaryBtnBorder')?.value || '#555555';
    const secondaryBtnText = document.getElementById('secondaryBtnText')?.value || '#cccccc';
    const innerComponentBg = document.getElementById('innerComponentBg')?.value || '#1a1a1a';
    const inputBg = document.getElementById('inputBg')?.value || '#333333';
    const inputBorder = document.getElementById('inputBorder')?.value || '#555555';
    const inputText = document.getElementById('inputText')?.value || '#ffffff';
    
    const theme = {
        'primary': primary,
        'primary-2': primary2,
        'bg-start': bgStart,
        'bg-end': bgEnd,
        'text-color': textColor,
        'secondary-btn-bg': secondaryBtnBg,
        'secondary-btn-border': secondaryBtnBorder,
        'secondary-btn-text': secondaryBtnText,
        'inner-component-bg': innerComponentBg,
        'input-bg': inputBg,
        'input-border': inputBorder,
        'input-text': inputText
    };
    
    // Save to localStorage
    localStorage.setItem('theme-primary-color', primary);
    localStorage.setItem('theme-secondary-color', primary2);
    localStorage.setItem('theme-bg-start', bgStart);
    localStorage.setItem('theme-bg-end', bgEnd);
    localStorage.setItem('theme-text-color', textColor);
    localStorage.setItem('theme-secondary-btn-bg', secondaryBtnBg);
    localStorage.setItem('theme-secondary-btn-border', secondaryBtnBorder);
    localStorage.setItem('theme-secondary-btn-text', secondaryBtnText);
    localStorage.setItem('theme-inner-component-bg', innerComponentBg);
    localStorage.setItem('theme-input-bg', inputBg);
    localStorage.setItem('theme-input-border', inputBorder);
    localStorage.setItem('theme-input-text', inputText);
    localStorage.setItem('appTheme', JSON.stringify(theme));
    
    // Apply theme immediately
    applyTheme(theme);
    applyCustomTheme();
    updateColorInputs();
    alert('Tema salvo com sucesso!');
}

function resetThemeSettings() {
    localStorage.removeItem('appTheme');
    localStorage.removeItem('theme-primary-color');
    localStorage.removeItem('theme-secondary-color');
    localStorage.removeItem('theme-bg-start');
    localStorage.removeItem('theme-bg-end');
    localStorage.removeItem('theme-text-color');
    localStorage.removeItem('theme-secondary-btn-bg');
    localStorage.removeItem('theme-secondary-btn-border');
    localStorage.removeItem('theme-secondary-btn-text');
    localStorage.removeItem('theme-inner-component-bg');
    localStorage.removeItem('theme-input-bg');
    localStorage.removeItem('theme-input-border');
    localStorage.removeItem('theme-input-text');
    
    const defaultTheme = {
        'primary': '#ff3333',
        'primary-2': '#cc0000',
        'bg-start': '#1a1a1a',
        'bg-end': '#000000',
        'text-color': '#cccccc',
        'secondary-btn-bg': '#444444',
        'secondary-btn-border': '#555555',
        'secondary-btn-text': '#cccccc',
        'inner-component-bg': '#1a1a1a',
        'input-bg': '#333333',
        'input-border': '#555555',
        'input-text': '#ffffff'
    };
    
    document.getElementById('primaryColor').value = defaultTheme['primary'];
    document.getElementById('primary2Color').value = defaultTheme['primary-2'];
    document.getElementById('bgStart').value = defaultTheme['bg-start'];
    document.getElementById('bgEnd').value = defaultTheme['bg-end'];
    document.getElementById('textColor').value = defaultTheme['text-color'];
    document.getElementById('secondaryBtnBg').value = defaultTheme['secondary-btn-bg'];
    document.getElementById('secondaryBtnBorder').value = defaultTheme['secondary-btn-border'];
    document.getElementById('secondaryBtnText').value = defaultTheme['secondary-btn-text'];
    document.getElementById('innerComponentBg').value = defaultTheme['inner-component-bg'];
    document.getElementById('inputBg').value = defaultTheme['input-bg'];
    document.getElementById('inputBorder').value = defaultTheme['input-border'];
    document.getElementById('inputText').value = defaultTheme['input-text'];
    
    applyTheme(defaultTheme);
    updateColorInputs();
    alert('Tema resetado para o padrão!');
}

function updateColorInputs() {
    // Sync color picker with text input (just update values, listeners are set up once on DOMContentLoaded)
    ['primary', 'primary2', 'bgStart', 'bgEnd', 'textColor', 'secondaryBtnBg', 'secondaryBtnBorder', 'secondaryBtnText', 'innerComponentBg', 'inputBg', 'inputBorder', 'inputText'].forEach(name => {
        const colorInput = document.getElementById(name + 'Color');
        const hexInput = document.getElementById(name + 'ColorHex');
        if (colorInput && hexInput) {
            hexInput.value = colorInput.value;
        }
    });
}

// Logo upload handling
let pendingLogoData = null;

function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        document.getElementById('logoUploadMessage').textContent = 'Formato de arquivo invalido. Use JPG, PNG, WebP ou SVG.';
        return;
    }
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        document.getElementById('logoUploadMessage').textContent = 'Arquivo muito grande. Tamanho maximo: 2MB.';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingLogoData = e.target.result;
        document.getElementById('logoPreview').src = pendingLogoData;
        document.getElementById('logoUploadMessage').textContent = 'Logo carregada. Clique em "Salvar Logo" para aplicar.';
        document.getElementById('logoUploadMessage').style.color = '#4CAF50';
    };
    reader.readAsDataURL(file);
}

function saveCustomLogo() {
    if (!pendingLogoData) {
        alert('Nenhuma logo foi carregada.');
        return;
    }
    
    // Check if user is guest or admin
    const isGuest = currentUser?.role === 'guest';
    const isAdmin = currentUser?.role === 'admin';
    
    if (!isGuest && !isAdmin) {
        alert('Apenas administradores e convidados podem alterar a logo.');
        return;
    }
    
    // Save to localStorage (works for both guest and admin)
    // TODO: Add server-side persistence for admin users when backend support is added
    localStorage.setItem('custom-logo', pendingLogoData);
    
    // Apply to sidebar logo
    const sidebarLogo = document.getElementById('customLogo');
    if (sidebarLogo) {
        sidebarLogo.src = pendingLogoData;
    }
    
    // Note: Favicon is managed separately
    
    pendingLogoData = null;
    alert('Logo salva com sucesso!');
}

function updateFavicon(logoData) {
    // Remove existing favicon links
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach(link => link.remove());
    
    // Create new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/webp';
    link.href = logoData;
    document.head.appendChild(link);
}

function resetLogo() {
    localStorage.removeItem('custom-logo');
    const defaultLogoSrc = 'assets/images/logo.webp';
    
    document.getElementById('logoPreview').src = defaultLogoSrc;
    const sidebarLogo = document.getElementById('customLogo');
    if (sidebarLogo) {
        sidebarLogo.src = defaultLogoSrc;
    }
    
    // Note: Favicon is managed separately
    
    pendingLogoData = null;
    alert('Logo resetada para o padrão!');
}

// Favicon upload handling
let pendingFaviconData = null;

function handleFaviconUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        document.getElementById('faviconUploadMessage').textContent = 'Formato de arquivo invalido. Use JPG, PNG, WebP ou SVG.';
        return;
    }
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        document.getElementById('faviconUploadMessage').textContent = 'Arquivo muito grande. Tamanho maximo: 2MB.';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        pendingFaviconData = e.target.result;
        document.getElementById('faviconPreview').src = pendingFaviconData;
        document.getElementById('faviconUploadMessage').textContent = 'Favicon carregado. Clique em "Salvar Favicon" para aplicar.';
        document.getElementById('faviconUploadMessage').style.color = '#4CAF50';
    };
    reader.readAsDataURL(file);
}

function saveCustomFavicon() {
    if (!pendingFaviconData) {
        alert('Nenhum favicon foi carregado.');
        return;
    }
    
    // Check if user is guest or admin
    const isGuest = currentUser?.role === 'guest';
    const isAdmin = currentUser?.role === 'admin';
    
    if (!isGuest && !isAdmin) {
        alert('Apenas administradores e convidados podem alterar o favicon.');
        return;
    }
    
    // Save to localStorage (works for both guest and admin)
    localStorage.setItem('custom-favicon', pendingFaviconData);
    
    // Update favicon
    updateFavicon(pendingFaviconData);
    
    pendingFaviconData = null;
    alert('Favicon salvo com sucesso!');
}

function resetFavicon() {
    localStorage.removeItem('custom-favicon');
    const defaultFaviconSrc = 'assets/images/favicon.webp';
    
    document.getElementById('faviconPreview').src = defaultFaviconSrc;
    
    // Reset favicon to default
    updateFavicon(defaultFaviconSrc);
    
    pendingFaviconData = null;
    alert('Favicon resetado para o padrão!');
}


// Initialize color input sync
document.addEventListener('DOMContentLoaded', () => {
    // Sync color pickers with text inputs
    ['primary', 'primary2', 'bgStart', 'bgEnd', 'textColor', 'secondaryBtnBg', 'secondaryBtnBorder', 'secondaryBtnText', 'innerComponentBg', 'inputBg', 'inputBorder', 'inputText'].forEach(name => {
        const colorInput = document.getElementById(name + 'Color');
        const hexInput = document.getElementById(name + 'ColorHex');
        
        if (colorInput && hexInput) {
            colorInput.addEventListener('input', () => {
                hexInput.value = colorInput.value;
            });
            
            hexInput.addEventListener('input', () => {
                if (/^#[0-9A-F]{6}$/i.test(hexInput.value)) {
                    colorInput.value = hexInput.value;
                }
            });
        }
    });
});


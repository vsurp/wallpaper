// ========================================================================
// FL Studio Wallpaper App - Main Application Logic
// ========================================================================

// Globalny obiekt aplikacji, do którego moduły mogą się odwoływać.
const WallpaperApp = {
    _modules: new Map(),
    registerModule(name, module) {
        this._modules.set(name, module);
    },
    getModule(name) {
        return this._modules.get(name);
    },
    UI: { /* Implementacje UI zostają w tym pliku, poniżej */ },
    MenuTools: { /* Implementacje MenuTools zostają w tym pliku, poniżej */ }
};

// --- Funkcje pomocnicze dla UI i Menu ---

Object.assign(WallpaperApp.UI, {
    showNotification(message, type = 'info', duration = 3000) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<div class="notification-content">${message}</div>`;
        container.appendChild(notification);
        container.style.visibility = 'visible';
        setTimeout(() => { notification.classList.add('show'); }, 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
                if (container.children.length === 0) container.style.visibility = 'hidden';
            }, 500);
        }, duration);
    },
    showModal(options) { /* ... implementacja showModal ... */ },
    hideModal() { /* ... implementacja hideModal ... */ }
});

Object.assign(WallpaperApp.MenuTools, {
    setupL2ItemListeners(submenuId) { /* ... implementacja ... */ },
    openPerClipTransitionsPanel(index, clipName) { /* ... implementacja ... */ },
    closePerClipTransitionsPanel() { /* ... implementacja ... */ }
});


function setupMenuSystem() {
    // ... cała logika menu, bez zmian ...
}

function populateL2Submenu(submenuId, items, type) {
    const submenu = document.getElementById(submenuId);
    if (!submenu) {
        console.error(`Submenu with id "${submenuId}" not found.`);
        return;
    }
    const menuContentSection = submenu.querySelector('.menu-content .menu-section');
    if (!menuContentSection) return;
    menuContentSection.innerHTML = '';
    items.forEach(item => {
        const button = document.createElement('button');
        button.className = 'submenu-item-l2';
        button.textContent = item.name;
        button.setAttribute('data-tooltip', `Apply ${item.name} effect`);
        if (type === 'effect') button.setAttribute('data-effect-id', item.id);
        menuContentSection.appendChild(button);
    });
}

// --- Główny Punkt Startowy Aplikacji ---

// Używamy 'DOMContentLoaded', aby mieć pewność, że cały HTML jest gotowy.
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOM fully loaded. Initializing application...");

        // Sprawdzenie, czy moduły zostały wczytane
        if (typeof PlayerEngine === 'undefined' || typeof MediaManager === 'undefined') {
            throw new Error("A core module (PlayerEngine or MediaManager) failed to load.");
        }

        // Rejestracja modułów
        WallpaperApp.registerModule('PlayerEngine', PlayerEngine);
        WallpaperApp.registerModule('MediaManager', MediaManager);

        // Inicjalizacja Media Managera, który przygotowuje całą logikę
        MediaManager.init();

        // Inicjalizacja systemu menu
        const menuSystem = setupMenuSystem();
        if (!menuSystem.success) {
            throw new Error('Menu system initialization failed');
        }

        // Wypełnienie dynamicznych menu
        const MediaManagerModule = WallpaperApp.getModule('MediaManager');
        if (MediaManagerModule && typeof MediaManagerModule.getAvailableEffects === 'function') {
            populateL2Submenu('effects-list-submenu', MediaManagerModule.getAvailableEffects(), 'effect');
            WallpaperApp.MenuTools.setupL2ItemListeners('effects-list-submenu');
        }

        const perClipPanelCloseBtn = document.querySelector('#per-clip-transitions-panel .panel-close');
        if (perClipPanelCloseBtn) {
            perClipPanelCloseBtn.addEventListener('click', () => WallpaperApp.MenuTools.closePerClipTransitionsPanel());
        }

        console.log("Application initialization complete.");

    } catch (error) {
        console.error('[App Initialization] Critical error:', error);
        // Używamy UI z WallpaperApp do pokazania błędu
        if (WallpaperApp.UI && WallpaperApp.UI.showNotification) {
            WallpaperApp.UI.showNotification('Failed to initialize application. Check console.', 'error');
        }
    }
});
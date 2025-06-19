// ========================================================================
// FL Studio Wallpaper App - Main Application Logic
// Version 1.3.0 - Click-to-Open Menu by Gemini
// ========================================================================

const WallpaperApp = {
    _modules: new Map(),
    registerModule(name, module) { this._modules.set(name, module); },
    getModule(name) { return this._modules.get(name); },
    UI: {},
    MenuTools: {}
};

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
    }
});
Object.assign(WallpaperApp.MenuTools, { /* ... stubs ... */ });


/**
 * FIX: The menu now opens on CLICK of the side trigger, not on hover.
 * This makes the interaction more deliberate as requested.
 */
function setupMenuSystem() {
    try {
        const mainMenu = document.getElementById('main-menu');
        const menuTrigger = document.getElementById('menu-trigger'); // The visible trigger button
        const mainCloseBtn = mainMenu.querySelector('.menu-close');

        if (!mainMenu || !menuTrigger || !mainCloseBtn) {
            console.error("Core menu elements for setup were not found.");
            return { success: false };
        }

        // --- State Management Functions ---
        const closeAllSubmenus = () => {
            document.querySelectorAll('.submenu-wrapper.active, .slide-submenu.active').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.submenu-wrapper-l2.active, .slide-submenu-l2.active').forEach(el => el.classList.remove('active'));
            mainMenu.classList.remove('main-menu-submenu-active', 'main-menu-l2-active');
        };

        const openMainMenu = () => mainMenu.classList.add('active');
        const closeMainMenu = () => {
            closeAllSubmenus();
            mainMenu.classList.remove('active');
        };

        // --- Event Listeners ---
        menuTrigger.addEventListener('click', openMainMenu);
        mainCloseBtn.addEventListener('click', closeMainMenu);

        // --- Handle L1 Submenu Opening ---
        document.querySelectorAll('.category-item[data-action]').forEach(button => {
            button.addEventListener('click', () => {
                closeAllSubmenus(); // Close other submenus first
                const action = button.dataset.action;
                const submenuId = action.includes('effects') ? 'effects-list-submenu' : action + '-submenu';
                const submenu = document.getElementById(submenuId);

                if (submenu) {
                    const isL2 = submenu.classList.contains('slide-submenu-l2');
                    const wrapper = submenu.closest(isL2 ? '.submenu-wrapper-l2' : '.submenu-wrapper');

                    if(wrapper) {
                        mainMenu.classList.add(isL2 ? 'main-menu-l2-active' : 'main-menu-submenu-active');
                        wrapper.classList.add('active');
                        submenu.classList.add('active');
                    }
                }
            });
        });

        // --- Handle L1 Submenu Closing ---
        document.querySelectorAll('.submenu-close').forEach(button => {
            button.addEventListener('click', () => {
                const submenu = button.closest('.slide-submenu');
                const wrapper = button.closest('.submenu-wrapper');
                if (submenu && wrapper) {
                    mainMenu.classList.remove('main-menu-submenu-active');
                    submenu.classList.remove('active');
                    wrapper.classList.remove('active');
                }
            });
        });

        // --- Handle L2 Submenu Closing ---
        document.querySelectorAll('.submenu-close-l2').forEach(button => {
            button.addEventListener('click', () => {
                const submenu = button.closest('.slide-submenu-l2');
                const wrapper = button.closest('.submenu-wrapper-l2');
                if (submenu && wrapper) {
                    mainMenu.classList.remove('main-menu-l2-active');
                    submenu.classList.remove('active');
                    wrapper.classList.remove('active');
                }
            });
        });

        return { success: true };
    } catch (error) {
        console.error("Error setting up menu system:", error);
        return { success: false };
    }
}

function populateL2Submenu(submenuId, items, type) {
    if (!items) return;
    const submenu = document.getElementById(submenuId);
    if (!submenu) { return; }
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

// --- Main Application Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOM fully loaded. Initializing application...");

        const menuSystem = setupMenuSystem();
        if (!menuSystem || !menuSystem.success) {
            throw new Error('Menu system initialization failed');
        }

        if (typeof PlayerEngine === 'undefined' || typeof MediaManager === 'undefined') {
            throw new Error("A core module (PlayerEngine or MediaManager) failed to load.");
        }

        WallpaperApp.registerModule('PlayerEngine', PlayerEngine);
        WallpaperApp.registerModule('MediaManager', MediaManager);

        MediaManager.init();

        const MediaManagerModule = WallpaperApp.getModule('MediaManager');
        if (MediaManagerModule && typeof MediaManagerModule.getAvailableEffects === 'function') {
            populateL2Submenu('effects-list-submenu', MediaManagerModule.getAvailableEffects(), 'effect');
        }

        console.log("Application initialization complete.");

    } catch (error) {
        console.error('[App Initialization] Critical error:', error);
        if (WallpaperApp.UI && WallpaperApp.UI.showNotification) {
            WallpaperApp.UI.showNotification('Failed to initialize application. Check console.', 'error');
        }
    }
});
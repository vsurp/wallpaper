// ========================================================================
// FL Studio Wallpaper App - Main Application Logic
// ========================================================================
// Ten plik inicjalizuje aplikację, zarządza interfejsem użytkownika (szczególnie menu)
// i koordynuje działanie różnych modułów.
// ========================================================================

// Rozszerzenie globalnego obiektu WallpaperApp o narzędzia UI i Menu
Object.assign(WallpaperApp, {
    UI: {
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
        showModal(options) {
            const modalContainer = document.getElementById('modal-container');
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-header"><h2>${options.title || 'Confirmation'}</h2><button class="btn btn-icon modal-close-btn">&times;</button></div>
                <div class="modal-body"><p>${options.content || ''}</p></div>
                <div class="modal-footer"></div>`;
            const footer = modal.querySelector('.modal-footer');
            if (options.footerButtons) {
                options.footerButtons.forEach(btnInfo => {
                    const button = document.createElement('button');
                    button.textContent = btnInfo.text;
                    button.className = `btn ${btnInfo.classes || ''}`;
                    button.onclick = () => {
                        if (btnInfo.onClick) btnInfo.onClick();
                        this.hideModal();
                    };
                    footer.appendChild(button);
                });
            }
            modal.querySelector('.modal-close-btn').onclick = () => this.hideModal();
            if (modalContainer) {
                modalContainer.innerHTML = '';
                modalContainer.appendChild(modal);
                modalContainer.style.display = 'flex';
                setTimeout(() => modal.classList.add('show'), 10);
            }
        },
        hideModal() {
            const modalContainer = document.getElementById('modal-container');
            const modal = modalContainer ? modalContainer.querySelector('.modal') : null;
            if (modal) {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (modalContainer) modalContainer.style.display = 'none';
                }, 300);
            }
        }
    },
    MenuTools: {
        setupL2ItemListeners(submenuId) {
            document.getElementById(submenuId)?.addEventListener('click', (e) => {
                const button = e.target.closest('.submenu-item-l2');
                if (button) console.log(`L2 item clicked: ${button.dataset.effectId}`);
            });
        },
        openPerClipTransitionsPanel(index, clipName) {
            const wrapper = document.getElementById('slide-left-panel-wrapper');
            const panel = document.getElementById('per-clip-transitions-panel');
            const title = panel?.querySelector('.panel-header-title');
            const MediaManager = WallpaperApp.getModule('MediaManager');
            if (wrapper && panel && title && MediaManager) {
                title.textContent = `TRANSITIONS FOR ${clipName.substring(0, 20)}`;
                MediaManager.populatePerClipTransitions(index);
                wrapper.style.display = 'block';
                setTimeout(() => panel.classList.add('active'), 10);
            }
        },
        closePerClipTransitionsPanel() {
            const wrapper = document.getElementById('slide-left-panel-wrapper');
            const panel = document.getElementById('per-clip-transitions-panel');
            if (panel) panel.classList.remove('active');
            if (wrapper) setTimeout(() => wrapper.style.display = 'none', 300);
        }
    }
});

function setupMenuSystem() {
    try {
        const menuTrigger = document.getElementById('menu-trigger');
        const mainMenu = document.getElementById('main-menu');
        const menuClose = mainMenu?.querySelector('.menu-close');
        const categoryItems = document.querySelectorAll('#main-menu .category-item');
        const submenuWrapperL1 = document.querySelector('.submenu-wrapper');
        const submenuWrapperL2 = document.querySelector('.submenu-wrapper-l2');
        if (!mainMenu || !submenuWrapperL1 || !submenuWrapperL2) throw new Error("Critical menu elements not found.");
        const afterAnimation = (callback) => setTimeout(callback, 350);
        async function closeLevel2Submenus(keepL1Open = false) {
            const wrapper = document.querySelector('.submenu-wrapper-l2.active');
            if (wrapper) {
                wrapper.classList.remove('active');
                mainMenu.classList.remove('main-menu-l2-active');
                if (!keepL1Open) return new Promise(resolve => afterAnimation(() => { wrapper.style.display = 'none'; resolve(); }));
            }
        }
        async function closeLevel1Submenus(keepMainMenuOpen = false) {
            await closeLevel2Submenus(true);
            const wrapper = document.querySelector('.submenu-wrapper.active');
            if (wrapper) {
                wrapper.querySelectorAll('.slide-submenu.active').forEach(s => s.classList.remove('active'));
                wrapper.classList.remove('active');
                if (!keepMainMenuOpen) {
                    mainMenu.classList.remove('main-menu-submenu-active');
                    return new Promise(resolve => afterAnimation(() => { wrapper.style.display = 'none'; resolve(); }));
                }
            }
        }
        async function closeMainMenu() {
            await closeLevel1Submenus();
            mainMenu.classList.remove('active');
        }
        menuTrigger?.addEventListener('click', () => mainMenu.classList.contains('active') ? closeMainMenu() : mainMenu.classList.add('active'));
        menuClose?.addEventListener('click', closeMainMenu);
        categoryItems.forEach(item => {
            item.addEventListener('click', async () => {
                const action = item.getAttribute('data-action');
                const isEffects = action === 'effects';
                const targetSubmenuId = isEffects ? 'effects-list-submenu' : `${action}-submenu`;
                const targetSubmenu = document.getElementById(targetSubmenuId);
                if (item.classList.contains('selected')) {
                    item.classList.remove('selected');
                    await (isEffects ? closeLevel2Submenus() : closeLevel1Submenus());
                } else {
                    categoryItems.forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    if (isEffects) {
                        await closeLevel1Submenus(true);
                        submenuWrapperL2.style.display = 'block';
                        requestAnimationFrame(() => {
                            mainMenu.classList.add('main-menu-l2-active');
                            submenuWrapperL2.classList.add('active');
                            targetSubmenu.classList.add('active');
                        });
                    } else if (targetSubmenu) {
                        await closeLevel2Submenus(true);
                        const activeL1 = submenuWrapperL1.querySelector('.slide-submenu.active');
                        if (activeL1) activeL1.classList.remove('active');
                        submenuWrapperL1.style.display = 'block';
                        requestAnimationFrame(() => {
                            mainMenu.classList.add('main-menu-submenu-active');
                            submenuWrapperL1.classList.add('active');
                            targetSubmenu.classList.add('active');
                        });
                    } else {
                        await closeLevel1Submenus(true);
                    }
                }
            });
        });
        document.querySelectorAll('.submenu-wrapper .submenu-close, .submenu-wrapper-l2 .submenu-close-l2').forEach(btn => {
            btn.addEventListener('click', async () => {
                const parent = btn.closest('.slide-submenu, .slide-submenu-l2');
                if (parent) {
                    const action = parent.id.replace('-submenu', '').replace('-list', '');
                    document.querySelector(`.category-item[data-action="${action}"]`)?.classList.remove('selected');
                }
                await (btn.classList.contains('submenu-close-l2') ? closeLevel2Submenus() : closeLevel1Submenus());
            });
        });
        document.addEventListener('keydown', async (e) => {
            if (e.key === 'Escape') {
                if (document.querySelector('.modal.show')) WallpaperApp.UI.hideModal();
                else if (document.getElementById('slide-left-panel-wrapper').style.display !== 'none') WallpaperApp.MenuTools.closePerClipTransitionsPanel();
                else if (document.querySelector('.submenu-wrapper-l2.active')) await closeLevel2Submenus();
                else if (document.querySelector('.submenu-wrapper.active')) await closeLevel1Submenus();
                else if (mainMenu.classList.contains('active')) await closeMainMenu();
            }
        });
        return { success: true };
    } catch (e) {
        console.error("MenuSystem init failed:", e);
        return { success: false };
    }
}

function populateL2Submenu(submenuId, items, type) {
    const submenu = document.getElementById(submenuId);
    const menuContentSection = submenu?.querySelector('.menu-content .menu-section');
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

function main() {
    try {
        console.log("DOM fully loaded. Initializing application...");
        if (typeof PlayerEngine === 'undefined' || typeof MediaManager === 'undefined') {
            throw new Error("A core module (PlayerEngine or MediaManager) failed to load.");
        }
        WallpaperApp.registerModule('PlayerEngine', PlayerEngine);
        WallpaperApp.registerModule('MediaManager', MediaManager);
        MediaManager.init();
        if (!setupMenuSystem().success) throw new Error('Menu system initialization failed');
        const MediaManagerModule = WallpaperApp.getModule('MediaManager');
        if (MediaManagerModule?.getAvailableEffects) {
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
        WallpaperApp.UI.showNotification('Failed to initialize application. Check console.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', main);
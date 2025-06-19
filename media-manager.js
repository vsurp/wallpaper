/**
 * FL Studio Wallpaper App - Media Manager Module
 * Version 0.8.5 - Final Dependency Order Fix
 *
 * This module handles UI, media library, playlist management, and file imports.
 * All helper objects are now declared before they are used to prevent reference errors.
 */

const MediaManager = (() => {
  "use strict";

  // --- 1. State and Core Utilities (No Dependencies) ---
  const CONSTANTS = { /* ... treść stałych ... */ };
  const state = { /* ... treść stanu ... */ };
  const Utils = { /* ... treść Utils ... */ };

  // --- 2. All Manager/Handler Objects Declaration ---
  // All objects are declared here first, before any of them are used.

  const SelectionManager = { /* ... treść SelectionManager ... */ };
  const StorageManager = { /* ... treść StorageManager ... */ };
  const DragDropHandler = { /* ... treść DragDropHandler ... */ };
  const FileHandler = { /* ... treść FileHandler ... */ };
  const MediaLibraryManager = { /* ... treść MediaLibraryManager ... */ };
  const PlaylistManager = { /* ... treść PlaylistManager ... */ };
  const ContextualManager = { /* ... treść ContextualManager ... */ };
  const EffectsManager = { /* ... treść EffectsManager ... */ };
  const TransitionManager = { /* ... treść TransitionManager ... */ };
  const DOMManager = { /* ... treść DOMManager ... */ };
  const EventHandler = { /* ... treść EventHandler ... */ };


  // --- 3. All Object Definitions ---
  // Teraz, gdy wszystkie obiekty są zadeklarowane, możemy bezpiecznie zdefiniować ich zawartość.
  // (Uwaga: dla zwięzłości, pokazuję tylko te, które wymagają uwagi, reszta kodu pozostaje taka sama jak w poprzedniej wersji)

  Object.assign(DOMManager, {
    initializeDOMReferences() { /* ... */ },
    setupMediaImportUI(menuContent) {
      menuContent.innerHTML = '';
      this.setupFileInput();
      const importButton = Utils.createElement('button', {
        className: 'submenu-item import-media-button',
        textContent: 'IMPORT MEDIA',
        attributes: { 'data-tooltip': 'Click to import media files' }
      });
      importButton.addEventListener('click', () => {
        document.getElementById('media-file-input')?.click();
      });
      menuContent.appendChild(importButton);
      menuContent.appendChild(Utils.createDivider());
      state.dom.mediaLibrarySection = this.createMediaLibrarySection();
      menuContent.appendChild(state.dom.mediaLibrarySection);
      menuContent.appendChild(Utils.createDivider());
      state.dom.playlistSection = this.createPlaylistSection();
      menuContent.appendChild(state.dom.playlistSection);
    },
    setupFileInput() { /* ... */ },
    createMediaLibrarySection() {
      const section = Utils.createElement('div', { id: 'media-library-section' });
      section.appendChild(Utils.createElement('h3', { textContent: 'MEDIA LIBRARY' }));
      section.appendChild(Utils.createElement('div', { className: 'selection-info', textContent: 'Shift+Click or drag to select. Right-click for options.'}));
      const gallery = Utils.createElement('div', { id: 'media-gallery' });
      SelectionManager.setupGalleryDragSelection(gallery); // Teraz SelectionManager na pewno istnieje
      state.dom.mediaEmptyState = Utils.createElement('div', { id: 'media-empty-state', textContent: 'Import media to get started.'});
      gallery.appendChild(state.dom.mediaEmptyState);
      section.appendChild(gallery);
      state.dom.mediaGallery = gallery;
      return section;
    },
    createPlaylistSection() { /* ... */ },
    createPlaylistControls(container) { /* ... */ }
  });

  Object.assign(EventHandler, {
    setupGlobalEvents() {
      document.addEventListener('keydown', e => { if (e.key === 'Shift') state.selection.shiftKeyActive = true; });
      document.addEventListener('keyup', e => { if (e.key === 'Shift') state.selection.shiftKeyActive = false; });
      // ... reszta kodu ...
      this.setupSubmenuEvents();
    },
    setupSubmenuEvents() {
      state.dom.mediaGallery?.addEventListener('click', e => { /* ... */ });
      state.dom.mediaGallery?.addEventListener('contextmenu', e => { /* ... */ });
      state.dom.playlistControlsContainer?.addEventListener('click', e => { /* ... */ });
      state.dom.playlistContainer?.addEventListener('click', e => { /* ... */ });
    }
  });


  // --- 4. Initialization ---

  const init = () => {
    console.log("[MediaManager] Initializing...");
    if (!DOMManager.initializeDOMReferences()) {
      console.error("MediaManager failed to find critical DOM elements.");
      return;
    }
    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
    if (!menuContent) {
      console.error("Could not find .menu-content in #import-media-submenu");
      return;
    }
    DOMManager.setupMediaImportUI(menuContent);
    StorageManager.loadData();
    EventHandler.setupGlobalEvents(); // Ta linia teraz zadziała poprawnie
    const player = WallpaperApp.getModule('PlayerEngine');
    if (player) {
      player.init(state, PlaylistManager);
    } else {
      console.error("PlayerEngine module not found or loaded after MediaManager.");
    }
    console.log("[MediaManager] Initialization complete.");
  };

  return {
    init,
    getAvailableEffects: () => CONSTANTS.AVAILABLE_EFFECTS,
    getParamsFor: EffectsManager.getParamsFor,
    populatePerClipTransitions: TransitionManager.populatePerClipTransitions,
  };
})();
/**
 * FL Studio Wallpaper App - Media Manager Module
 * Version 0.8.2 - Dependency Order Hotfix
 *
 * This module handles UI, media library, playlist management, and file imports.
 * Corrected internal dependency order to prevent "is not a function" errors.
 */

const MediaManager = (() => {
  "use strict";

  // --- 1. State and Core Utilities (No Dependencies) ---

  const CONSTANTS = {
    SUPPORTED_TYPES: {
      video: ['video/mp4', 'video/webm', 'video/ogg'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
    },
    THUMBNAIL_DIMENSIONS: { width: 120, height: 90 },
    STORAGE_KEY: 'flStudioWallpaper_media_v8',
    AVAILABLE_TRANSITIONS: [
      { id: 'fade', name: 'Cross Fade', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 200, max: 3000, value: 700, unit: 'ms' }] },
      // other transitions...
    ],
    AVAILABLE_EFFECTS: [
      { id: 'blur', name: 'Blur', params: [{ id: 'intensity', name: 'Intensity', type: 'slider', min: 0, max: 100, value: 50, unit: '%' }] },
      // other effects...
    ]
  };

  const state = {
    mediaLibrary: [],
    playlist: { items: [], transitions: {}, currentIndex: -1, isPlaying: false, shuffle: false, playbackTimer: null, advancingInProgress: false, playedInShuffle: new Set() },
    dom: {},
    selection: { active: false, startPoint: null, items: new Set(), shiftKeyActive: false, lastSelected: null, selectionBoxElement: null },
    fileInput: null,
    contextualEditing: { active: false, type: null, targetId: null, panelElement: null, contextMenuElement: null, activeItem: null, perClipTargetIndex: null }
  };

  const Utils = {
    generateId: () => `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
    isFileSupported: (type) => CONSTANTS.SUPPORTED_TYPES.video.includes(type) || CONSTANTS.SUPPORTED_TYPES.image.includes(type),
    formatFileSize: (bytes) => {
      if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
      const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
    createElement: (tag, options = {}) => {
      const element = document.createElement(tag);
      if (options.className) element.className = options.className;
      if (options.id) element.id = options.id;
      if (options.textContent) element.textContent = options.textContent;
      if (options.innerHTML) element.innerHTML = options.innerHTML;
      if (options.attributes) Object.entries(options.attributes).forEach(([k, v]) => element.setAttribute(k, v));
      if (options.events) Object.entries(options.events).forEach(([e, h]) => element.addEventListener(e, h));
      return element;
    },
    createDivider: () => Utils.createElement('hr', { className: 'divider' }),
  };

  // --- 2. Independent Managers & Handlers ---

  const SelectionManager = {
    setupGalleryDragSelection(gallery) {
      let isSelecting = false, startPoint = {}, rect = null;
      gallery.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target !== gallery) return;
        isSelecting = true;
        rect = gallery.getBoundingClientRect();
        startPoint = { x: e.clientX - rect.left + gallery.scrollLeft, y: e.clientY - rect.top + gallery.scrollTop };
        if (state.selection.selectionBoxElement) state.selection.selectionBoxElement.remove();
        state.selection.selectionBoxElement = Utils.createElement('div', { className: 'selection-box', style: { left: `${startPoint.x - gallery.scrollLeft}px`, top: `${startPoint.y - gallery.scrollTop}px` }});
        gallery.appendChild(state.selection.selectionBoxElement);
        if (!state.selection.shiftKeyActive) this.clearSelection();
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        const currentX = e.clientX - rect.left + gallery.scrollLeft, currentY = e.clientY - rect.top + gallery.scrollTop;
        const x1 = Math.min(startPoint.x, currentX), y1 = Math.min(startPoint.y, currentY), x2 = Math.max(startPoint.x, currentX), y2 = Math.max(startPoint.y, currentY);
        Object.assign(state.selection.selectionBoxElement.style, { left: `${x1 - gallery.scrollLeft}px`, top: `${y1 - gallery.scrollTop}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px` });
        gallery.querySelectorAll('.media-thumbnail').forEach(thumb => {
          const thumbRect = thumb.getBoundingClientRect();
          const selRect = { left: x1 + rect.left - gallery.scrollLeft, top: y1 + rect.top - gallery.scrollTop, right: x2 + rect.left - gallery.scrollLeft, bottom: y2 + rect.top - gallery.scrollTop };
          const intersects = !(thumbRect.right < selRect.left || thumbRect.left > selRect.right || thumbRect.bottom < selRect.top || thumbRect.top > selRect.bottom);
          const mediaId = thumb.dataset.id;
          if (intersects) { if (!state.selection.items.has(mediaId)) this.addToSelection(mediaId); }
          else { if (state.selection.items.has(mediaId) && !state.selection.shiftKeyActive) this.removeFromSelection(mediaId); }
        });
        this.updateSelectionUI();
      });
      document.addEventListener('mouseup', () => {
        if (!isSelecting) return;
        isSelecting = false;
        if (state.selection.selectionBoxElement) state.selection.selectionBoxElement.remove();
        if (state.selection.items.size > 0) state.selection.lastSelected = Array.from(state.selection.items).pop();
      });
    },
    clearSelection() { state.selection.items.clear(); state.selection.lastSelected = null; this.updateSelectionUI(); },
    addToSelection(id) { state.selection.items.add(id); this.updateSelectionUI();},
    removeFromSelection(id) { state.selection.items.delete(id); this.updateSelectionUI();},
    toggleSelection(id) { state.selection.items.has(id) ? this.removeFromSelection(id) : this.addToSelection(id); },
    selectRange(startId, endId) {
      const allThumbs = Array.from(state.dom.mediaGallery.querySelectorAll('.media-thumbnail'));
      const startIdx = allThumbs.findIndex(t => t.dataset.id === startId);
      const endIdx = allThumbs.findIndex(t => t.dataset.id === endId);
      if (startIdx === -1 || endIdx === -1) return;
      const [min, max] = [startIdx, endIdx].sort((a,b) => a-b);
      for (let i = min; i <= max; i++) this.addToSelection(allThumbs[i].dataset.id);
      state.selection.lastSelected = endId;
    },
    updateSelectionUI() { state.dom.mediaGallery?.querySelectorAll('.media-thumbnail').forEach(t => t.classList.toggle('selected', state.selection.items.has(t.dataset.id))); },
    handleThumbnailClick(e, media) {
      const PlayerEngine = WallpaperApp.getModule('PlayerEngine');
      if (state.selection.shiftKeyActive && state.selection.lastSelected) this.selectRange(state.selection.lastSelected, media.id);
      else if (e.ctrlKey || e.metaKey) { this.toggleSelection(media.id); state.selection.lastSelected = state.selection.items.has(media.id) ? media.id : null; }
      else {
        if (!state.selection.items.has(media.id) || state.selection.items.size > 1) {
          this.clearSelection();
          this.addToSelection(media.id);
          state.selection.lastSelected = media.id;
        }
        PlayerEngine.selectMedia(media, true);
      }
      this.updateSelectionUI();
    }
  };

  const StorageManager = {
    saveData() {
      try {
        const data = {
          media: state.mediaLibrary.map(({url, thumbnail, ...meta}) => ({...meta, settings: meta.settings || {effects:[]}})),
          playlist: { items: state.playlist.items, shuffle: state.playlist.shuffle, transitions: state.playlist.transitions || {} }
        };
        localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(data));
      } catch (e) { WallpaperApp.UI.showNotification('Error saving library.', 'error'); }
    },
    loadData() {
      try {
        const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        state.mediaLibrary = (parsed.media || []).map(m => ({ ...m, url: null, thumbnail: FileHandler.createFallbackThumbnail(m.type), settings: m.settings || {effects:[]} }));
        state.playlist.items = parsed.playlist?.items || [];
        state.playlist.shuffle = parsed.playlist?.shuffle || false;
        state.playlist.transitions = parsed.playlist?.transitions || {};
        MediaLibraryManager.updateUI();
        PlaylistManager.updateUI();
      } catch (e) { localStorage.removeItem(CONSTANTS.STORAGE_KEY); }
    }
  };

  // --- 3. Managers with Dependencies ---

  const DragDropHandler = {
    handlePlaylistDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; },
    handlePlaylistDrop(e) {
      e.preventDefault();
      const insertPos = this.calculateInsertPosition(e);
      try {
        const jsonText = e.dataTransfer.getData('application/json');
        if (jsonText) {
          const data = JSON.parse(jsonText);
          if (data.type === 'multiple-media' && data.ids) this.processMultipleMediaDrop(data.ids, insertPos);
          else if (data.type === 'playlist-reorder') PlaylistManager.reorderItem(parseInt(data.index), insertPos);
        } else {
          const mediaId = e.dataTransfer.getData('text/plain');
          if (mediaId) PlaylistManager.addItem(mediaId, insertPos);
        }
      } catch (err) { console.error('Playlist drop error:', err); }
    },
    processMultipleMediaDrop(mediaIds, insertPos) {
      const validItems = mediaIds.map(id => state.mediaLibrary.find(m => m.id === id)).filter(Boolean);
      if (validItems.length === 0) return;
      validItems.forEach((item, index) => {
        let currentInsertPos = (insertPos === -1) ? -1 : insertPos + index;
        PlaylistManager.addItem(item.id, currentInsertPos, true);
      });
      PlaylistManager.updateUI();
      StorageManager.saveData();
      WallpaperApp.UI.showNotification(`Added ${validItems.length} items to playlist.`, 'success');
    },
    calculateInsertPosition(e) {
      const targetEl = e.target.closest('.playlist-item, .playlist-transition-zone');
      if (!targetEl) return state.playlist.items.length;
      const isItem = targetEl.classList.contains('playlist-item');
      const targetIdx = parseInt(targetEl.dataset.index || '0', 10);
      return isItem ? (e.clientY < targetEl.getBoundingClientRect().top + targetEl.getBoundingClientRect().height / 2 ? targetIdx : targetIdx + 1) : targetIdx;
    }
  };

  const DOMManager = {
    initializeDOMReferences() {
      state.dom.mainMenu = document.getElementById('main-menu');
      state.dom.contextMenuContainer = document.getElementById('context-menu-container');
      state.dom.inlinePanelContainer = document.getElementById('inline-panel-container');
      state.dom.mediaContainer = document.getElementById('media-container');
      state.dom.perClipTransitionsList = document.getElementById('per-clip-transitions-list');
      state.dom.importSubmenu = document.getElementById('import-media-submenu');
      return !(!state.dom.mediaContainer || !state.dom.importSubmenu);
    },
    setupMediaImportUI(menuContent) {
      menuContent.innerHTML = '';
      this.setupFileInput();
      const importLabel = Utils.createElement('label', {
        className: 'submenu-item import-media-button', textContent: 'IMPORT MEDIA',
        attributes: { 'for': 'media-file-input', 'data-tooltip': 'Click to import media files', 'role': 'button', 'tabindex': '0' }
      });
      menuContent.appendChild(importLabel);
      menuContent.appendChild(Utils.createDivider());
      state.dom.mediaLibrarySection = this.createMediaLibrarySection();
      menuContent.appendChild(state.dom.mediaLibrarySection);
      menuContent.appendChild(Utils.createDivider());
      state.dom.playlistSection = this.createPlaylistSection();
      menuContent.appendChild(state.dom.playlistSection);
    },
    setupFileInput() {
      if (state.fileInput) state.fileInput.remove();
      state.fileInput = Utils.createElement('input', {
        type: 'file', id: 'media-file-input',
        accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','),
        multiple: true, style: { display: 'none' },
        events: { change: (e) => { FileHandler.handleFileSelect(e.target.files); e.target.value = ''; } }
      });
      document.body.appendChild(state.fileInput);
    },
    createMediaLibrarySection() {
      const section = Utils.createElement('div', { id: 'media-library-section' });
      section.appendChild(Utils.createElement('h3', { textContent: 'MEDIA LIBRARY' }));
      section.appendChild(Utils.createElement('div', { className: 'selection-info', textContent: 'Shift+Click or drag to select. Right-click for options.'}));
      const gallery = Utils.createElement('div', { id: 'media-gallery' });
      SelectionManager.setupGalleryDragSelection(gallery); // THIS IS THE LINE THAT CAUSED THE ERROR
      state.dom.mediaEmptyState = Utils.createElement('div', { id: 'media-empty-state', textContent: 'Import media to get started.'});
      gallery.appendChild(state.dom.mediaEmptyState);
      section.appendChild(gallery);
      state.dom.mediaGallery = gallery;
      return section;
    },
    createPlaylistSection() {
      const section = Utils.createElement('div', { id: 'playlist-section' });
      section.appendChild(Utils.createElement('h3', { textContent: 'PLAYLIST' }));
      const playlistContainer = Utils.createElement('div', { id: 'playlist-container' });
      playlistContainer.addEventListener('dragover', DragDropHandler.handlePlaylistDragOver);
      playlistContainer.addEventListener('drop', DragDropHandler.handlePlaylistDrop);
      state.dom.playlistEmptyState = Utils.createElement('div', { id: 'playlist-empty-state', textContent: 'Drag media here to create a playlist.'});
      playlistContainer.appendChild(state.dom.playlistEmptyState);
      section.appendChild(playlistContainer);
      state.dom.playlistContainer = playlistContainer;
      const controlsContainer = Utils.createElement('div', { id: 'playlist-controls', style: { visibility: 'hidden' }});
      state.dom.playlistControlsContainer = controlsContainer;
      this.createPlaylistControls(controlsContainer);
      section.appendChild(controlsContainer);
      return section;
    },
    createPlaylistControls(container) {
      container.innerHTML = '';
      const buttons = [
        { id: 'playlist-play-button', html: '<span>▶</span> Play All', class: 'btn-primary' },
        { id: 'playlist-shuffle-button', html: '<span>🔀</span> Shuffle', class: 'btn-secondary' },
        { id: 'playlist-clear-button', html: '<span>✕</span> Clear Playlist', class: 'btn-danger' }
      ];
      buttons.forEach(btnData => container.appendChild(Utils.createElement('button', { id: btnData.id, innerHTML: btnData.html, className: `btn playlist-button ${btnData.class || ''}`})));
    }
  };

  const FileHandler = { /* ... as before ... */ };
  const MediaLibraryManager = { /* ... as before ... */ };
  const PlaylistManager = { /* ... as before ... */ };
  const ContextualManager = { /* ... as before ... */ };
  const EffectsManager = { /* ... as before ... */ };
  const TransitionManager = { /* ... as before ... */ };

  // --- 4. Event Handling (Depends on all managers) ---

  const EventHandler = {
    setupGlobalEvents() {
      document.addEventListener('keydown', e => { if (e.key === 'Shift') state.selection.shiftKeyActive = true; });
      document.addEventListener('keyup', e => { if (e.key === 'Shift') state.selection.shiftKeyActive = false; });
      document.addEventListener('click', e => {
        if (state.dom.contextMenuContainer?.style.display !== 'none' && !e.target.closest('#context-menu-container')) ContextualManager.hideContextMenu();
        if (state.dom.inlinePanelContainer?.style.display !== 'none' && !e.target.closest('#inline-panel-container')) ContextualManager.hideInlinePanel();
      }, true);
      this.setupSubmenuEvents();
    },
    setupSubmenuEvents() {
      state.dom.mediaGallery?.addEventListener('click', e => {
        const thumb = e.target.closest('.media-thumbnail');
        if (!thumb) return;
        const media = state.mediaLibrary.find(m => m.id === thumb.dataset.id);
        if (!media) return;
        if (e.target.closest('.media-delete-btn')) { e.stopPropagation(); MediaLibraryManager.handleMediaDelete(media); }
        else { SelectionManager.handleThumbnailClick(e, media); }
      });
      state.dom.mediaGallery?.addEventListener('contextmenu', e => {
        e.preventDefault();
        const thumb = e.target.closest('.media-thumbnail');
        if (thumb) ContextualManager.showContextMenu(e, thumb.dataset.id, 'effect', thumb);
      });
      state.dom.playlistControlsContainer?.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const PlayerEngine = WallpaperApp.getModule('PlayerEngine');
        if (btn.id === 'playlist-play-button') PlayerEngine.playPlaylist();
        else if (btn.id === 'playlist-shuffle-button') PlaylistManager.toggleShuffle();
        else if (btn.id === 'playlist-clear-button') PlaylistManager.clearPlaylist();
      });
      state.dom.playlistContainer?.addEventListener('click', e => {
        const item = e.target.closest('.playlist-item');
        if (!item) return;
        const index = parseInt(item.dataset.index);
        const PlayerEngine = WallpaperApp.getModule('PlayerEngine');
        if (e.target.closest('.playlist-item-delete')) PlaylistManager.removeItem(index);
        else if (e.target.closest('.playlist-item-set-transition-btn')) {
          const media = state.mediaLibrary.find(m => m.id === item.dataset.id);
          if (media) WallpaperApp.MenuTools.openPerClipTransitionsPanel(index, media.name);
        } else {
          if (state.playlist.isPlaying && state.playlist.currentIndex === index) PlayerEngine.pausePlaylist();
          else PlayerEngine.playByIndex(index);
        }
      });
    }
  };

  // --- 5. Initialization ---

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
    EventHandler.setupGlobalEvents();
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
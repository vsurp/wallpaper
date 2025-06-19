/**
 * FL Studio Wallpaper App - Media Manager Module
 * Version 2.2.0 - Critical SyntaxError Fix
 *
 * This version fixes a critical syntax error in a utility function that was
 * preventing the entire module from loading and causing all subsequent errors.
 */

const MediaManager = (() => {
  "use strict";

  // --- 1. State and Core Utilities ---
  const state = {
    mediaLibrary: [],
    playlist: { items: [], transitions: {}, currentIndex: -1, isPlaying: false, shuffle: false },
    dom: {},
  };

  const Utils = {
    createElement: (tag, options = {}) => {
      const el = document.createElement(tag);
      if (options.id) el.id = options.id;
      if (options.className) el.className = options.className;
      if (options.textContent) el.textContent = options.textContent;
      if (options.innerHTML) el.innerHTML = options.innerHTML;
      if (options.attributes) {
        // FIX: Corrected the syntax for destructuring in a for...of loop.
        for (const [key, value] of Object.entries(options.attributes)) {
          el.setAttribute(key, value);
        }
      }
      return el;
    },
    createDivider: () => Utils.createElement('hr', { className: 'divider' })
  };

  // --- 2. Manager Objects (Direct Definition) ---

  const StorageManager = {
    KEY: 'flWallpaperAppState',
    saveData() {
      try {
        const dataToSave = {
          mediaLibrary: state.mediaLibrary.map(item => ({ id: item.id, name: item.name, type: item.type, settings: item.settings })),
          playlist: state.playlist
        };
        localStorage.setItem(this.KEY, JSON.stringify(dataToSave));
      } catch (error) { console.error("Error saving data:", error); }
    },
    loadData() {
      try {
        const savedData = localStorage.getItem(this.KEY);
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          state.mediaLibrary = parsedData.mediaLibrary || [];
          state.playlist = parsedData.playlist || state.playlist;
        }
      } catch (error) { console.error("Error loading data:", error); }
    }
  };

  const DOMManager = {
    initializeDOMReferences() {
      state.dom.importSubmenu = document.getElementById('import-media-submenu');
      return !!state.dom.importSubmenu;
    },
    setupMediaImportUI(menuContent) {
      menuContent.innerHTML = '';
      this.setupFileInput();
      const importButton = Utils.createElement('button', {
        className: 'submenu-item import-media-button', textContent: 'IMPORT MEDIA',
      });
      importButton.addEventListener('click', () => document.getElementById('media-file-input')?.click());
      menuContent.appendChild(importButton);
      menuContent.appendChild(Utils.createDivider());
      menuContent.appendChild(this.createMediaLibrarySection());
      menuContent.appendChild(Utils.createDivider());
      menuContent.appendChild(this.createPlaylistSection());
    },
    setupFileInput() {
      if (document.getElementById('media-file-input')) return;
      const input = Utils.createElement('input', {
        id: 'media-file-input',
        className: 'visually-hidden',
        attributes: { type: 'file', multiple: 'true', accept: 'image/*,video/*' },
      });
      input.addEventListener('change', FileHandler.handleFileSelect);
      document.body.appendChild(input);
    },
    createMediaLibrarySection() {
      const section = Utils.createElement('div', { id: 'media-library-section' });
      section.appendChild(Utils.createElement('h3', { textContent: 'MEDIA LIBRARY' }));
      const gallery = Utils.createElement('div', { id: 'media-gallery' });
      state.dom.mediaEmptyState = Utils.createElement('div', { id: 'media-empty-state', textContent: 'Import media to get started.' });
      gallery.appendChild(state.dom.mediaEmptyState);
      section.appendChild(gallery);
      state.dom.mediaGallery = gallery;
      return section;
    },
    createPlaylistSection() {
      const section = Utils.createElement('div', { id: 'playlist-section' });
      section.appendChild(Utils.createElement('h3', { textContent: 'PLAYLIST' }));
      const playlistContainer = Utils.createElement('div', { id: 'playlist-container' });
      state.dom.playlistEmptyState = Utils.createElement('div', { id: 'playlist-empty-state', textContent: 'Drag media here.' });
      playlistContainer.appendChild(state.dom.playlistEmptyState);
      section.appendChild(playlistContainer);
      state.dom.playlistContainer = playlistContainer;
      const controlsContainer = Utils.createElement('div', { id: 'playlist-controls' });
      section.appendChild(controlsContainer);
      this.createPlaylistControls(controlsContainer);
      return section;
    },
    createPlaylistControls(container) {
      const player = WallpaperApp.getModule('PlayerEngine');
      if (!player || !container) return;
      container.innerHTML = '';
      const playBtn = Utils.createElement('button', { id: 'playlist-play-button', className: 'btn playlist-button', innerHTML: '<span>▶</span> Play' });
      playBtn.addEventListener('click', () => player.playPlaylist());
      const stopBtn = Utils.createElement('button', { id: 'playlist-stop-button', className: 'btn playlist-button', innerHTML: '<span>■</span> Stop' });
      stopBtn.addEventListener('click', () => player.stopPlaylist());
      const shuffleBtn = Utils.createElement('button', { id: 'playlist-shuffle-button', className: 'btn playlist-button', textContent: 'Shuffle' });
      shuffleBtn.addEventListener('click', () => {
        state.playlist.shuffle = !state.playlist.shuffle;
        shuffleBtn.classList.toggle('active', state.playlist.shuffle);
      });
      container.append(playBtn, stopBtn, shuffleBtn);
    }
  };

  const FileHandler = {
    handleFileSelect(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      for (const file of files) {
        const fileType = file.type.split('/')[0];
        if (fileType !== 'image' && fileType !== 'video') continue;
        const mediaObject = {
          id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name: file.name, type: fileType, url: URL.createObjectURL(file),
          settings: { effects: [], transitions: {} }
        };
        MediaLibraryManager.addMedia(mediaObject);
      }
      MediaLibraryManager.render();
      StorageManager.saveData();
    },
  };

  const MediaLibraryManager = {
    addMedia(mediaObject) {
      state.mediaLibrary.push(mediaObject);
    },
    deleteMedia(mediaId) {
      const index = state.mediaLibrary.findIndex(m => m.id === mediaId);
      if (index > -1) {
        URL.revokeObjectURL(state.mediaLibrary[index].url);
        state.mediaLibrary.splice(index, 1);
        this.render();
        StorageManager.saveData();
      }
    },
    render() {
      const gallery = state.dom.mediaGallery;
      if (!gallery) return;
      gallery.innerHTML = '';
      if (state.mediaLibrary.length === 0) {
        if (state.dom.mediaEmptyState) gallery.appendChild(state.dom.mediaEmptyState);
        return;
      }
      state.mediaLibrary.forEach(media => {
        const thumb = this.createThumbnail(media);
        gallery.appendChild(thumb);
      });
    },
    createThumbnail(media) {
      const thumb = Utils.createElement('div', {
        className: 'media-thumbnail', attributes: { 'data-id': media.id, draggable: 'true' }
      });
      const imgContainer = Utils.createElement('div', { className: 'media-thumbnail-img-container' });
      if (media.type === 'image') {
        const img = Utils.createElement('img', { attributes: { src: media.url }});
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; pointer-events: none;';
        imgContainer.appendChild(img);
      } else {
        imgContainer.innerHTML = `<span style="pointer-events: none;">▶</span>`;
        imgContainer.style.cssText = 'display:flex; align-items:center; justify-content:center; font-size: 2rem; color: rgba(255,255,255,0.5);';
      }
      const name = Utils.createElement('div', { className: 'media-thumbnail-name', textContent: media.name });
      const typeBadge = Utils.createElement('div', { className: 'media-type-badge', textContent: media.type.toUpperCase() });

      const deleteBtn = Utils.createElement('button', {
        className: 'btn-icon media-delete-btn',
        innerHTML: '&times;',
        attributes: { 'data-action': 'delete', 'aria-label': 'Delete media' }
      });

      thumb.append(imgContainer, name, typeBadge, deleteBtn);
      return thumb;
    }
  };

  const EventHandler = {
    init() {
      if (state.dom.mediaGallery) {
        state.dom.mediaGallery.addEventListener('click', this.handleGalleryClick.bind(this));
      }
    },
    handleGalleryClick(event) {
      const thumbnail = event.target.closest('.media-thumbnail');
      if (!thumbnail) return;

      const mediaId = thumbnail.dataset.id;

      if (event.target.dataset.action === 'delete') {
        MediaLibraryManager.deleteMedia(mediaId);
        return;
      }

      const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (media) {
        const player = WallpaperApp.getModule('PlayerEngine');
        if (player) {
          player.selectMedia(media, true);
        }
      }
    }
  };

  const PlaylistManager = {};

  // --- 4. Initialization ---
  const init = () => {
    console.log("[MediaManager] Initializing...");

    if (!DOMManager.initializeDOMReferences()) {
      console.error("MediaManager failed to find critical DOM elements.");
      return;
    }

    StorageManager.loadData();
    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
    if (!menuContent) {
      console.error("Could not find .menu-content in #import-media-submenu.");
      return;
    }

    DOMManager.setupMediaImportUI(menuContent);
    EventHandler.init();

    const player = WallpaperApp.getModule('PlayerEngine');
    if (player) {
      player.init(state, PlaylistManager);
    }

    MediaLibraryManager.render();
    console.log("[MediaManager] Initialization complete.");
  };

  return {
    init,
  };
})();
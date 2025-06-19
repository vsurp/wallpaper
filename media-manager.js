/**
 * FL Studio Wallpaper App - Media Manager Module
 * Version 0.7.1 - Fixed Init by Gemini
 *
 * This module handles UI, media library, playlist management, and file imports.
 * Playback logic has been moved to player-engine.js.
 */

const MediaManager = (() => {
  "use strict";

  // Constants - Configuration and supported types
  const CONSTANTS = {
    SUPPORTED_TYPES: {
      video: ['video/mp4', 'video/webm', 'video/ogg'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
    },
    THUMBNAIL_DIMENSIONS: {
      width: 120,
      height: 90
    },
    IMAGE_DISPLAY_DURATION: 5000,
    STORAGE_KEY: 'flStudioWallpaper_media_v7',
    VIDEO_METADATA_TIMEOUT: 10000,
    VIDEO_THUMBNAIL_TIMEOUT: 10000,
    AVAILABLE_TRANSITIONS: [
      { id: 'fade', name: 'Cross Fade', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 200, max: 3000, value: 700, unit: 'ms' }] },
      { id: 'dip-to-black', name: 'Dip to Black', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 200, max: 3000, value: 1000, unit: 'ms' }] },
      { id: 'slide-left', name: 'Slide Left', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 200, max: 2000, value: 800, unit: 'ms' }] },
      { id: 'zoom-out-in', name: 'Zoom Out/In', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 200, max: 2000, value: 900, unit: 'ms' }] },
      { id: 'blur', name: 'Blur', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 200, max: 2000, value: 600, unit: 'ms' }] },
      { id: 'glitch', name: 'Glitch', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 100, max: 1000, value: 400, unit: 'ms' }] },
    ],
    AVAILABLE_EFFECTS: [
      { id: 'blur', name: 'Blur', params: [{ id: 'intensity', name: 'Intensity', type: 'slider', min: 0, max: 100, value: 50, unit: '%' }] },
      { id: 'grayscale', name: 'Grayscale', params: [{ id: 'intensity', name: 'Intensity', type: 'slider', min: 0, max: 100, value: 100, unit: '%' }] },
      { id: 'sepia', name: 'Sepia', params: [{ id: 'intensity', name: 'Intensity', type: 'slider', min: 0, max: 100, value: 100, unit: '%' }] },
      { id: 'brightness', name: 'Brightness', params: [{ id: 'level', name: 'Level', type: 'slider', min: 0, max: 200, value: 100, unit: '%' }] },
    ]
  };

  // Application state - Centralized state management for this module
  const state = {
    mediaLibrary: [],
    playlist: {
      items: [],
      transitions: {},
      currentIndex: -1,
      isPlaying: false,
      shuffle: false,
      playbackTimer: null,
      advancingInProgress: false,
      playedInShuffle: new Set()
    },
    dom: {
      importSubmenu: null,
      mediaContainer: null,
      mediaGallery: null,
      playlistContainer: null,
      playlistControlsContainer: null,
      mediaLibrarySection: null,
      playlistSection: null,
      mediaEmptyState: null,
      playlistEmptyState: null,
      mainMenu: null,
      contextMenuContainer: null,
      inlinePanelContainer: null,
      perClipTransitionsList: null,
    },
    selection: {
      active: false,
      startPoint: null,
      items: new Set(),
      shiftKeyActive: false,
      lastSelected: null,
      selectionBoxElement: null
    },
    fileInput: null,
    contextualEditing: {
      active: false,
      type: null,
      targetId: null,
      panelElement: null,
      contextMenuElement: null,
      activeItem: null,
      perClipTargetIndex: null
    }
  };

  // Utility Functions
  const Utils = {
    generateId: () => `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
    isFileSupported: (type) =>
        CONSTANTS.SUPPORTED_TYPES.video.includes(type) || CONSTANTS.SUPPORTED_TYPES.image.includes(type),
    formatFileSize: (bytes) => {
      if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
    showNotification: (message, type = 'info', duration) => {
      WallpaperApp.UI.showNotification(message, type, duration);
    },
    createElement: (tag, options = {}) => {
      const element = document.createElement(tag);
      if (options.className) element.className = options.className;
      if (options.id) element.id = options.id;
      if (options.textContent) element.textContent = options.textContent;
      if (options.innerHTML) element.innerHTML = options.innerHTML;
      if (options.style) Object.assign(element.style, options.style);
      if (options.attributes) Object.entries(options.attributes).forEach(([k, v]) => element.setAttribute(k, v));
      if (options.events) Object.entries(options.events).forEach(([e, h]) => element.addEventListener(e, h));
      return element;
    },
    createDivider: () => Utils.createElement('hr', { className: 'divider' }),
  };

  // DOM Management
  const DOMManager = {
    initializeDOMReferences() {
      state.dom.mainMenu = document.getElementById('main-menu');
      state.dom.contextMenuContainer = document.getElementById('context-menu-container');
      state.dom.inlinePanelContainer = document.getElementById('inline-panel-container');
      state.dom.mediaContainer = document.getElementById('media-container');
      state.dom.perClipTransitionsList = document.getElementById('per-clip-transitions-list');
      state.dom.importSubmenu = document.getElementById('import-media-submenu');
      if (!state.dom.mediaContainer || !state.dom.importSubmenu) {
        console.error("CRITICAL - A required DOM element (#media-container or #import-media-submenu) not found.");
        return false;
      }
      return true;
    },
    setupMediaImportUI(menuContent) {
      menuContent.innerHTML = '';
      this.setupFileInput();
      const importButton = Utils.createElement('button', { className: 'submenu-item import-media-button', textContent: 'IMPORT MEDIA', attributes: { 'data-action': 'import-media-action', 'data-tooltip': 'Click to import media files' }});
      menuContent.appendChild(importButton);
      menuContent.appendChild(Utils.createDivider());
      state.dom.mediaLibrarySection = this.createMediaLibrarySection();
      menuContent.appendChild(state.dom.mediaLibrarySection);
      menuContent.appendChild(Utils.createDivider());
      state.dom.playlistSection = this.createPlaylistSection();
      menuContent.appendChild(state.dom.playlistSection);
    },
    setupFileInput() {
      if (state.fileInput) state.fileInput.remove();
      state.fileInput = Utils.createElement('input', { type: 'file', id: 'media-file-input', accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','), multiple: true, style: { display: 'none' }, events: { change: (e) => { FileHandler.handleFileSelect(e.target.files); e.target.value = ''; }}});
      document.body.appendChild(state.fileInput);
    },
    createMediaLibrarySection() {
      const section = Utils.createElement('div', { id: 'media-library-section' });
      section.appendChild(Utils.createElement('h3', { textContent: 'MEDIA LIBRARY' }));
      section.appendChild(Utils.createElement('div', { className: 'selection-info', textContent: 'Shift+Click or drag to select. Right-click for options.'}));
      const gallery = Utils.createElement('div', { id: 'media-gallery' });
      SelectionManager.setupGalleryDragSelection(gallery);
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

  // File Handler
  const FileHandler = {
    async handleFileSelect(files) {
      if (!files || files.length === 0) return;
      let validCount = 0, invalidCount = 0;
      const processingPromises = Array.from(files).map(file => {
        if (Utils.isFileSupported(file.type)) {
          return this.processFile(file).then(() => validCount++).catch(() => invalidCount++);
        } else {
          invalidCount++;
          Utils.showNotification(`Unsupported file type: ${file.name}`, 'warning');
          return Promise.resolve();
        }
      });
      await Promise.all(processingPromises);
      if (validCount > 0) Utils.showNotification(`Imported ${validCount} media file(s).`, 'success');
      MediaLibraryManager.updateUI();
      PlaylistManager.updateUI();
      StorageManager.saveData();
    },
    async processFile(file) {
      const id = Utils.generateId();
      const url = URL.createObjectURL(file);
      const type = CONSTANTS.SUPPORTED_TYPES.video.includes(file.type) ? 'video' : 'image';
      const mediaItem = { id, name: file.name, type, mimeType: file.type, size: file.size, url, dateAdded: Date.now(), thumbnail: null, settings: { effects: [] }};
      state.mediaLibrary.push(mediaItem);
      try {
        mediaItem.thumbnail = await this.generateThumbnail(mediaItem, file);
      } catch (err) {
        console.warn(`Thumbnail generation failed for "${mediaItem.name}":`, err.message);
        mediaItem.thumbnail = this.createFallbackThumbnail(mediaItem.type);
      }
    },
    generateThumbnail(mediaItem, file) {
      return new Promise((resolve, reject) => {
        if (mediaItem.type === 'image') {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = err => reject(new Error(`FileReader error: ${err}`));
          reader.readAsDataURL(file);
        } else if (mediaItem.type === 'video') {
          this.generateVideoThumbnail(mediaItem.url, mediaItem.name).then(resolve).catch(reject);
        } else {
          reject(new Error(`Unsupported type for thumbnail: ${mediaItem.type}`));
        }
      });
    },
    generateVideoThumbnail(videoUrl, videoName) {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.crossOrigin = "anonymous";
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) cleanupAndReject(`Thumbnail timeout for "${videoName}"`);
        }, CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT);
        const cleanup = () => { if(!resolved) { resolved = true; clearTimeout(timeout); video.src = ''; video.load(); }};
        const cleanupAndResolve = (url) => { cleanup(); resolve(url); };
        const cleanupAndReject = (msg) => { cleanup(); reject(new Error(msg)); };
        video.onloadedmetadata = () => video.currentTime = Math.min(1.0, video.duration / 3);
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width;
          canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          this.drawPlayButton(ctx, canvas.width, canvas.height);
          cleanupAndResolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        video.onerror = () => cleanupAndReject(`Video element error for "${videoName}"`);
        video.src = videoUrl;
      });
    },
    createFallbackThumbnail(type = 'media') {
      const canvas = document.createElement('canvas');
      canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width;
      canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (type === 'video') this.drawPlayButton(ctx, canvas.width, canvas.height, '#ccc');
      return canvas.toDataURL('image/png');
    },
    drawPlayButton(ctx, width, height, color = 'rgba(255, 255, 255, 0.7)') {
      ctx.fillStyle = color;
      const s = Math.min(width, height) * 0.25;
      ctx.beginPath();
      ctx.moveTo(width / 2 - s / 2, height / 2 - s * 0.866 / 2);
      ctx.lineTo(width / 2 - s / 2, height / 2 + s * 0.866 / 2);
      ctx.lineTo(width / 2 + s * 0.8, height / 2);
      ctx.closePath();
      ctx.fill();
    }
  };

  // Drag and Drop Handler
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
      Utils.showNotification(`Added ${validItems.length} items to playlist.`, 'success');
    },
    calculateInsertPosition(e) {
      const targetEl = e.target.closest('.playlist-item, .playlist-transition-zone');
      if (!targetEl) return state.playlist.items.length;
      const isItem = targetEl.classList.contains('playlist-item');
      const targetIdx = parseInt(targetEl.dataset.index || '0', 10);
      if (isItem) {
        const rect = targetEl.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2 ? targetIdx : targetIdx + 1;
      }
      return targetIdx;
    }
  };

  // Selection Manager
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

  // Media Library Manager
  const MediaLibraryManager = {
    updateUI() {
      const gallery = state.dom.mediaGallery;
      const emptyState = state.dom.mediaEmptyState;
      if (!gallery || !emptyState) return;
      emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
      const fragment = document.createDocumentFragment();
      state.mediaLibrary.forEach(media => fragment.appendChild(this.createThumbnail(media)));
      gallery.querySelectorAll('.media-thumbnail').forEach(c => c.remove());
      gallery.appendChild(fragment);
      SelectionManager.updateSelectionUI();
      const PlayerEngine = WallpaperApp.getModule('PlayerEngine');
      if (PlayerEngine && state.activeHighlight?.mediaId && state.activeHighlight.sourceType === 'library') {
        PlayerEngine.HighlightManager.updateActiveHighlight(state.activeHighlight.mediaId, 'library');
      }
    },
    createThumbnail(media) {
      const thumb = Utils.createElement('div', { className: 'media-thumbnail', attributes: { 'data-id': media.id, 'draggable': 'true', 'data-tooltip': `${media.name} (${media.type})` }});
      thumb.addEventListener('dragstart', (e) => {
        if (state.selection.items.size > 1 && state.selection.items.has(media.id)) {
          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'multiple-media', ids: Array.from(state.selection.items) }));
          state.dom.mediaGallery.querySelectorAll('.media-thumbnail.selected').forEach(t => t.classList.add('dragging'));
        } else {
          e.dataTransfer.setData('text/plain', media.id);
          thumb.classList.add('dragging');
        }
        e.dataTransfer.effectAllowed = 'copy';
      });
      thumb.addEventListener('dragend', () => state.dom.mediaGallery.querySelectorAll('.media-thumbnail.dragging').forEach(t => t.classList.remove('dragging')));
      const imgCont = Utils.createElement('div', { className: 'media-thumbnail-img-container', style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } : {}});
      thumb.appendChild(imgCont);
      if (media.settings?.effects?.length > 0) thumb.appendChild(Utils.createElement('div', { className: 'media-thumbnail-fx-indicator', textContent: 'FX'}));
      thumb.appendChild(Utils.createElement('div', { className: 'media-thumbnail-name', textContent: media.name }));
      thumb.appendChild(Utils.createElement('div', { className: 'media-type-badge', textContent: media.type.toUpperCase() }));
      const deleteBtn = Utils.createElement('button', { className: 'media-delete-btn btn btn-icon btn-danger', innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>', attributes: { 'aria-label': `Delete ${media.name}` }});
      thumb.appendChild(deleteBtn);
      return thumb;
    },
    deleteMedia(id, suppressNotification = false) {
      const index = state.mediaLibrary.findIndex(m => m.id === id);
      if (index === -1) return;
      const mediaToDelete = state.mediaLibrary[index];
      if (mediaToDelete.url?.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.url);
      if (mediaToDelete.thumbnail?.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.thumbnail);
      state.mediaLibrary.splice(index, 1);
      PlaylistManager.removeMediaFromPlaylist(id);
      this.updateUI();
      PlaylistManager.updateUI();
      StorageManager.saveData();
      if (!suppressNotification) Utils.showNotification(`Deleted: ${mediaToDelete.name}`, 'info');
      SelectionManager.clearSelection();
    },
    handleMediaDelete(media) {
      if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
        Array.from(state.selection.items).forEach(id => this.deleteMedia(id, true));
        Utils.showNotification(`${state.selection.items.size} items deleted.`, 'info');
        SelectionManager.clearSelection();
      } else {
        this.deleteMedia(media.id);
      }
    }
  };

  // Playlist Manager
  const PlaylistManager = {
    addItem(mediaId, insertAtIndex = -1, suppressNotification = false) {
      const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (!media) return Utils.showNotification(`Media not found.`, 'warning');
      const wasEmpty = state.playlist.items.length === 0;
      if (insertAtIndex === -1 || insertAtIndex >= state.playlist.items.length) {
        state.playlist.items.push(mediaId);
      } else {
        state.playlist.items.splice(insertAtIndex, 0, mediaId);
        if (state.playlist.isPlaying && insertAtIndex <= state.playlist.currentIndex) state.playlist.currentIndex++;
        this.updateTransitionsAfterInsert(insertAtIndex);
      }
      if (wasEmpty) state.playlist.currentIndex = 0;
      if (!suppressNotification) {
        this.updateUI();
        StorageManager.saveData();
        Utils.showNotification(`Added to playlist: ${media.name}`, 'success');
      }
    },
    removeItem(index) {
      if (index < 0 || index >= state.playlist.items.length) return;
      state.playlist.items.splice(index, 1);
      this.updateTransitionsAfterRemoval(index);
      const pl = state.playlist;
      const PlayerEngine = WallpaperApp.getModule('PlayerEngine');
      if (pl.isPlaying) {
        if (index === pl.currentIndex) {
          if (pl.items.length > 0) { pl.currentIndex = Math.min(index, pl.items.length - 1); PlayerEngine.playByIndex(pl.currentIndex); }
          else PlayerEngine.stopPlaylist();
        } else if (index < pl.currentIndex) pl.currentIndex--;
      }
      this.updateUI();
      StorageManager.saveData();
    },
    reorderItem(from, to) {
      if (from < 0 || from >= state.playlist.items.length || to < 0 || to > state.playlist.items.length || from === to) return;
      const target = to > from ? to - 1 : to;
      const [item] = state.playlist.items.splice(from, 1);
      state.playlist.items.splice(target, 0, item);
      const pl = state.playlist;
      if (pl.currentIndex === from) pl.currentIndex = target;
      else if (from < pl.currentIndex && target >= pl.currentIndex) pl.currentIndex--;
      else if (from > pl.currentIndex && target <= pl.currentIndex) pl.currentIndex++;
      this.updateUI();
      StorageManager.saveData();
    },
    removeMediaFromPlaylist(mediaId) {
      let wasPlayingDeleted = false;
      let oldIndex = state.playlist.currentIndex;
      let newIndex = state.playlist.currentIndex;
      state.playlist.items = state.playlist.items.filter((id, index) => {
        if (id === mediaId) {
          if (state.playlist.isPlaying && index === oldIndex) wasPlayingDeleted = true;
          if (index < oldIndex) newIndex--;
          return false;
        }
        return true;
      });
      state.playlist.currentIndex = newIndex;
      if (wasPlayingDeleted) {
        const PlayerEngine = WallpaperApp.getModule('PlayerEngine');
        if (state.playlist.items.length > 0) {
          state.playlist.currentIndex = Math.min(oldIndex, state.playlist.items.length - 1);
          PlayerEngine.playByIndex(state.playlist.currentIndex);
        } else {
          PlayerEngine.stopPlaylist();
        }
      }
    },
    updateTransitionsAfterInsert(idx) {
      const newTrans = {};
      Object.keys(state.playlist.transitions).sort((a,b)=>b-a).forEach(k => {
        const oldKey = parseInt(k);
        newTrans[oldKey >= idx ? oldKey + 1 : oldKey] = state.playlist.transitions[k];
      });
      state.playlist.transitions = newTrans;
    },
    updateTransitionsAfterRemoval(idx) {
      const newTrans = {};
      for (const k in state.playlist.transitions) {
        const oldKey = parseInt(k);
        if (oldKey === idx) continue;
        newTrans[oldKey > idx ? oldKey - 1 : oldKey] = state.playlist.transitions[k];
      }
      state.playlist.transitions = newTrans;
    },
    clearPlaylist(confirmed = false) {
      if (!confirmed) {
        WallpaperApp.UI.showModal({ title: 'Confirm Clear Playlist', content: 'Are you sure?', footerButtons: [{ text: 'Clear', classes: 'btn-danger', onClick: () => this.clearPlaylist(true) }, { text: 'Cancel' }]});
        return;
      }
      WallpaperApp.getModule('PlayerEngine').stopPlaylist();
      Object.assign(state.playlist, { items: [], transitions: {}, currentIndex: -1 });
      state.playlist.playedInShuffle.clear();
      this.updateUI();
      StorageManager.saveData();
      Utils.showNotification('Playlist cleared.', 'info');
    },
    toggleShuffle() {
      state.playlist.shuffle = !state.playlist.shuffle;
      if (state.playlist.shuffle) {
        state.playlist.playedInShuffle.clear();
        if (state.playlist.isPlaying && state.playlist.currentIndex >= 0) state.playlist.playedInShuffle.add(state.playlist.items[state.playlist.currentIndex]);
      }
      this.updateUI();
      StorageManager.saveData();
      Utils.showNotification(`Shuffle: ${state.playlist.shuffle ? 'On' : 'Off'}`, 'info');
    },
    updateUI() {
      const plCont = state.dom.playlistContainer;
      const empty = state.dom.playlistEmptyState;
      const controls = state.dom.playlistControlsContainer;
      if (!plCont || !empty || !controls) return;
      const hasItems = state.playlist.items.length > 0;
      empty.style.display = hasItems ? 'none' : 'block';
      controls.style.visibility = hasItems ? 'visible' : 'hidden';
      plCont.querySelectorAll('.playlist-item, .playlist-transition-zone').forEach(c => c.remove());
      if (hasItems) {
        const fragment = document.createDocumentFragment();
        fragment.appendChild(this.createTransitionZone(0));
        state.playlist.items.forEach((id, index) => {
          const media = state.mediaLibrary.find(m => m.id === id);
          if (media) fragment.appendChild(this.createPlaylistItem(media, index));
          if (index < state.playlist.items.length - 1) fragment.appendChild(this.createTransitionZone(index + 1));
        });
        plCont.appendChild(fragment);
      }
      this.updateControlButtons();
    },
    createPlaylistItem(media, index) {
      const item = Utils.createElement('div', { className: 'playlist-item', attributes: { 'data-id': media.id, 'data-index': index, draggable: 'true' }});
      item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/json', JSON.stringify({type: 'playlist-reorder', id: media.id, index: index })); e.dataTransfer.effectAllowed = 'move'; item.classList.add('dragging'); });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      const thumb = Utils.createElement('div', { className: 'playlist-item-thumbnail', style: { backgroundImage: `url(${media.thumbnail || ''})` }});
      item.appendChild(thumb);
      const info = Utils.createElement('div', { className: 'playlist-item-info' });
      info.appendChild(Utils.createElement('div', { className: 'playlist-item-name', textContent: media.name }));
      info.appendChild(Utils.createElement('div', { className: 'playlist-item-details', textContent: `${media.type} · ${Utils.formatFileSize(media.size)}`}));
      item.appendChild(info);
      const controls = Utils.createElement('div', { className: 'playlist-item-controls-wrap' });
      const transBtn = Utils.createElement('button', { className: 'btn btn-icon playlist-item-set-transition-btn', innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V6h2v12H4zm4 0V6h8v12H8zm10 0V6h2v12h-2z"/></svg>', attributes: { title: 'Set Outro Transition' }});
      const delBtn = Utils.createElement('button', { className: 'btn btn-icon btn-danger playlist-item-delete', innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>', attributes: { title: 'Remove from playlist' }});
      controls.appendChild(transBtn);
      controls.appendChild(delBtn);
      item.appendChild(controls);
      if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
        item.classList.add('current');
        thumb.appendChild(Utils.createElement('div', { className: 'playlist-item-playing-indicator', innerHTML: '<span>▶</span>' }));
      }
      const transition = state.playlist.transitions[index];
      if (transition) {
        const info = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transition.transitionId);
        transBtn.innerHTML = `<span style="font-size: 0.7em; color: var(--primary-color);">${info?.name.substring(0,1).toUpperCase() || 'T'}</span>`;
        transBtn.classList.add('has-transition');
      }
      return item;
    },
    createTransitionZone(index) {
      const zone = Utils.createElement('div', { className: 'playlist-transition-zone professional-style', attributes: { 'data-index': index, title: 'Click to add/edit transition' }});
      const transition = state.playlist.transitions[index];
      if (transition) {
        const info = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transition.transitionId);
        zone.innerHTML = `<div class="transition-display active professional-display"><span class="transition-icon-active">${info?.name.substring(0,1).toUpperCase() || 'T'}</span><span class="transition-name-active">${info?.name || 'Transition'}</span><span class="transition-duration-active">${transition.params.duration || ''}ms</span></div>`;
      } else {
        zone.innerHTML = `<div class="transition-add-placeholder professional-add"><svg class="transition-add-icon-svg" viewBox="0 0 20 20" width="18" height="18"><rect x="1" y="5" width="11" height="7" rx="1" fill-opacity="0.6"/><rect x="7" y="8" width="11" height="7" rx="1" fill-opacity="0.6"/><rect x="8" y="6.5" width="2" height="6" fill="rgba(255,255,255,0.9)"/><rect x="6" y="8.5" width="6" height="2" fill="rgba(255,255,255,0.9)"/></svg></div>`;
      }
      zone.addEventListener('click', (e) => { e.stopPropagation(); ContextualManager.showInlinePanel(e, index, 'transition', zone); });
      return zone;
    },
    updateControlButtons() {
      const shuffleBtn = document.getElementById('playlist-shuffle-button');
      if (shuffleBtn) shuffleBtn.classList.toggle('active', state.playlist.shuffle);
      const playBtn = document.getElementById('playlist-play-button');
      if (playBtn) playBtn.innerHTML = state.playlist.isPlaying ? '<span>⏸</span> Pause' : '<span>▶</span> Play All';
    }
  };

  // Storage Manager
  const StorageManager = {
    saveData() {
      try {
        const data = {
          media: state.mediaLibrary.map(({url, thumbnail, ...meta}) => ({...meta, settings: meta.settings || {effects:[]}})),
          playlist: { items: state.playlist.items, shuffle: state.playlist.shuffle, transitions: state.playlist.transitions || {} }
        };
        localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        Utils.showNotification('Error saving library.', 'error');
      }
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
      } catch (e) {
        localStorage.removeItem(CONSTANTS.STORAGE_KEY);
      }
    }
  };

  // Contextual Manager
  const ContextualManager = {
    showContextMenu(event, targetId, type, anchorElement) {
      this.hideContextMenu(); this.hideInlinePanel();
      if (type !== 'transition_per_clip') WallpaperApp.MenuTools.closePerClipTransitionsPanel();
      const menu = state.dom.contextMenuContainer;
      if (!menu) return;
      menu.innerHTML = '';
      menu.style.display = 'block';
      const rect = state.dom.importSubmenu.getBoundingClientRect();
      menu.style.left = `${event.clientX - rect.left}px`;
      menu.style.top = `${event.clientY - rect.top}px`;
      state.contextualEditing.contextMenuElement = menu;
      if (type === 'effect') {
        const btn = Utils.createElement('button', { textContent: 'Add/Edit Effect', className: 'context-menu-item', events: { click: () => { this.hideContextMenu(); this.showInlinePanel(event, targetId, 'effect', anchorElement); } } });
        menu.appendChild(btn);
      }
    },
    hideContextMenu() { if (state.contextualEditing.contextMenuElement) state.contextualEditing.contextMenuElement.style.display = 'none'; },
    showInlinePanel(event, targetId, type, anchor) {
      this.hideInlinePanel(); this.hideContextMenu(); WallpaperApp.MenuTools.closePerClipTransitionsPanel();
      const panel = state.dom.inlinePanelContainer;
      if (!panel) return;
      panel.innerHTML = '';
      panel.style.display = 'block';
      Object.assign(state.contextualEditing, { panelElement: panel, targetId, type, activeItem: null });
      if (anchor) {
        const anchorRect = anchor.getBoundingClientRect();
        const subRect = state.dom.importSubmenu.getBoundingClientRect();
        panel.style.top = `${anchorRect.bottom - subRect.top + 5}px`;
        panel.style.left = `${anchorRect.left - subRect.left}px`;
      }
      const title = type === 'effect' ? `Effects for Item` : `Transition at index ${targetId}`;
      panel.appendChild(Utils.createElement('div', { textContent: title, className: 'inline-panel-title' }));
      const itemsCont = Utils.createElement('div', { className: 'inline-panel-items' });
      const list = type === 'effect' ? CONSTANTS.AVAILABLE_EFFECTS : CONSTANTS.AVAILABLE_TRANSITIONS;
      list.forEach(item => {
        const btn = Utils.createElement('button', { textContent: item.name, className: 'inline-panel-item-button', events: { click: (e) => { itemsCont.querySelector('.selected')?.classList.remove('selected'); e.currentTarget.classList.add('selected'); state.contextualEditing.activeItem = item; this.populateInlinePanelControls(item, type, targetId); }}});
        itemsCont.appendChild(btn);
      });
      panel.appendChild(itemsCont);
      panel.appendChild(Utils.createElement('div', { id: 'inline-panel-controls', className: 'inline-panel-controls-container' }));
      const footer = Utils.createElement('div', { className: 'inline-panel-footer' });
      const applyBtn = Utils.createElement('button', { textContent: 'Apply', className: 'btn btn-primary btn-small' });
      applyBtn.addEventListener('click', () => type === 'effect' ? EffectsManager.applyEffect(targetId) : TransitionManager.applyTransitionFromInlinePanel(targetId));
      const closeBtn = Utils.createElement('button', { textContent: 'Close', className: 'btn btn-secondary btn-small' });
      closeBtn.addEventListener('click', () => this.hideInlinePanel());
      footer.appendChild(applyBtn);
      footer.appendChild(closeBtn);
      panel.appendChild(footer);
    },
    hideInlinePanel() { if (state.contextualEditing.panelElement) state.contextualEditing.panelElement.style.display = 'none'; },
    populateInlinePanelControls(item, type, targetId) {
      const controls = document.getElementById('inline-panel-controls');
      if (!controls) return;
      controls.innerHTML = '';
      let existingSettings = null;
      if (type === 'effect') {
        existingSettings = state.mediaLibrary.find(m => m.id === targetId)?.settings?.effects?.find(e => e.effectId === item.id);
      } else if (type === 'transition') {
        const trans = state.playlist.transitions[targetId];
        if (trans?.transitionId === item.id) existingSettings = trans;
      }
      item.params.forEach(param => {
        const group = Utils.createElement('div', { className: 'form-group inline-param-group' });
        group.appendChild(Utils.createElement('label', { textContent: param.name }));
        const currentVal = existingSettings?.params?.[param.id] ?? param.value;
        if (param.type === 'slider') {
          const input = Utils.createElement('input', { type: 'range', attributes: { min: param.min, max: param.max, value: currentVal, 'data-param-id': param.id }});
          const valSpan = Utils.createElement('span', { textContent: `${currentVal}${param.unit || ''}`});
          input.oninput = () => valSpan.textContent = `${input.value}${param.unit || ''}`;
          group.appendChild(input);
          group.appendChild(valSpan);
        }
        controls.appendChild(group);
      });
    }
  };

  // Effects & Transitions Managers
  const EffectsManager = {
    applyEffect(mediaId) {
      const media = state.mediaLibrary.find(m => m.id === mediaId);
      const effectDef = state.contextualEditing.activeItem;
      if (!media || !effectDef) return;
      const params = {};
      state.contextualEditing.panelElement?.querySelectorAll('[data-param-id]').forEach(el => params[el.dataset.paramId] = el.type === 'range' ? parseFloat(el.value) : el.value);
      if (!media.settings) media.settings = { effects: [] };
      media.settings.effects = media.settings.effects.filter(e => e.effectId !== effectDef.id);
      media.settings.effects.push({ effectId: effectDef.id, params });
      Utils.showNotification(`Effect ${effectDef.name} applied.`, 'success');
      StorageManager.saveData();
      MediaLibraryManager.updateUI();
      const PlayerEngine = WallpaperApp.getModule('PlayerEngine');
      const displayedElement = state.dom.mediaContainer.querySelector(`[data-media-id="${mediaId}"]`);
      if (PlayerEngine && displayedElement) PlayerEngine.applyEffectsToElement(displayedElement, media.settings.effects);
    },
    getParamsFor(itemId, itemType, container, targetId, targetType) {
      // This function populates L2 submenus for effects
      container.innerHTML = '';
      const list = itemType === 'effect' ? CONSTANTS.AVAILABLE_EFFECTS : CONSTANTS.AVAILABLE_TRANSITIONS;
      const def = list.find(d => d.id === itemId);
      if (!def) return;
      // ... (implementation for populating controls - can be simplified if not used immediately)
    }
  };
  const TransitionManager = {
    applyTransitionFromInlinePanel(playlistIndex) {
      const item = state.contextualEditing.activeItem;
      if (!item) return Utils.showNotification("No transition selected.", "error");
      const params = {};
      state.contextualEditing.panelElement.querySelectorAll('[data-param-id]').forEach(el => params[el.dataset.paramId] = el.type === 'range' ? parseFloat(el.value) : el.value);
      state.playlist.transitions[playlistIndex] = { transitionId: item.id, params };
      Utils.showNotification(`Transition ${item.name} applied.`, 'success');
      StorageManager.saveData();
      PlaylistManager.updateUI();
      ContextualManager.hideInlinePanel();
    },
    applyOutroTransition(index, transitionId) {
      const def = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionId);
      if (!def) return;
      const params = {};
      def.params.forEach(p => params[p.id] = p.value);
      state.playlist.transitions[index] = { transitionId, params };
      Utils.showNotification(`Transition '${def.name}' set.`, 'success');
      StorageManager.saveData();
      PlaylistManager.updateUI();
      WallpaperApp.MenuTools.closePerClipTransitionsPanel();
    },
    populatePerClipTransitions(index) {
      const listEl = state.dom.perClipTransitionsList;
      if (!listEl) return;
      listEl.innerHTML = '';
      state.contextualEditing.perClipTargetIndex = index;
      const currentTrans = state.playlist.transitions[index];
      CONSTANTS.AVAILABLE_TRANSITIONS.forEach(def => {
        const btn = Utils.createElement('button', { className: 'submenu-item', textContent: def.name, attributes: {'data-transition-id': def.id}});
        if (currentTrans?.transitionId === def.id) btn.classList.add('selected');
        btn.onclick = () => this.applyOutroTransition(index, def.id);
        listEl.appendChild(btn);
      });
      listEl.appendChild(Utils.createDivider());
      const removeBtn = Utils.createElement('button', { className: 'submenu-item btn-danger', textContent: 'Remove Transition' });
      if (!currentTrans) removeBtn.classList.add('disabled');
      removeBtn.onclick = () => {
        if (currentTrans) { delete state.playlist.transitions[index]; Utils.showNotification('Transition removed.', 'info'); StorageManager.saveData(); PlaylistManager.updateUI(); }
        WallpaperApp.MenuTools.closePerClipTransitionsPanel();
      };
      listEl.appendChild(removeBtn);
    }
  };

  // Event Handler
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
      state.dom.importSubmenu?.addEventListener('click', e => {
        if (e.target.closest('button[data-action="import-media-action"]')) state.fileInput?.click();
      });
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

  // Main initialization function
  const init = () => {
    console.log("[MediaManager] Initializing...");
    if (!DOMManager.initializeDOMReferences()) return;

    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
    if (!menuContent) {
      console.error("CRITICAL - .menu-content in import submenu not found.");
      return;
    }
    DOMManager.setupMediaImportUI(menuContent);
    StorageManager.loadData();
    EventHandler.setupGlobalEvents();

    // After MediaManager is set up, initialize PlayerEngine and give it access to state
    const PlayerEngine = WallpaperApp.getModule('PlayerEngine');
    if (PlayerEngine) {
      PlayerEngine.init(state, PlaylistManager);
    } else {
      console.error("FATAL: PlayerEngine module not found during MediaManager init.");
    }
    console.log("[MediaManager] Initialization complete.");
  };

  // Public API
  return {
    init,
    getState: () => state, // Expose state for PlayerEngine
    PlaylistManager, // Expose PlaylistManager for PlayerEngine
    getAvailableEffects: () => CONSTANTS.AVAILABLE_EFFECTS,
    getAvailableTransitions: () => CONSTANTS.AVAILABLE_TRANSITIONS,
    getParamsFor: EffectsManager.getParamsFor,
    populatePerClipTransitions: TransitionManager.populatePerClipTransitions,
  };
})();

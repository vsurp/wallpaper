/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Version 0.4.5 - Per-Clip Transitions Panel Logic (Syntax Double-Checked)
 */

const MediaModule = (() => {
  // Constants
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
    STORAGE_KEY_OLD: 'flStudioWallpaper_media_v6',
    VIDEO_METADATA_TIMEOUT: 10000,
    VIDEO_THUMBNAIL_TIMEOUT: 10000,
    AVAILABLE_EFFECTS: [
      { id: 'blur', name: 'Blur', params: [{ id: 'intensity', name: 'Intensity', type: 'slider', min: 0, max: 100, value: 50, unit: '%' }] },
      { id: 'grayscale', name: 'Grayscale', params: [{ id: 'intensity', name: 'Intensity', type: 'slider', min: 0, max: 100, value: 100, unit: '%' }] },
      { id: 'sepia', name: 'Sepia', params: [{ id: 'intensity', name: 'Intensity', type: 'slider', min: 0, max: 100, value: 100, unit: '%' }] },
      { id: 'brightness', name: 'Brightness', params: [{ id: 'level', name: 'Level', type: 'slider', min: 0, max: 200, value: 100, unit: '%' }] },
    ],
    AVAILABLE_TRANSITIONS: [
      { id: 'fade', name: 'Fade', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 100, max: 2000, value: 500, unit: 'ms' }] },
      { id: 'slide', name: 'Slide', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 100, max: 2000, value: 500, unit: 'ms' }, {id: 'direction', name: 'Direction', type: 'select', options: ['left', 'right', 'top', 'bottom'], value: 'left'}] },
      { id: 'zoom', name: 'Zoom', params: [{ id: 'duration', name: 'Duration', type: 'slider', min: 100, max: 2000, value: 700, unit: 'ms' }] },
    ]
  };

  // Application state
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
      lastTransitionTime: 0,
      playedInShuffle: new Set()
    },
    dom: {
      importSubmenu: null,
      mediaContainer: null,
      mediaGallery: null,
      playlistContainer: null,
      playlistControlsContainer: null,
      playbackControls: null,
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
    activeHighlight: {
      mediaId: null,
      sourceType: null
    },
    fileInput: null,
    activeVideoElement: null,
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

  // Initialization
  const init = () => {
    console.log("[MediaModule] init: Starting initialization.");
    try {
      state.dom.mainMenu = document.getElementById('main-menu');
      state.dom.contextMenuContainer = document.getElementById('context-menu-container');
      state.dom.inlinePanelContainer = document.getElementById('inline-panel-container');
      state.dom.mediaContainer = document.getElementById('media-container');
      state.dom.perClipTransitionsList = document.getElementById('per-clip-transitions-list');

      initMediaImporter();

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') state.selection.shiftKeyActive = true;
      });
      document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') state.selection.shiftKeyActive = false;
      });

      document.addEventListener('click', (e) => {
        if (state.contextualEditing.contextMenuElement &&
            state.contextualEditing.contextMenuElement.style.display !== 'none' &&
            !state.contextualEditing.contextMenuElement.contains(e.target) &&
            !e.target.closest('.media-thumbnail')) {
          hideContextMenu();
        }
        if (state.contextualEditing.panelElement &&
            state.contextualEditing.panelElement.style.display !== 'none' &&
            !state.contextualEditing.panelElement.contains(e.target) &&
            !e.target.closest('.media-thumbnail') &&
            !e.target.closest('.parameter-controls-container')) {
          hideInlinePanel();
        }
        const perClipPanel = document.getElementById('per-clip-transitions-panel');
        if (perClipPanel && perClipPanel.closest('.slide-left-panel-wrapper.active')) {
          if (!perClipPanel.contains(e.target) && !e.target.closest('.playlist-item-set-transition-btn')) {
            // Consider closing strategy here
          }
        }
      }, true);
      console.log("[MediaModule] init: Initialization complete.");
    } catch (error) {
      console.error("[MediaModule] init: CRITICAL ERROR during initialization:", error);
    }
  };

  const initMediaImporter = () => {
    console.log("[MediaModule] initMediaImporter: Starting.");
    try {
      state.dom.importSubmenu = document.getElementById('import-media-submenu');
      if (!state.dom.importSubmenu) {
        console.error("[MediaModule] initMediaImporter: CRITICAL - #import-media-submenu not found.");
        return;
      }
      if (!state.dom.mediaContainer) {
        console.error("[MediaModule] initMediaImporter: CRITICAL - #media-container for playback not found.");
      }
      const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
      if (!menuContent) {
        console.error("[MediaModule] initMediaImporter: CRITICAL - .menu-content not found in #import-media-submenu.");
        return;
      }
      setupMediaImportUI(menuContent);
      loadSavedMedia();
      setupGlobalEventDelegation();
      console.log("[MediaModule] initMediaImporter: Finished successfully.");
    } catch (error) {
      console.error("[MediaModule] initMediaImporter: CRITICAL ERROR:", error);
    }
  };

  const setupMediaImportUI = (menuContent) => {
    menuContent.innerHTML = '';
    setupFileInput();
    const importButton = createUIElement('button', {
      className: 'submenu-item import-media-button', textContent: 'IMPORT MEDIA',
      attributes: { 'data-action': 'import-media-action' },
    });
    menuContent.appendChild(importButton);
    menuContent.appendChild(createDivider());
    const mediaLibrarySection = createMediaLibrarySection();
    state.dom.mediaLibrarySection = mediaLibrarySection;
    menuContent.appendChild(mediaLibrarySection);
    menuContent.appendChild(createDivider());
    const playlistSection = createPlaylistSection();
    state.dom.playlistSection = playlistSection;
    menuContent.appendChild(playlistSection);
  };

  const setupFileInput = () => {
    if (state.fileInput && state.fileInput.parentNode) {
      state.fileInput.parentNode.removeChild(state.fileInput);
    }
    state.fileInput = createUIElement('input', {
      type: 'file', id: 'media-file-input',
      accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','),
      multiple: true, style: { display: 'none' },
      events: { change: (e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
    });
    document.body.appendChild(state.fileInput);
  };

  const createUIElement = (tag, options = {}) => {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;
    if (options.textContent) element.textContent = options.textContent;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.type) element.type = options.type;
    if (options.accept) element.accept = options.accept;
    if (options.multiple) element.multiple = options.multiple;
    if (options.style) Object.assign(element.style, options.style);
    if (options.attributes) Object.entries(options.attributes).forEach(([key, value]) => element.setAttribute(key, value));
    if (options.events) Object.entries(options.events).forEach(([event, handler]) => element.addEventListener(event, handler));
    return element;
  };

  const createDivider = () => createUIElement('hr', { className: 'divider' });

  const createMediaLibrarySection = () => {
    const section = createUIElement('div', { id: 'media-library-section' });
    const title = createUIElement('h3', { textContent: 'MEDIA LIBRARY' });
    const selectionInfo = createUIElement('div', { className: 'selection-info', textContent: 'Shift+Click or drag to select. Right-click for options.' });
    const gallery = createUIElement('div', { id: 'media-gallery' });
    setupGalleryDragSelection(gallery);
    state.dom.mediaEmptyState = createUIElement('div', { id: 'media-empty-state', textContent: 'Import media to get started.' });
    gallery.appendChild(state.dom.mediaEmptyState);
    section.appendChild(title);
    section.appendChild(selectionInfo);
    section.appendChild(gallery);
    state.dom.mediaGallery = gallery;
    return section;
  };

  const setupGalleryDragSelection = (gallery) => {
    let isSelecting = false; let galleryRect = null;
    gallery.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target !== gallery) return;
      hideContextMenu(); hideInlinePanel(); isSelecting = true;
      galleryRect = gallery.getBoundingClientRect();
      state.selection.startPoint = { x: e.clientX - galleryRect.left + gallery.scrollLeft, y: e.clientY - galleryRect.top + gallery.scrollTop };
      if (state.selection.selectionBoxElement) state.selection.selectionBoxElement.remove();
      state.selection.selectionBoxElement = createUIElement('div', { className: 'selection-box', style: { left: (state.selection.startPoint.x - gallery.scrollLeft) + 'px', top: (state.selection.startPoint.y - gallery.scrollTop) + 'px', width: '0px', height: '0px' }});
      gallery.appendChild(state.selection.selectionBoxElement);
      if (!state.selection.shiftKeyActive) clearSelection();
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isSelecting || !state.selection.selectionBoxElement || !galleryRect) return;
      const currentX = e.clientX - galleryRect.left + gallery.scrollLeft; const currentY = e.clientY - galleryRect.top + gallery.scrollTop;
      const x1 = Math.min(state.selection.startPoint.x, currentX); const y1 = Math.min(state.selection.startPoint.y, currentY);
      const x2 = Math.max(state.selection.startPoint.x, currentX); const y2 = Math.max(state.selection.startPoint.y, currentY);
      state.selection.selectionBoxElement.style.left = (x1 - gallery.scrollLeft) + 'px';
      state.selection.selectionBoxElement.style.top = (y1 - gallery.scrollTop) + 'px';
      state.selection.selectionBoxElement.style.width = (x2 - x1) + 'px';
      state.selection.selectionBoxElement.style.height = (y2 - y1) + 'px';
      const selectionRectDoc = { left: x1 + galleryRect.left - gallery.scrollLeft, top: y1 + galleryRect.top - gallery.scrollTop, right: x2 + galleryRect.left - gallery.scrollLeft, bottom: y2 + galleryRect.top - gallery.scrollTop };
      gallery.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
        const thumbnailRectDoc = thumbnail.getBoundingClientRect(); const mediaId = thumbnail.dataset.id;
        const intersects = !(thumbnailRectDoc.right < selectionRectDoc.left || thumbnailRectDoc.left > selectionRectDoc.right || thumbnailRectDoc.bottom < selectionRectDoc.top || thumbnailRectDoc.top > selectionRectDoc.bottom);
        if (intersects) { if (!state.selection.items.has(mediaId)) { addToSelection(mediaId); thumbnail.classList.add('selected'); }}
        else { if (state.selection.items.has(mediaId) && !state.selection.shiftKeyActive) { removeFromSelection(mediaId); thumbnail.classList.remove('selected'); }}
      });
    });
    document.addEventListener('mouseup', () => {
      if (!isSelecting) return; isSelecting = false; galleryRect = null;
      if (state.selection.selectionBoxElement) { state.selection.selectionBoxElement.remove(); state.selection.selectionBoxElement = null; }
      if (state.selection.items.size > 0) { state.selection.lastSelected = Array.from(state.selection.items).pop(); }
    });
  };

  const createPlaylistSection = () => {
    const section = createUIElement('div', { id: 'playlist-section' });
    const title = createUIElement('h3', { textContent: 'PLAYLIST' });
    const playlistContainer = createUIElement('div', { id: 'playlist-container' });
    playlistContainer.addEventListener('dragover', handlePlaylistDragOver);
    playlistContainer.addEventListener('drop', handlePlaylistDrop);
    playlistContainer.addEventListener('dragenter', (e) => { e.preventDefault(); playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)'; });
    playlistContainer.addEventListener('dragleave', (e) => { e.preventDefault(); playlistContainer.style.backgroundColor = ''; });
    state.dom.playlistEmptyState = createUIElement('div', { id: 'playlist-empty-state', textContent: 'Drag media here to create a playlist.' });
    playlistContainer.appendChild(state.dom.playlistEmptyState);
    section.appendChild(title);
    section.appendChild(playlistContainer);
    state.dom.playlistContainer = playlistContainer;
    const controlsContainer = createUIElement('div', { id: 'playlist-controls', style: { visibility: 'hidden' } });
    state.dom.playlistControlsContainer = controlsContainer;
    createPlaylistControls(controlsContainer);
    section.appendChild(controlsContainer);
    return section;
  };

  const createPlaylistControls = (controlsContainer) => {
    controlsContainer.innerHTML = '';
    const buttons = [
      { id: 'playlist-play-button', html: '<span style="filter: grayscale(100%);">▶</span> Play All', class: 'btn-primary' },
      { id: 'playlist-shuffle-button', html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle', class: 'btn-secondary' },
      { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', class: 'btn-danger' }
    ];
    buttons.forEach(btnData => {
      const button = createUIElement('button', { id: btnData.id, innerHTML: btnData.html, className: `btn playlist-button ${btnData.class || 'btn-secondary'}`});
      controlsContainer.appendChild(button);
    });
  };

  const setupGlobalEventDelegation = () => {
    if (state.dom.importSubmenu) {
      state.dom.importSubmenu.addEventListener('click', (e) => {
        const target = e.target.closest('button'); if (!target) return;
        if (target.matches('.import-media-button')) { if (state.fileInput) state.fileInput.click(); else console.error("MediaModule: File input not found.");}
      });
    }
    if (state.dom.mediaGallery) {
      state.dom.mediaGallery.addEventListener('click', (e) => {
        const thumbnail = e.target.closest('.media-thumbnail'); if (!thumbnail) return;
        hideContextMenu(); hideInlinePanel();
        const mediaId = thumbnail.dataset.id; const media = state.mediaLibrary.find(m => m.id === mediaId); if (!media) return;
        if (e.target.closest('.media-delete-btn')) { e.stopPropagation(); e.preventDefault(); handleMediaDelete(media); }
        else { handleThumbnailClick(e, media, thumbnail); }
      });
      state.dom.mediaGallery.addEventListener('contextmenu', (e) => {
        e.preventDefault(); const thumbnail = e.target.closest('.media-thumbnail');
        if (!thumbnail) { hideContextMenu(); return; }
        const mediaId = thumbnail.dataset.id; showContextMenu(e, mediaId, 'effect', thumbnail);
      });
    }
    if (state.dom.playlistControlsContainer) {
      state.dom.playlistControlsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button'); if (!target) return;
        if (target.matches('#playlist-play-button')) playPlaylist();
        else if (target.matches('#playlist-shuffle-button')) toggleShuffle();
        else if (target.matches('#playlist-clear-button')) confirmClearPlaylist();
      });
    }
    if (state.dom.playlistContainer) {
      state.dom.playlistContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.playlist-item');
        const transitionZone = e.target.closest('.playlist-transition-zone');
        const setTransitionBtn = e.target.closest('.playlist-item-set-transition-btn');

        if (setTransitionBtn) {
          e.stopPropagation();
          const playlistItemElement = setTransitionBtn.closest('.playlist-item');
          const index = parseInt(playlistItemElement.dataset.index, 10);
          const mediaId = playlistItemElement.dataset.id;
          const media = state.mediaLibrary.find(m => m.id === mediaId);
          if (media && typeof index === 'number') {
            WallpaperApp.MenuTools.openPerClipTransitionsPanel(index, media.name);
          }
        } else if (transitionZone) {
          e.stopPropagation(); const playlistIndex = parseInt(transitionZone.dataset.index, 10);
          if (!isNaN(playlistIndex)) showInlinePanel(e, playlistIndex, 'transition', transitionZone);
        } else if (item) {
          hideContextMenu(); hideInlinePanel();
          const mediaId = item.dataset.id; const index = parseInt(item.dataset.index, 10);
          const media = state.mediaLibrary.find(m => m.id === mediaId);
          if (e.target.closest('.playlist-item-delete')) { e.stopPropagation(); removeFromPlaylist(index); }
          else if (media) {
            if (state.playlist.isPlaying && state.playlist.currentIndex === index) pausePlaylist();
            else { state.playlist.currentIndex = index; playPlaylist(); updateActiveHighlight(media.id, 'playlist'); }
          }
        }
      });
    }
  };

  const showContextMenu = (event, targetId, type, anchorElement) => {
    hideContextMenu(); hideInlinePanel();
    if (type !== 'transition_per_clip') WallpaperApp.MenuTools.closePerClipTransitionsPanel();

    const menu = state.dom.contextMenuContainer; if (!menu) { console.error("Context menu container not found."); return; }
    menu.innerHTML = ''; menu.style.display = 'block';
    const importSubmenuRect = state.dom.importSubmenu.getBoundingClientRect();
    let x = event.clientX - importSubmenuRect.left; let y = event.clientY - importSubmenuRect.top;
    const menuWidth = 180; const menuHeight = 50;
    if (x + menuWidth > importSubmenuRect.width) x = importSubmenuRect.width - menuWidth - 5;
    if (y + menuHeight > importSubmenuRect.height) y = importSubmenuRect.height - menuHeight - 5;
    if (x < 0) x = 5; if (y < 0) y = 5;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    state.contextualEditing.contextMenuElement = menu;
    state.contextualEditing.targetId = targetId;
    state.contextualEditing.type = type;
    state.contextualEditing.activeItem = null;
    if (type === 'effect') {
      const editEffectsButton = createUIElement('button', { textContent: 'Add/Edit Effect', className: 'context-menu-item', events: { click: () => { hideContextMenu(); showInlinePanel(event, targetId, 'effect', anchorElement); }}});
      menu.appendChild(editEffectsButton);
    }
  };

  const hideContextMenu = () => {
    if (state.contextualEditing.contextMenuElement) { state.contextualEditing.contextMenuElement.style.display = 'none'; state.contextualEditing.contextMenuElement.innerHTML = ''; }
    state.contextualEditing.contextMenuElement = null;
  };

  const showInlinePanel = (event, targetId, type, anchorElement) => {
    hideInlinePanel(); hideContextMenu();
    WallpaperApp.MenuTools.closePerClipTransitionsPanel();

    const panel = state.dom.inlinePanelContainer; if (!panel) { console.error("Inline panel container not found."); return; }
    panel.innerHTML = ''; panel.style.display = 'block';
    state.contextualEditing.panelElement = panel;
    state.contextualEditing.targetId = targetId;
    state.contextualEditing.type = type;
    state.contextualEditing.activeItem = null;
    if (anchorElement && state.dom.importSubmenu) {
      const anchorRect = anchorElement.getBoundingClientRect(); const submenuRect = state.dom.importSubmenu.getBoundingClientRect();
      let panelTop = anchorRect.bottom - submenuRect.top + 5; let panelLeft = anchorRect.left - submenuRect.left;
      const panelWidth = 280; const panelHeightEstimate = 200;
      if (panelLeft + panelWidth > submenuRect.width) panelLeft = anchorRect.right - submenuRect.left - panelWidth;
      if (panelTop + panelHeightEstimate > submenuRect.height) panelTop = anchorRect.top - submenuRect.top - panelHeightEstimate - 5;
      if (panelLeft < 0) panelLeft = 5; if (panelTop < 0) panelTop = 5;
      panel.style.top = panelTop + 'px';
      panel.style.left = panelLeft + 'px';
    } else { panel.style.top = '50px'; panel.style.left = '50px'; }
    const mediaItemForTitle = type === 'effect' ? state.mediaLibrary.find(m=>m.id === targetId) : null;
    const titleText = type === 'effect' ? `Effects for ${mediaItemForTitle?.name || 'Item'}` : `Transition before item ${targetId + 1}`;
    const panelTitle = createUIElement('div', { textContent: titleText, className: 'inline-panel-title' });
    panel.appendChild(panelTitle);
    const itemsContainer = createUIElement('div', { className: 'inline-panel-items' });
    const itemsToList = type === 'effect' ? CONSTANTS.AVAILABLE_EFFECTS : CONSTANTS.AVAILABLE_TRANSITIONS;
    itemsToList.forEach(item => {
      const itemButton = createUIElement('button', { textContent: item.name, className: 'inline-panel-item-button', events: { click: (e) => { itemsContainer.querySelectorAll('.inline-panel-item-button.selected').forEach(btn => btn.classList.remove('selected')); e.currentTarget.classList.add('selected'); state.contextualEditing.activeItem = item; populateInlinePanelControls(item, type, targetId); }}});
      itemsContainer.appendChild(itemButton);
    });
    panel.appendChild(itemsContainer);
    const controlsContainer = createUIElement('div', { id: 'inline-panel-controls', className: 'inline-panel-controls-container'});
    panel.appendChild(controlsContainer);
    const applyButton = createUIElement('button', { textContent: 'Apply', className: 'btn btn-primary btn-small inline-panel-button-apply' });
    applyButton.addEventListener('click', () => {
      if (type === 'effect') applyEffect(targetId);
      else if (type === 'transition') applyTransitionFromInlinePanel(targetId);
    });
    const closeButton = createUIElement('button', { textContent: 'Close', className: 'btn btn-secondary btn-small' });
    closeButton.addEventListener('click', hideInlinePanel);
    const footer = createUIElement('div', {className: 'inline-panel-footer'});
    footer.appendChild(applyButton); footer.appendChild(closeButton); panel.appendChild(footer);
  };

  const populateInlinePanelControls = (selectedItem, type, targetId) => {
    const controlsContainer = document.getElementById('inline-panel-controls'); if (!controlsContainer) return;
    controlsContainer.innerHTML = '';
    let existingSettingsBundle = null;
    if (type === 'effect') {
      const mediaItem = state.mediaLibrary.find(m => m.id === targetId);
      if (mediaItem && mediaItem.settings && mediaItem.settings.effects) existingSettingsBundle = mediaItem.settings.effects.find(eff => eff.effectId === selectedItem.id);
    } else if (type === 'transition') {
      const transitionAtTarget = state.playlist.transitions[targetId];
      if (transitionAtTarget && transitionAtTarget.transitionId === selectedItem.id) existingSettingsBundle = transitionAtTarget;
    }
    selectedItem.params.forEach(param => {
      const paramGroup = createUIElement('div', { className: 'form-group inline-param-group' });
      const label = createUIElement('label', { textContent: param.name, attributes: {'for': `param-${param.id}`} });
      paramGroup.appendChild(label); let input;
      const currentValue = existingSettingsBundle?.params?.[param.id] !== undefined ? existingSettingsBundle.params[param.id] : param.value;
      if (param.type === 'slider') {
        input = createUIElement('input', { type: 'range', id: `param-${param.id}`, min: param.min, max: param.max, value: currentValue, attributes: { 'data-param-id': param.id }});
        const unitDisplay = param.unit || ''; const valueSpan = createUIElement('span', {textContent: `${currentValue}${unitDisplay}`, className: 'param-value-display'});
        input.addEventListener('input', (e) => { valueSpan.textContent = e.target.value + unitDisplay; });
        paramGroup.appendChild(input); paramGroup.appendChild(valueSpan);
      } else if (param.type === 'select') {
        input = createUIElement('select', { id: `param-${param.id}`, attributes: { 'data-param-id': param.id } });
        param.options.forEach(opt => { const optionEl = createUIElement('option', { textContent: opt, value: opt }); if (opt === currentValue) optionEl.selected = true; input.appendChild(optionEl); });
        paramGroup.appendChild(input);
      }
      controlsContainer.appendChild(paramGroup);
    });
  };

  const hideInlinePanel = () => {
    if (state.contextualEditing.panelElement) { state.contextualEditing.panelElement.style.display = 'none'; state.contextualEditing.panelElement.innerHTML = ''; }
    state.contextualEditing.panelElement = null; state.contextualEditing.active = false;
    state.contextualEditing.targetId = null; state.contextualEditing.type = null; state.contextualEditing.activeItem = null;
  };

  const applyEffect = (mediaId, effectIdToApply, paramsToApply) => {
    const mediaItem = state.mediaLibrary.find(m => m.id === mediaId);
    if (!mediaItem) return;

    const activeEffectItem = effectIdToApply ? CONSTANTS.AVAILABLE_EFFECTS.find(e => e.id === effectIdToApply) : state.contextualEditing.activeItem;
    const effectParams = paramsToApply || {};

    if (!effectIdToApply && !paramsToApply) {
      const panel = state.contextualEditing.panelElement;
      if (!panel || !activeEffectItem) {
        showNotification("No active effect selected or panel not found.", "error");
        return;
      }
      panel.querySelectorAll('#inline-panel-controls [data-param-id]').forEach(inputEl => {
        effectParams[inputEl.dataset.paramId] = inputEl.type === 'range' ? parseFloat(inputEl.value) : inputEl.value;
      });
    }
    if (!activeEffectItem) {
      showNotification("Effect definition not found.", "error");
      return;
    }
    const currentEffectId = activeEffectItem.id;

    if (!mediaItem.settings) mediaItem.settings = {};
    if (!mediaItem.settings.effects) mediaItem.settings.effects = [];
    mediaItem.settings.effects = mediaItem.settings.effects.filter(eff => eff.effectId !== currentEffectId);
    mediaItem.settings.effects.push({ effectId: currentEffectId, params: effectParams });
    showNotification(`Effect ${activeEffectItem.name} applied to ${mediaItem.name}.`, 'success');
    saveMediaList(); updateMediaGallery();
    const currentlyDisplayedElement = state.dom.mediaContainer.querySelector(`[src="${mediaItem.url}"], video[data-media-id="${mediaId}"]`);
    if (currentlyDisplayedElement) {
      const tempElement = createMediaElement(mediaItem, false, currentlyDisplayedElement.loop);
      if (tempElement && tempElement.style.filter) currentlyDisplayedElement.style.filter = tempElement.style.filter;
      else currentlyDisplayedElement.style.filter = 'none';
    }
  };

  const applyTransitionFromInlinePanel = (playlistIndex) => {
    const activeTransitionItem = state.contextualEditing.activeItem;
    const transitionParams = {};
    const panel = state.contextualEditing.panelElement;

    if (!panel || !activeTransitionItem) {
      showNotification("No active transition selected or panel not found.", "error");
      return;
    }
    panel.querySelectorAll('#inline-panel-controls [data-param-id]').forEach(inputEl => {
      transitionParams[inputEl.dataset.paramId] = inputEl.type === 'range' ? parseFloat(inputEl.value) : inputEl.value;
    });

    state.playlist.transitions[playlistIndex] = { transitionId: activeTransitionItem.id, params: transitionParams };
    showNotification(`Transition ${activeTransitionItem.name} applied before item ${playlistIndex + 1}.`, 'success');
    saveMediaList(); updatePlaylistUI();
    hideInlinePanel();
  };

  const applyOutroTransition = (playlistItemIndex, transitionId) => {
    const transitionDefinition = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionId);
    if (!transitionDefinition) {
      showNotification(`Transition definition for ID "${transitionId}" not found.`, "error");
      return;
    }

    const defaultParams = {};
    transitionDefinition.params.forEach(param => {
      defaultParams[param.id] = param.value;
    });

    state.playlist.transitions[playlistItemIndex] = {
      transitionId: transitionId,
      params: defaultParams
    };

    const mediaItem = state.mediaLibrary.find(m => m.id === state.playlist.items[playlistItemIndex]);
    showNotification(`Transition '${transitionDefinition.name}' set for '${mediaItem ? mediaItem.name : `item ${playlistItemIndex + 1`}'.`, 'success');
    saveMediaList();
    updatePlaylistUI();
    WallpaperApp.MenuTools.closePerClipTransitionsPanel();
    };


  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;
    let validCount = 0; let invalidCount = 0; const processingPromises = [];
    Array.from(files).forEach(file => {
      if (isFileSupported(file.type)) processingPromises.push(processFile(file).then(() => { validCount++; }).catch(err => { invalidCount++; console.error(`Error processing file "${file.name}":`, err); }));
      else { invalidCount++; console.warn(`File "${file.name}" (type: ${file.type}) is not supported.`);}
    });
    try { await Promise.all(processingPromises); } catch (error) { console.error("Error during Promise.all in handleFileSelect:", error); }
    if (validCount > 0) showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}.`, 'success');
    if (invalidCount > 0) showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} unsupported or failed.`, 'warning');
    updateMediaGallery(); updatePlaylistUI(); saveMediaList();
  };

  const isFileSupported = (type) => CONSTANTS.SUPPORTED_TYPES.video.includes(type) || CONSTANTS.SUPPORTED_TYPES.image.includes(type);

  const processFile = async (file) => {
    const id = generateMediaId(); const url = URL.createObjectURL(file);
    const type = CONSTANTS.SUPPORTED_TYPES.video.includes(file.type) ? 'video' : 'image';
    const mediaItem = { id, name: file.name, type, mimeType: file.type, size: file.size, url, dateAdded: Date.now(), thumbnail: null, settings: { effects: [] }};
    state.mediaLibrary.push(mediaItem);
    try { mediaItem.thumbnail = await generateThumbnail(mediaItem, file); }
    catch (err) { console.warn(`Error generating thumbnail for "${mediaItem.name}", using fallback. Error:`, err); mediaItem.thumbnail = createFallbackThumbnail(mediaItem.type); }
  };

  const generateMediaId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  const generateThumbnail = (mediaItem, file) => new Promise((resolve, reject) => {
    if (mediaItem.type === 'image') {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = (err) => { console.error(`Image thumbnail error for ${mediaItem.name}:`, err); reject(new Error(`FileReader error for ${mediaItem.name}`)); };
      reader.readAsDataURL(file);
    } else if (mediaItem.type === 'video') generateVideoThumbnail(mediaItem.url, mediaItem.name).then(resolve).catch(reject);
    else { console.error(`Unsupported type for thumbnail: ${mediaItem.type}`); reject(new Error(`Unsupported type: ${mediaItem.type}`));}
  });

  const generateVideoThumbnail = (videoUrl, videoName) => new Promise((resolve, reject) => {
    const video = document.createElement('video'); video.preload = 'metadata'; video.muted = true; video.crossOrigin = "anonymous";
    let thumbnailGenerated = false; let timeoutId = null;
    const cleanupAndResolve = (thumbnailUrl) => { if (timeoutId) clearTimeout(timeoutId); video.onloadedmetadata = null; video.onseeked = null; video.onerror = null; video.pause(); video.removeAttribute('src'); try { video.load(); } catch(e) {} resolve(thumbnailUrl); };
    const cleanupAndReject = (errorMsg) => { if (timeoutId) clearTimeout(timeoutId); video.onloadedmetadata = null; video.onseeked = null; video.onerror = null; video.pause(); video.removeAttribute('src'); try { video.load(); } catch(e) {} console.warn(errorMsg); reject(new Error(errorMsg)); };
    const generateFrame = () => {
      if (thumbnailGenerated) return; thumbnailGenerated = true;
      try {
        const canvas = document.createElement('canvas'); canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width; canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
        const ctx = canvas.getContext('2d'); if (!ctx) { cleanupAndReject(`No 2D context for ${videoName}`); return; }
        ctx.fillStyle = '#1A1A1A'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const vidAspect = video.videoWidth / video.videoHeight; const canvAspect = canvas.width / canvas.height;
          let drW, drH, oX, oY;
          if (vidAspect > canvAspect) { drH = canvas.width / vidAspect; drW = canvas.width; oY = (canvas.height - drH) / 2; oX = 0; }
          else { drW = canvas.height * vidAspect; drH = canvas.height; oX = (canvas.width - drW) / 2; oY = 0; }
          ctx.drawImage(video, oX, oY, drW, drH);
        } else console.warn(`Video dimensions 0 for ${videoName}.`);
        drawPlayButton(ctx, canvas.width, canvas.height); cleanupAndResolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (err) { cleanupAndReject(`Canvas thumbnail error for ${videoName}: ${err.message}`); }
    };
    video.onloadedmetadata = function() { if (video.duration && !isNaN(video.duration) && video.duration > 0) { try { video.currentTime = Math.min(1.0, video.duration / 3); } catch (e) { console.warn(`Seek error ${videoName}:`, e); generateFrame(); }} else generateFrame(); };
    video.onseeked = generateFrame;
    video.onerror = (e) => { const errDet = e.target?.error ? `Code: ${e.target.error.code}, Msg: ${e.target.error.message}` : (e.message || e.type || 'Unknown'); cleanupAndReject(`Video load error for thumb: ${videoName}. Error: ${errDet}`); };
    timeoutId = setTimeout(() => { if (!thumbnailGenerated) cleanupAndReject(`Thumb timeout ${videoName}`); }, CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT);
    try { video.src = videoUrl; } catch (e) { cleanupAndReject(`Video src set error for thumb: ${videoName}. Error: ${e.message}`); }
  });

  const createFallbackThumbnail = (type = 'media') => {
    const canvas = document.createElement('canvas'); canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width; canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
    const ctx = canvas.getContext('2d'); if (!ctx) return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#ccc'; ctx.font = `bold ${Math.min(canvas.height / 4, 20)}px Barlow, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (type === 'video') drawPlayButton(ctx, canvas.width, canvas.height, '#ccc'); else ctx.fillText(type.toUpperCase(), canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
  };

  const drawPlayButton = (ctx, width, height, color = 'rgba(255, 255, 255, 0.7)') => {
    ctx.fillStyle = color; const cX = width / 2; const cY = height / 2; const tS = Math.min(width, height) * 0.25;
    ctx.beginPath(); ctx.moveTo(cX - tS / 2, cY - tS * 0.866 / 2); ctx.lineTo(cX - tS / 2, cY + tS * 0.866 / 2); ctx.lineTo(cX + tS * 0.8, cY); ctx.closePath(); ctx.fill();
  };

  const updateMediaGallery = () => {
    const gallery = state.dom.mediaGallery; const emptyState = state.dom.mediaEmptyState;
    if (!gallery || !emptyState) { console.error("Media gallery/empty state DOM not found."); return; }
    emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
    const fragment = document.createDocumentFragment(); state.mediaLibrary.forEach(media => { fragment.appendChild(createMediaThumbnail(media)); });
    Array.from(gallery.children).forEach(child => { if (child !== emptyState && !child.classList.contains('selection-box')) gallery.removeChild(child); });
    gallery.appendChild(fragment); updateMediaSelectionUI();
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'library') updateActiveHighlight(state.activeHighlight.mediaId, 'library');
  };

  const createMediaThumbnail = (media) => {
    const thumbnail = createUIElement('div', { className: 'media-thumbnail', attributes: { 'data-id': media.id, draggable: 'true' }});
    thumbnail.addEventListener('dragstart', (e) => {
      if (state.selection.items.has(media.id) && state.selection.items.size > 1) e.dataTransfer.setData('application/json', JSON.stringify({ type: 'multiple-media', ids: Array.from(state.selection.items) }));
      else e.dataTransfer.setData('text/plain', media.id);
      e.dataTransfer.effectAllowed = 'copy'; thumbnail.classList.add('dragging');
    });
    thumbnail.addEventListener('dragend', () => thumbnail.classList.remove('dragging'));
    const imgContainer = createUIElement('div', { className: 'media-thumbnail-img-container', style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } : { backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white', fontWeight: 'bold' }});
    if (!media.thumbnail) imgContainer.textContent = media.type.charAt(0).toUpperCase();
    thumbnail.appendChild(imgContainer);
    if (media.settings?.effects?.length > 0) { const fxInd = createUIElement('div', {className: 'media-thumbnail-fx-indicator', textContent: 'FX'}); thumbnail.appendChild(fxInd); }
    const nameLabel = createUIElement('div', { className: 'media-thumbnail-name', textContent: media.name }); thumbnail.appendChild(nameLabel);
    const badge = createUIElement('div', { className: 'media-type-badge', textContent: media.type.toUpperCase() }); thumbnail.appendChild(badge);
    const deleteBtn = createUIElement('button', { className: 'media-delete-btn btn btn-icon btn-danger', innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>', attributes: { 'aria-label': `Delete ${media.name}` }});
    thumbnail.appendChild(deleteBtn); thumbnail.setAttribute('title', `${media.name}\n(Right-click for options)`);
    return thumbnail;
  };

  const handleMediaDelete = (media) => {
    const mediaId = media.id;
    if (state.selection.items.has(mediaId) && state.selection.items.size > 1) {
      const itemsToDelete = Array.from(state.selection.items);
      itemsToDelete.forEach(id => deleteMedia(id, true));
      clearSelection();
      showNotification(`${itemsToDelete.length} items deleted.`, 'info');
    } else {
      deleteMedia(mediaId);
    }
  };

  const handleThumbnailClick = (e, media, thumbnailElement) => {
    if (state.selection.shiftKeyActive && state.selection.lastSelected) selectRange(state.selection.lastSelected, media.id);
    else if (state.selection.shiftKeyActive) { clearSelection(); addToSelection(media.id); state.selection.lastSelected = media.id; }
    else if (e.ctrlKey || e.metaKey) { toggleSelection(media.id); state.selection.lastSelected = state.selection.items.has(media.id) ? media.id : null; }
    else {
      const wasSelected = state.selection.items.has(media.id); const multipleSelected = state.selection.items.size > 1;
      if (wasSelected && !multipleSelected) selectMedia(media, true);
      else { clearSelection(); addToSelection(media.id); state.selection.lastSelected = media.id; selectMedia(media, true); }
    }
    updateMediaSelectionUI();
  };

  const clearSelection = () => { state.selection.items.clear(); state.selection.lastSelected = null; updateMediaSelectionUI(); };
  const addToSelection = (mediaId) => state.selection.items.add(mediaId);
  const removeFromSelection = (mediaId) => state.selection.items.delete(mediaId);
  const toggleSelection = (mediaId) => { state.selection.items.has(mediaId) ? state.selection.items.delete(mediaId) : state.selection.items.add(mediaId); };
  const selectRange = (startId, endId) => {
    const allThumbs = Array.from(state.dom.mediaGallery.querySelectorAll('.media-thumbnail'));
    const startIdx = allThumbs.findIndex(t => t.dataset.id === startId); const endIdx = allThumbs.findIndex(t => t.dataset.id === endId);
    if (startIdx === -1 || endIdx === -1) return;
    const minIdx = Math.min(startIdx, endIdx); const maxIdx = Math.max(startIdx, endIdx);
    for (let i = minIdx; i <= maxIdx; i++) { const idInRange = allThumbs[i].dataset.id; if (idInRange) addToSelection(idInRange); }
    state.selection.lastSelected = endId;
  };
  const updateMediaSelectionUI = () => { if (!state.dom.mediaGallery) return; state.dom.mediaGallery.querySelectorAll('.media-thumbnail').forEach(thumb => { thumb.classList.toggle('selected', state.selection.items.has(thumb.dataset.id)); }); };

  const handlePlaylistDragOver = (e) => { e.preventDefault(); if (e.dataTransfer.types.includes('application/json')) e.dataTransfer.dropEffect = 'move'; else if (e.dataTransfer.types.includes('text/plain')) e.dataTransfer.dropEffect = 'copy'; else e.dataTransfer.dropEffect = 'none'; };
  const handlePlaylistDrop = (e) => {
    e.preventDefault(); e.currentTarget.style.backgroundColor = '';
    try {
      const jsonDataText = e.dataTransfer.getData('application/json');
      if (jsonDataText) {
        const jsonData = JSON.parse(jsonDataText);
        if (jsonData?.type === 'multiple-media' && Array.isArray(jsonData.ids)) {
          const targetEl = e.target.closest('.playlist-item, .playlist-transition-zone'); let insertAt = state.playlist.items.length;
          if (targetEl) { const isItem = targetEl.classList.contains('playlist-item'); const targetIdx = parseInt(targetEl.dataset.index || '0', 10); const tRect = targetEl.getBoundingClientRect(); const topHalf = e.clientY < tRect.top + tRect.height / 2; if (isItem) insertAt = topHalf ? targetIdx : targetIdx + 1; else insertAt = targetIdx; }
          jsonData.ids.reverse().forEach(id => addToPlaylist(id, insertAt)); showNotification(`Added ${jsonData.ids.length} items to playlist.`, 'success'); return;
        } else if (jsonData?.type === 'playlist-reorder') {
          const fromIdx = parseInt(jsonData.index); const targetEl = e.target.closest('.playlist-item, .playlist-transition-zone'); let toIdx = state.playlist.items.length -1;
          if (targetEl) { const isItem = targetEl.classList.contains('playlist-item'); toIdx = parseInt(targetEl.dataset.index || '0', 10); if (isItem) { const tRect = targetEl.getBoundingClientRect(); const topHalf = e.clientY < tRect.top + tRect.height / 2; if (!topHalf) toIdx++; } if (fromIdx < toIdx) toIdx--; }
          reorderPlaylistItem(fromIdx, toIdx); return;
        }
      }
      const mediaId = e.dataTransfer.getData('text/plain');
      if (mediaId) {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) {
          let insertAt = state.playlist.items.length; const targetEl = e.target.closest('.playlist-item, .playlist-transition-zone');
          if (targetEl) { const isItem = targetEl.classList.contains('playlist-item'); const targetIdx = parseInt(targetEl.dataset.index || '0', 10); if (isItem) { const tRect = targetEl.getBoundingClientRect(); const topHalf = e.clientY < tRect.top + tRect.height / 2; insertAt = topHalf ? targetIdx : targetIdx + 1; } else insertAt = targetIdx; }
          addToPlaylist(mediaId, insertAt);
        } else { console.warn(`Media ID "${mediaId}" not found.`); showNotification(`Dragged media not found.`, 'error');}
      }
    } catch (err) { console.error('Error in handlePlaylistDrop:', err); showNotification('Error adding to playlist.', 'error');}
  };

  const addToPlaylist = (mediaId, insertAtIndex = -1) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId); if (!media) { showNotification(`Media ${mediaId} not found.`, 'warning'); return; }
    const wasEmpty = state.playlist.items.length === 0;
    if (insertAtIndex === -1 || insertAtIndex >= state.playlist.items.length) state.playlist.items.push(mediaId);
    else {
      state.playlist.items.splice(insertAtIndex, 0, mediaId);
      if (state.playlist.isPlaying && insertAtIndex <= state.playlist.currentIndex) state.playlist.currentIndex++;
      // Adjust transitions object keys if inserting in the middle
      const newTransitions = {};
      Object.keys(state.playlist.transitions).sort((a, b) => parseInt(b) - parseInt(a)).forEach(keyStr => {
          const oldKey = parseInt(keyStr);
          const transData = state.playlist.transitions[oldKey];
          if (oldKey >= insertAtIndex) {
              newTransitions[oldKey + 1] = transData; // Shift transitions for items after insertion point
          } else {
              newTransitions[oldKey] = transData;
          }
      });
      state.playlist.transitions = newTransitions;
    }
    if (wasEmpty && state.playlist.items.length > 0) state.playlist.currentIndex = 0;
    updatePlaylistUI(); saveMediaList(); showNotification(`Added to playlist: ${media.name}`, 'success');
  };

  const removeFromPlaylist = (index) => {
    if (index < 0 || index >= state.playlist.items.length) return;
    state.playlist.items.splice(index, 1);
    // Remove the transition associated with the removed item and shift subsequent ones
    const newTransitions = {};
    for (const key in state.playlist.transitions) {
        const oldKey = parseInt(key);
        if (oldKey === index) continue; // Skip the transition for the removed item
        if (oldKey > index) {
            newTransitions[oldKey - 1] = state.playlist.transitions[key]; // Shift down
        } else {
            newTransitions[oldKey] = state.playlist.transitions[key];
        }
    }
    state.playlist.transitions = newTransitions;

    if (state.playlist.isPlaying) {
      if (index === state.playlist.currentIndex) { if (state.playlist.items.length > 0) { state.playlist.currentIndex = Math.min(index, state.playlist.items.length - 1); playMediaByIndex(state.playlist.currentIndex); } else stopPlaylist(); }
      else if (index < state.playlist.currentIndex) state.playlist.currentIndex--;
    } else {
      if (state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = Math.max(0, state.playlist.items.length - 1);
      else if (index < state.playlist.currentIndex) state.playlist.currentIndex--; // Decrement if removed item was before current
      if (state.playlist.items.length === 0) state.playlist.currentIndex = -1;
    }
    updatePlaylistUI(); saveMediaList();
  };

  const reorderPlaylistItem = (fromIndex, toIndex) => {
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length || toIndex < 0 || toIndex > state.playlist.items.length || fromIndex === toIndex) return;
    try {
      const itemToMove = state.playlist.items.splice(fromIndex, 1)[0];
      state.playlist.items.splice(toIndex, 0, itemToMove);

      // Re-key transitions object
      const oldTransitions = JSON.parse(JSON.stringify(state.playlist.transitions));
      const newTransitions = {};
      // const movedItemTransition = oldTransitions[fromIndex]; // Transition associated with the item being moved

      // Create a map of oldIndex -> newIndex
      const indexMap = {};
      let currentOldIdx = 0;
      for (let newIdx = 0; newIdx < state.playlist.items.length; newIdx++) {
          if (newIdx === toIndex && state.playlist.items[newIdx] === itemToMove) { // This is the moved item's new position
              indexMap[fromIndex] = newIdx;
          } else {
              if (currentOldIdx === fromIndex) currentOldIdx++; // Skip the original position of the moved item
              if(currentOldIdx < state.playlist.items.length +1 ) { // Check boundary
                indexMap[currentOldIdx] = newIdx;
                currentOldIdx++;
              }
          }
      }

      // Apply transitions to new keys
      for (const oldKeyStr in oldTransitions) {
          const oldKey = parseInt(oldKeyStr);
          const newKey = indexMap[oldKey];
          if (newKey !== undefined && oldTransitions[oldKey]) {
              newTransitions[newKey] = oldTransitions[oldKey];
          }
      }
      state.playlist.transitions = newTransitions;


      if (state.playlist.currentIndex === fromIndex) state.playlist.currentIndex = toIndex;
      else if (state.playlist.currentIndex > fromIndex && state.playlist.currentIndex <= toIndex) state.playlist.currentIndex--;
      else if (state.playlist.currentIndex < fromIndex && state.playlist.currentIndex >= toIndex) state.playlist.currentIndex++;
      updatePlaylistUI(); saveMediaList();
    } catch (e) { console.error('Error reordering playlist item:', e); }
  };

  const confirmClearPlaylist = () => {
    if (state.playlist.items.length === 0) { showNotification('Playlist is already empty.', 'info'); return; }
    if (typeof WallpaperApp !== 'undefined' && WallpaperApp.UI?.showModal) WallpaperApp.UI.showModal({ id: 'confirm-clear-playlist-modal', title: 'Confirm Clear Playlist', content: 'Are you sure you want to clear the entire playlist? This action cannot be undone.', footerButtons: [{ text: 'Clear', classes: 'btn-danger', onClick: () => { clearPlaylistLogic(); return true; } }, { text: 'Cancel', classes: 'btn-secondary', onClick: () => true }]});
    else if (confirm('Are you sure you want to clear the entire playlist?')) clearPlaylistLogic();
  };

  const clearPlaylistLogic = () => { try { stopPlaylist(); state.playlist.items = []; state.playlist.transitions = {}; state.playlist.currentIndex = -1; state.playlist.playedInShuffle.clear(); updatePlaylistUI(); saveMediaList(); showNotification('Playlist cleared.', 'info'); } catch (e) { console.error('Error in clearPlaylistLogic:', e); }};

  const selectMedia = (media, loopSingle = false) => {
    stopPlaylist(false); clearMediaDisplay();
    const element = createMediaElement(media, !loopSingle, loopSingle);
    if (element) {
      state.dom.mediaContainer.appendChild(element); showNotification(`Playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');
      state.playlist.isPlaying = !loopSingle;
      if (loopSingle) { state.playlist.currentIndex = -1; updateActiveHighlight(media.id, 'library'); }
      else { const playlistIdx = state.playlist.items.indexOf(media.id); if (playlistIdx !== -1) { state.playlist.currentIndex = playlistIdx; updateActiveHighlight(media.id, 'playlist'); } else updateActiveHighlight(media.id, 'library'); }
      updatePlaylistUI();
    } else showNotification(`Cannot play ${media.name}.`, 'error');
  };

  const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
    let element; if (!media || !media.type || !media.url) { console.error("Invalid media data for element.", media); return null; }
    state.activeVideoElement = null;
    if (media.type === 'image') {
      element = createUIElement('img', { src: media.url, alt: media.name, style: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' } });
      if (isPlaylistContext) { clearPlaybackTimers(); state.playlist.playbackTimer = setTimeout(() => { if (state.playlist.isPlaying) playNextItem(); }, CONSTANTS.IMAGE_DISPLAY_DURATION); }
    } else if (media.type === 'video') {
      element = document.createElement('video'); element.src = media.url; element.autoplay = true; element.loop = loopOverride; element.muted = true; element.dataset.mediaId = media.id;
      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });
      element.addEventListener('error', function(e) { console.error(`Error loading video: ${media.name}`, e.target.error); if (isPlaylistContext && state.playlist.isPlaying) setTimeout(() => playNextItem(), 100);});
      if (isPlaylistContext && !loopOverride) element.addEventListener('ended', () => { if (state.playlist.isPlaying) playNextItem(); });
      state.activeVideoElement = element;
    }
    if (media.settings?.effects?.length > 0 && element) {
      let filterString = ""; media.settings.effects.forEach(eff => { const pVal = eff.params?.intensity !== undefined ? eff.params.intensity : (eff.params?.level !== undefined ? eff.params.level : null); const intensity = pVal !== null ? parseFloat(pVal) : 100; if (eff.effectId === 'blur' && !isNaN(intensity)) filterString += `blur(${intensity/10}px) `; if (eff.effectId === 'grayscale' && !isNaN(intensity)) filterString += `grayscale(${intensity}%) `; if (eff.effectId === 'sepia' && !isNaN(intensity)) filterString += `sepia(${intensity}%) `; if (eff.effectId === 'brightness' && !isNaN(intensity)) filterString += `brightness(${intensity}%) `; });
      element.style.filter = filterString.trim() || 'none';
    } else if (element) element.style.filter = 'none';
    return element;
  };

  const playPlaylist = () => {
    if (state.playlist.items.length === 0) { showNotification('Playlist is empty.', 'info'); return; }
    if (state.playlist.isPlaying) { pausePlaylist(); return; }
    clearPlaybackTimers(); state.playlist.advancingInProgress = false; state.playlist.isPlaying = true;
    if (state.playlist.shuffle) { state.playlist.playedInShuffle.clear(); if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length); const currentMediaIdShuffle = state.playlist.items[state.playlist.currentIndex]; if(currentMediaIdShuffle) state.playlist.playedInShuffle.add(currentMediaIdShuffle); }
    else { if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = 0; }
    clearMediaDisplay(); playMediaByIndex(state.playlist.currentIndex); updatePlaylistUI();
  };

  const pausePlaylist = () => { state.playlist.isPlaying = false; clearPlaybackTimers(); const videoEl = state.activeVideoElement || state.dom.mediaContainer.querySelector('video'); if (videoEl && !videoEl.paused) videoEl.pause(); updatePlaylistUI(); showNotification("Playlist stopped.", "info"); };

  const playMediaByIndex = (index) => {
    if (index < 0 || index >= state.playlist.items.length) { if (state.playlist.items.length > 0) { index = 0; state.playlist.currentIndex = 0; } else { stopPlaylist(); return; }}
    const mediaId = state.playlist.items[index]; const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) { showNotification(`Media "${mediaId}" not found. Skipping.`, 'warning'); if (state.playlist.isPlaying) { state.playlist.items.splice(index, 1); if (index <= state.playlist.currentIndex) state.playlist.currentIndex--; if (state.playlist.items.length === 0) { stopPlaylist(); return; } const nextIdxTry = Math.max(0, Math.min(index, state.playlist.items.length - 1)); playNextItem(nextIdxTry); } return; }

    state.playlist.currentIndex = index;
    state.playlist.isPlaying = true;

    const oldElement = state.dom.mediaContainer.firstChild;
    const newElement = createMediaElement(media, true);

    if (!newElement) { showNotification(`Error playing ${media.name}. Skipping.`, "error"); if (state.playlist.isPlaying) setTimeout(() => playNextItem(), 100); return; }

    const transitionData = state.playlist.transitions[index];

    if (oldElement && transitionData && CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionData.transitionId)) {
      newElement.style.opacity = '0'; state.dom.mediaContainer.appendChild(newElement);
      const duration = transitionData.params.duration || 500;
      oldElement.style.transition = `opacity ${duration / 2}ms ease-out`; newElement.style.transition = `opacity ${duration / 2}ms ease-in ${duration / 2}ms`;
      requestAnimationFrame(() => { oldElement.style.opacity = '0'; newElement.style.opacity = '1'; });
      setTimeout(() => { if (oldElement.parentNode) oldElement.parentNode.removeChild(oldElement); if (newElement.tagName.toLowerCase() === 'video') newElement.play().catch(e => console.warn("Autoplay prevented:", e)); }, duration);
      state.playlist.lastTransitionTime = Date.now();
    } else { clearMediaDisplay(); state.dom.mediaContainer.appendChild(newElement); if (newElement.tagName.toLowerCase() === 'video') newElement.play().catch(e => console.warn("Autoplay prevented:", e)); }
    updateActiveHighlight(media.id, 'playlist'); if (state.playlist.shuffle) state.playlist.playedInShuffle.add(mediaId);
    updatePlaylistUI();
  };

  const playNextItem = (startIndex = -1) => {
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) { stopPlaylist(); return; }
    if (state.playlist.advancingInProgress) return;
    state.playlist.advancingInProgress = true; clearPlaybackTimers(); let nextIndex;

    if (state.playlist.shuffle) { if (state.playlist.playedInShuffle.size >= state.playlist.items.length) state.playlist.playedInShuffle.clear(); const available = state.playlist.items.filter(id => !state.playlist.playedInShuffle.has(id)); if (available.length === 0) { state.playlist.playedInShuffle.clear(); nextIndex = Math.floor(Math.random() * state.playlist.items.length); } else { const randomAvailId = available[Math.floor(Math.random() * available.length)]; nextIndex = state.playlist.items.indexOf(randomAvailId); }}
    else { nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length; }
    if (startIndex !== -1 && startIndex >= 0 && startIndex < state.playlist.items.length) nextIndex = startIndex;

    state.playlist.currentIndex = nextIndex;
    playMediaByIndex(nextIndex);

    setTimeout(() => { state.playlist.advancingInProgress = false; }, 200);
  };


  const clearPlaybackTimers = () => { if (state.playlist.playbackTimer) { clearTimeout(state.playlist.playbackTimer); state.playlist.playbackTimer = null; }};
  const toggleShuffle = () => { state.playlist.shuffle = !state.playlist.shuffle; if (state.playlist.shuffle) { state.playlist.playedInShuffle.clear(); if (state.playlist.isPlaying && state.playlist.items.length > 0 && state.playlist.currentIndex >=0) { const currentMediaIdShuffle = state.playlist.items[state.playlist.currentIndex]; if(currentMediaIdShuffle) state.playlist.playedInShuffle.add(currentMediaIdShuffle); }} updatePlaylistUI(); saveMediaList(); showNotification(state.playlist.shuffle ? 'Shuffle: On' : 'Shuffle: Off', 'info'); };
  const stopPlaylist = (resetIndexAndDisplay = true) => { state.playlist.isPlaying = false; clearPlaybackTimers(); const videoEl = state.activeVideoElement || state.dom.mediaContainer.querySelector('video'); if (videoEl) videoEl.pause(); if (resetIndexAndDisplay) { state.playlist.currentIndex = -1; clearMediaDisplay(); updateActiveHighlight(null); } state.playlist.playedInShuffle.clear(); updatePlaylistUI(); state.activeVideoElement = null; };
  const clearMediaDisplay = () => { try { clearPlaybackTimers(); state.activeVideoElement = null; const container = state.dom.mediaContainer; while (container.firstChild) { const el = container.firstChild; if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) { el.pause(); el.removeAttribute('src'); el.load(); } container.removeChild(el); }} catch (e) { console.error("Error clearing media display:", e); if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = ''; }};

  const deleteMedia = (id, suppressNotification = false) => {
    const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id); if (indexInLibrary === -1) return;
    const mediaToDelete = state.mediaLibrary[indexInLibrary];
    if (mediaToDelete.url && mediaToDelete.url.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.url);
    if (mediaToDelete.thumbnail && mediaToDelete.thumbnail.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.thumbnail);
    state.mediaLibrary.splice(indexInLibrary, 1);
    let wasPlayingDeletedItem = false; let deletedItemOriginalPlaylistIndex = -1;

    const newPlaylistItems = [];
    const newTransitions = {};
    let newCurrentIndex = state.playlist.currentIndex;

    for (let i = 0; i < state.playlist.items.length; i++) {
        if (state.playlist.items[i] === id) {
            if (state.playlist.isPlaying && i === state.playlist.currentIndex) {
                wasPlayingDeletedItem = true;
                deletedItemOriginalPlaylistIndex = i;
            }
            if (i < newCurrentIndex) {
                newCurrentIndex--;
            }
        } else {
            const newItemIndex = newPlaylistItems.length;
            newPlaylistItems.push(state.playlist.items[i]);
            if (state.playlist.transitions[i]) {
                newTransitions[newItemIndex] = state.playlist.transitions[i];
            }
        }
    }
    state.playlist.items = newPlaylistItems;
    state.playlist.transitions = newTransitions;
    state.playlist.currentIndex = newCurrentIndex;


    if (wasPlayingDeletedItem) { if (state.playlist.items.length > 0) { state.playlist.currentIndex = Math.min(deletedItemOriginalPlaylistIndex, state.playlist.items.length - 1); playMediaByIndex(state.playlist.currentIndex); } else stopPlaylist(); }
    else if (state.playlist.currentIndex >= state.playlist.items.length && state.playlist.items.length > 0) state.playlist.currentIndex = state.playlist.items.length - 1;
    else if (state.playlist.items.length === 0) { state.playlist.currentIndex = -1; stopPlaylist(); }

    const currentMediaEl = state.dom.mediaContainer.querySelector(`[src="${mediaToDelete.url}"], video[data-media-id="${id}"]`);
    if (currentMediaEl) { clearMediaDisplay(); updateActiveHighlight(null); }
    if (state.mediaLibrary.length === 0) clearPlaylistLogic(); else updatePlaylistUI();
    updateMediaGallery(); saveMediaList();
    if (!suppressNotification) showNotification(`Deleted: ${mediaToDelete.name}`, 'info');
    clearSelection();
  };

  const createTransitionZone = (index) => {
    const zone = createUIElement('div', { className: 'playlist-transition-zone professional-style', attributes: { 'data-index': index.toString(), title: 'Click to add or edit transition' }});
    const transitionData = state.playlist.transitions[index];
    if (transitionData) {
      const transInfo = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionData.transitionId);
      const transDisplay = createUIElement('div', { className: 'transition-display active professional-display', innerHTML: `<span class="transition-icon-active">${transInfo?.name.substring(0,1).toUpperCase() || 'T'}</span><span class="transition-name-active">${transInfo?.name || 'Transition'}</span><span class="transition-duration-active">${transitionData.params.duration || 'N/A'}ms</span>`});
      zone.appendChild(transDisplay);
    } else {
      const addBtn = createUIElement('div', { className: 'transition-add-placeholder professional-add', innerHTML: `<svg class="transition-add-icon-svg" viewBox="0 0 20 20" width="18" height="18" fill="currentColor" style="display: block; margin: auto; opacity: 0.7;"><rect x="1" y="5" width="11" height="7" rx="1" ry="1" fill-opacity="0.6"/><rect x="7" y="8" width="11" height="7" rx="1" ry="1" fill-opacity="0.6"/><rect x="8" y="6.5" width="2" height="6" fill="rgba(255,255,255,0.9)"/><rect x="6" y="8.5" width="6" height="2" fill="rgba(255,255,255,0.9)"/></svg>`});
    zone.appendChild(addBtn);
    }
  zone.addEventListener('click', (e) => { e.stopPropagation(); showInlinePanel(e, index, 'transition', zone); });
  return zone;
};

const updatePlaylistUI = () => {
  const playlistCont = state.dom.playlistContainer; const emptySt = state.dom.playlistEmptyState; const controlsCont = state.dom.playlistControlsContainer;
  if (!playlistCont || !emptySt || !controlsCont) { console.error("Playlist UI elements missing."); return; }
  const fragment = document.createDocumentFragment();
  if (state.playlist.items.length === 0) { emptySt.style.display = 'block'; controlsCont.style.visibility = 'hidden'; }
  else {
    emptySt.style.display = 'none'; controlsCont.style.visibility = 'visible';
    state.playlist.items.forEach((mediaId, index) => {
      const transitionZone = createTransitionZone(index);
      fragment.appendChild(transitionZone);

      const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (media) fragment.appendChild(createPlaylistItem(media, index));
    });
    if (state.playlist.items.length > 0) {
      const finalTransitionZone = createTransitionZone(state.playlist.items.length);
      fragment.appendChild(finalTransitionZone);
    }
  }
  Array.from(playlistCont.querySelectorAll('.playlist-item, .playlist-transition-zone')).forEach(child => child.remove());
  playlistCont.appendChild(fragment);
  const shuffleBtn = document.getElementById('playlist-shuffle-button'); if (shuffleBtn) { shuffleBtn.classList.toggle('active', state.playlist.shuffle); shuffleBtn.innerHTML = state.playlist.shuffle ? '<span style="filter: grayscale(0%); color: var(--primary-color);">🔀</span> Shuffle On' : '<span style="filter: grayscale(100%);">🔀</span> Shuffle Off'; }
  const playBtn = document.getElementById('playlist-play-button'); if (playBtn) playBtn.innerHTML = state.playlist.isPlaying ? '<span style="filter: grayscale(100%);">⏸</span> Pause' : '<span style="filter: grayscale(100%);">▶</span> Play All';
  if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'playlist') updateActiveHighlight(state.activeHighlight.mediaId, 'playlist');
};

const createPlaylistItem = (media, index) => {
  const item = createUIElement('div', { className: 'playlist-item', attributes: { 'data-id': media.id, 'data-index': index.toString(), draggable: 'true' }});
  item.addEventListener('dragstart', function(e) { e.dataTransfer.setData('application/json', JSON.stringify({ type: 'playlist-reorder', id: media.id, index: index })); e.dataTransfer.effectAllowed = 'move'; this.classList.add('dragging'); });
  item.addEventListener('dragend', function() { this.classList.remove('dragging'); });
  const thumbDiv = createUIElement('div', { className: 'playlist-item-thumbnail', style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } : { backgroundColor: '#333' } });
  if (!media.thumbnail) thumbDiv.textContent = media.type.charAt(0).toUpperCase(); item.appendChild(thumbDiv);
  const infoCont = createUIElement('div', { className: 'playlist-item-info' });
  const nameEl = createUIElement('div', { className: 'playlist-item-name', textContent: media.name });
  const detailsEl = createUIElement('div', { className: 'playlist-item-details', textContent: `${media.type.charAt(0).toUpperCase() + media.type.slice(1)} · ${formatFileSize(media.size)}` });
  infoCont.appendChild(nameEl); infoCont.appendChild(detailsEl); item.appendChild(infoCont);

  const controlsWrap = createUIElement('div', {className: 'playlist-item-controls-wrap'});

  const setTransitionButton = createUIElement('button', {
    className: 'btn btn-icon playlist-item-set-transition-btn',
    innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V6h2v12H4zm4 0V6h8v12H8zm10 0V6h2v12h-2z"></path></svg>',
    attributes: { 'aria-label': `Set transition for ${media.name}`, title: 'Set Outro Transition' }
  });
  controlsWrap.appendChild(setTransitionButton);

  const deleteBtn = createUIElement('button', { className: 'btn btn-icon btn-danger playlist-item-delete', innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>', attributes: { 'aria-label': `Remove ${media.name} from playlist` } });
  controlsWrap.appendChild(deleteBtn);
  item.appendChild(controlsWrap);

  if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
    item.classList.add('current');
    const playingInd = createUIElement('div', { className: 'playlist-item-playing-indicator', innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>' });
    thumbDiv.appendChild(playingInd);
  }

  const outroTransitionData = state.playlist.transitions[index];
  if (outroTransitionData) {
    const transInfo = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === outroTransitionData.transitionId);
    setTransitionButton.innerHTML = `<span style="font-size: 0.7em; color: var(--primary-color);">${transInfo ? transInfo.name.substring(0,1).toUpperCase() : 'T'}</span>`;
    setTransitionButton.title = `Transition: ${transInfo ? transInfo.name : 'Custom'}`;
    setTransitionButton.classList.add('has-transition');
  }

  return item;
};

const updateActiveHighlight = (mediaId, sourceType) => {
  removeAllActiveHighlights(); if (!mediaId) { state.activeHighlight.mediaId = null; state.activeHighlight.sourceType = null; return; }
  state.activeHighlight.mediaId = mediaId; state.activeHighlight.sourceType = sourceType; let elementToHighlight;
  if (sourceType === 'library') { if (state.dom.mediaGallery) elementToHighlight = state.dom.mediaGallery.querySelector(`.media-thumbnail[data-id="${mediaId}"]`); }
  else if (sourceType === 'playlist') {
    if (state.dom.playlistContainer) {
      const playlistElements = state.dom.playlistContainer.querySelectorAll('.playlist-item');
      playlistElements.forEach((el) => {
        if (el.dataset.id === mediaId) { elementToHighlight = el; el.classList.add('current'); const thumbDiv = el.querySelector('.playlist-item-thumbnail'); if (state.playlist.isPlaying && thumbDiv) { const exInd = thumbDiv.querySelector('.playlist-item-playing-indicator'); if (!exInd) { const newInd = createUIElement('div', { className: 'playlist-item-playing-indicator', innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>' }); thumbDiv.appendChild(newInd); }}}
        else { el.classList.remove('current'); const indicator = el.querySelector('.playlist-item-playing-indicator'); if (indicator) indicator.remove(); }
      });
    }
  }
  if (elementToHighlight) elementToHighlight.classList.add('playing-from-here');
};

const removeAllActiveHighlights = () => { document.querySelectorAll('.media-thumbnail.playing-from-here, .playlist-item.playing-from-here').forEach(el => el.classList.remove('playing-from-here')); if(state.dom.playlistContainer) { state.dom.playlistContainer.querySelectorAll('.playlist-item.current').forEach(el => { el.classList.remove('current'); const indicator = el.querySelector('.playlist-item-playing-indicator'); if (indicator) indicator.remove(); }); }};

const saveMediaList = () => { try { const mediaForStorage = state.mediaLibrary.map(media => { const { url, thumbnail, ...mediaMeta } = media; return { ...mediaMeta, originalUrlExists: !!url, originalThumbnailExists: !!thumbnail, settings: media.settings || {effects: []} }; }); const storageData = { media: mediaForStorage, playlist: { items: state.playlist.items, shuffle: state.playlist.shuffle, transitions: state.playlist.transitions || {} } }; localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(storageData)); } catch (e) { console.error('Failed to save media list:', e); showNotification('Error saving library.', 'error');}};
const loadSavedMedia = () => { try { const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY); if (!saved) { const oldSaved = localStorage.getItem(CONSTANTS.STORAGE_KEY_OLD); if (oldSaved) { try { const oldParsed = JSON.parse(oldSaved); if (oldParsed.media?.length > 0) showNotification(`Found old library data. Re-import files.`, 'warning', 10000); localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD); } catch (oldErr) { console.warn("Error parsing old data, removing:", oldErr); localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD); }} updateMediaGallery(); updatePlaylistUI(); return; } const parsed = JSON.parse(saved); if (parsed.media?.length > 0) showNotification(`Loaded metadata for ${parsed.media.length} entries. Re-import files.`, 'info', 7000); state.mediaLibrary = (parsed.media || []).map(media => ({ ...media, url: null, thumbnail: createFallbackThumbnail(media.type), settings: media.settings || { effects: [] } })); state.playlist.items = parsed.playlist?.items || []; state.playlist.shuffle = parsed.playlist?.shuffle || false; state.playlist.transitions = parsed.playlist?.transitions || {}; updateMediaGallery(); updatePlaylistUI(); } catch (e) { console.error('Failed to load media:', e); localStorage.removeItem(CONSTANTS.STORAGE_KEY); updateMediaGallery(); updatePlaylistUI(); showNotification('Error loading saved media.', 'error');}};

const formatFileSize = (bytes) => { if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]; };
const showNotification = (message, type = 'info', duration = (typeof WallpaperApp !== 'undefined' ? WallpaperApp.config.notificationDuration : 3000)) => { if (typeof WallpaperApp !== 'undefined' && typeof WallpaperApp.UI?.showNotification === 'function') WallpaperApp.UI.showNotification(message, type, duration); else console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`); };

const getAvailableEffects = () => CONSTANTS.AVAILABLE_EFFECTS;
const getAvailableTransitions = () => CONSTANTS.AVAILABLE_TRANSITIONS;

const getParamsFor = (itemId, itemType, controlsContainerElement, targetApplyId, targetApplyType) => {
  if (!controlsContainerElement) {
    console.error("[MediaModule.getParamsFor] Controls container element is missing.");
    return;
  }
  controlsContainerElement.innerHTML = '';

  const definitionList = itemType === 'effect' ? CONSTANTS.AVAILABLE_EFFECTS : CONSTANTS.AVAILABLE_TRANSITIONS;
  const itemDefinition = definitionList.find(def => def.id === itemId);

  if (!itemDefinition) {
    controlsContainerElement.innerHTML = `<p style="padding:10px; font-size:0.8em; color: var(--warning-color);">Definition for ${itemType} "${itemId}" not found.</p>`;
    return;
  }

  itemDefinition.params.forEach(param => {
    const paramGroup = createUIElement('div', { className: 'form-group' });
    const label = createUIElement('label', { textContent: param.name, attributes: {'for': `l2-param-${param.id}`} });
    paramGroup.appendChild(label);
    let input;
    const currentValue = param.value;

    if (param.type === 'slider') {
      input = createUIElement('input', { type: 'range', className:'parameter-slider', id: `l2-param-${param.id}`, min: param.min, max: param.max, value: currentValue, attributes: { 'data-param-id': param.id }});
      const unitDisplay = param.unit || '';
      const valueSpan = createUIElement('span', {textContent: `${currentValue}${unitDisplay}`, className: 'parameter-value'});
      input.addEventListener('input', (e) => { valueSpan.textContent = e.target.value + unitDisplay; });
      paramGroup.appendChild(input);
      paramGroup.appendChild(valueSpan);
    } else if (param.type === 'select') {
      input = createUIElement('select', { id: `l2-param-${param.id}`, className:'parameter-select', attributes: { 'data-param-id': param.id } });
      param.options.forEach(opt => {
        const optionEl = createUIElement('option', { textContent: opt, value: opt });
        if (opt === currentValue) optionEl.selected = true;
        input.appendChild(optionEl);
      });
      paramGroup.appendChild(input);
    }
    controlsContainerElement.appendChild(paramGroup);
  });

  const applyBtn = createUIElement('button', { textContent: 'Apply to Target', className: 'btn btn-primary apply-params-btn' });
  applyBtn.addEventListener('click', () => {
    if (targetApplyId === null || targetApplyId === undefined) {
      showNotification(`No target selected to apply ${itemType}. Please select an item.`, 'warning');
      return;
    }

    const collectedParams = {};
    controlsContainerElement.querySelectorAll('[data-param-id]').forEach(inputEl => {
      collectedParams[inputEl.dataset.paramId] = inputEl.type === 'range' ? parseFloat(inputEl.value) : inputEl.value;
    });

    if (itemType === 'effect' && targetApplyType === 'effect') {
      applyEffect(targetApplyId, itemId, collectedParams);
    } else if (itemType === 'transition' && targetApplyType === 'transition') {
      state.playlist.transitions[targetApplyId] = { transitionId: itemId, params: collectedParams };
      showNotification(`Transition ${itemDefinition.name} applied before item ${targetApplyId + 1} (via L2).`, 'success');
      saveMediaList(); updatePlaylistUI();
    } else {
      showNotification(`Cannot apply ${itemType}: Mismatched target type or invalid target.`, 'error');
    }
  });
  controlsContainerElement.appendChild(applyBtn);
};

const populatePerClipTransitions = (playlistItemIndex) => {
  if (!state.dom.perClipTransitionsList) {
    console.error("[MediaModule.populatePerClipTransitions] Panel list element not found.");
    return;
  }
  state.dom.perClipTransitionsList.innerHTML = '';
  state.contextualEditing.perClipTargetIndex = playlistItemIndex;

  const currentTransition = state.playlist.transitions[playlistItemIndex];

  CONSTANTS.AVAILABLE_TRANSITIONS.forEach(transitionDef => {
    const button = createUIElement('button', {
      className: 'submenu-item',
      textContent: transitionDef.name,
      attributes: { 'data-transition-id': transitionDef.id }
    });

    if (currentTransition && currentTransition.transitionId === transitionDef.id) {
      button.classList.add('selected');
    }

    button.addEventListener('click', () => {
      applyOutroTransition(state.contextualEditing.perClipTargetIndex, transitionDef.id);
    });
    state.dom.perClipTransitionsList.appendChild(button);
  });
  const removeButton = createUIElement('button', {
    className: 'submenu-item btn-danger',
    textContent: 'Remove Transition'
  });
  if (!currentTransition) {
    removeButton.classList.add('disabled');
  }
  removeButton.addEventListener('click', () => {
    if (currentTransition) {
      delete state.playlist.transitions[state.contextualEditing.perClipTargetIndex];
      const mediaItem = state.mediaLibrary.find(m => m.id === state.playlist.items[state.contextualEditing.perClipTargetIndex]);
      showNotification(`Transition removed for '${mediaItem ? mediaItem.name : `item ${state.contextualEditing.perClipTargetIndex + 1`}'.`, 'info');
      saveMediaList();
      updatePlaylistUI();
      }
        WallpaperApp.MenuTools.closePerClipTransitionsPanel();
    });
    state.dom.perClipTransitionsList.appendChild(createDivider());
    state.dom.perClipTransitionsList.appendChild(removeButton);
  };


  return {
    init: init,
    hideContextMenu: hideContextMenu,
    hideInlinePanel: hideInlinePanel,
    getAvailableEffects: getAvailableEffects, 
    getAvailableTransitions: getAvailableTransitions, 
    getParamsFor: getParamsFor, 
    populatePerClipTransitions: populatePerClipTransitions, 
  };
})(); // Semicolon added for IIFE

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', MediaModule.init);
} else {
  MediaModule.init();
}

/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Version 0.3.8 - Contextual Effects & Transitions (Robust Initialization & Logging)
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
    STORAGE_KEY: 'flStudioWallpaper_media_v6',
    STORAGE_KEY_OLD: 'flStudioWallpaper_media_v5',
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

      console.log("[MediaModule] init: Core DOM elements cached. Calling initMediaImporter.");
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
            !e.target.closest('.playlist-item-add-transition')) {
          hideInlinePanel();
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
      console.log("[MediaModule] initMediaImporter: #import-media-submenu found:", state.dom.importSubmenu ? 'Yes' : 'No');

      if (!state.dom.importSubmenu) {
        console.error("[MediaModule] initMediaImporter: CRITICAL - #import-media-submenu not found. Media Player UI cannot be initialized.");
        return;
      }
      if (!state.dom.mediaContainer) {
        console.error("[MediaModule] initMediaImporter: CRITICAL - #media-container for playback not found.");
        // Not returning here, as UI might still be partially buildable for library/playlist.
      }

      const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
      console.log("[MediaModule] initMediaImporter: .menu-content found in #import-media-submenu:", menuContent ? 'Yes' : 'No');

      if (!menuContent) {
        console.error("[MediaModule] initMediaImporter: CRITICAL - .menu-content not found in #import-media-submenu. UI cannot be built.");
        return;
      }

      console.log("[MediaModule] initMediaImporter: Proceeding with UI setup.");
      setupMediaImportUI(menuContent);
      console.log("[MediaModule] initMediaImporter: UI setup complete. Loading saved media.");
      loadSavedMedia();
      console.log("[MediaModule] initMediaImporter: Saved media loaded. Setting up global event delegation.");
      setupGlobalEventDelegation();
      console.log("[MediaModule] initMediaImporter: Finished successfully.");
    } catch (error) {
      console.error("[MediaModule] initMediaImporter: CRITICAL ERROR:", error);
    }
  };

  const setupMediaImportUI = (menuContent) => {
    console.log("[MediaModule] setupMediaImportUI: Starting to build UI in .menu-content.");
    try {
      menuContent.innerHTML = ''; // Clear existing content first
      console.log("[MediaModule] setupMediaImportUI: .menu-content cleared.");

      setupFileInput(); // Ensures file input is ready
      console.log("[MediaModule] setupMediaImportUI: File input setup.");

      const importButton = createUIElement('button', {
        className: 'submenu-item import-media-button',
        textContent: 'IMPORT MEDIA',
        attributes: { 'data-action': 'import-media-action' },
      });
      menuContent.appendChild(importButton);
      menuContent.appendChild(createDivider());
      console.log("[MediaModule] setupMediaImportUI: Import button added.");

      const mediaLibrarySection = createMediaLibrarySection();
      state.dom.mediaLibrarySection = mediaLibrarySection;
      menuContent.appendChild(mediaLibrarySection);
      menuContent.appendChild(createDivider());
      console.log("[MediaModule] setupMediaImportUI: Media library section added.");

      const playlistSection = createPlaylistSection();
      state.dom.playlistSection = playlistSection;
      menuContent.appendChild(playlistSection);
      console.log("[MediaModule] setupMediaImportUI: Playlist section added.");
      console.log("[MediaModule] setupMediaImportUI: Finished successfully.");
    } catch (error) {
      console.error("[MediaModule] setupMediaImportUI: ERROR during UI construction:", error);
    }
  };

  const setupFileInput = () => {
    if (state.fileInput && state.fileInput.parentNode) {
      state.fileInput.parentNode.removeChild(state.fileInput);
    }
    state.fileInput = createUIElement('input', {
      type: 'file', id: 'media-file-input',
      accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','),
      multiple: true, style: { display: 'none' },
      events: { change: (e) => {
          handleFileSelect(e.target.files);
          e.target.value = '';
        }}
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
    if (options.events) {
      Object.entries(options.events).forEach(([event, handler]) => element.addEventListener(event, handler));
    }
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
    let isSelecting = false;
    let galleryRect = null;

    gallery.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target !== gallery) return;
      hideContextMenu();
      hideInlinePanel();
      isSelecting = true;
      galleryRect = gallery.getBoundingClientRect();
      state.selection.startPoint = {
        x: e.clientX - galleryRect.left + gallery.scrollLeft,
        y: e.clientY - galleryRect.top + gallery.scrollTop
      };
      if (state.selection.selectionBoxElement) state.selection.selectionBoxElement.remove();
      state.selection.selectionBoxElement = createUIElement('div', {
        className: 'selection-box',
        style: {
          left: `${state.selection.startPoint.x - gallery.scrollLeft}px`,
          top: `${state.selection.startPoint.y - gallery.scrollTop}px`,
          width: '0px',
          height: '0px'
        }
      });
      gallery.appendChild(state.selection.selectionBoxElement);
      if (!state.selection.shiftKeyActive) clearSelection();
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isSelecting || !state.selection.selectionBoxElement || !galleryRect) return;
      const currentX = e.clientX - galleryRect.left + gallery.scrollLeft;
      const currentY = e.clientY - galleryRect.top + gallery.scrollTop;
      const x1 = Math.min(state.selection.startPoint.x, currentX);
      const y1 = Math.min(state.selection.startPoint.y, currentY);
      const x2 = Math.max(state.selection.startPoint.x, currentX);
      const y2 = Math.max(state.selection.startPoint.y, currentY);
      state.selection.selectionBoxElement.style.left = `${x1 - gallery.scrollLeft}px`;
      state.selection.selectionBoxElement.style.top = `${y1 - gallery.scrollTop}px`;
      state.selection.selectionBoxElement.style.width = `${x2 - x1}px`;
      state.selection.selectionBoxElement.style.height = `${y2 - y1}px`;
      const selectionRectDoc = {
        left: x1 + galleryRect.left - gallery.scrollLeft,
        top: y1 + galleryRect.top - gallery.scrollTop,
        right: x2 + galleryRect.left - gallery.scrollLeft,
        bottom: y2 + galleryRect.top - gallery.scrollTop
      };
      gallery.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
        const thumbnailRectDoc = thumbnail.getBoundingClientRect();
        const mediaId = thumbnail.dataset.id;
        const intersects = !(
            thumbnailRectDoc.right < selectionRectDoc.left ||
            thumbnailRectDoc.left > selectionRectDoc.right ||
            thumbnailRectDoc.bottom < selectionRectDoc.top ||
            thumbnailRectDoc.top > selectionRectDoc.bottom
        );
        if (intersects) {
          if (!state.selection.items.has(mediaId)) {
            addToSelection(mediaId);
            thumbnail.classList.add('selected');
          }
        } else {
          if (state.selection.items.has(mediaId) && !state.selection.shiftKeyActive) {
            removeFromSelection(mediaId);
            thumbnail.classList.remove('selected');
          }
        }
      });
    });

    document.addEventListener('mouseup', () => {
      if (!isSelecting) return;
      isSelecting = false;
      galleryRect = null;
      if (state.selection.selectionBoxElement) {
        state.selection.selectionBoxElement.remove();
        state.selection.selectionBoxElement = null;
      }
      if (state.selection.items.size > 0) {
        state.selection.lastSelected = Array.from(state.selection.items).pop();
      }
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
    state.dom.playlistEmptyState = createUIElement('div', { id: 'playlist-empty-state', textContent: 'Drag media here or click "+" on items to add transitions.' });
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
      { id: 'playlist-shuffle-button', html: '<span style="filter: grayscale(100%);">🔀</span> Losowo', class: 'btn-secondary' },
      { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', class: 'btn-danger' }
    ];
    buttons.forEach(btnData => {
      const button = createUIElement('button', {
        id: btnData.id, innerHTML: btnData.html, className: `btn playlist-button ${btnData.class || 'btn-secondary'}`,
      });
      controlsContainer.appendChild(button);
    });
  };

  const setupGlobalEventDelegation = () => {
    if (state.dom.importSubmenu) {
      state.dom.importSubmenu.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.matches('.import-media-button')) {
          if (state.fileInput) {
            state.fileInput.click();
          } else {
            console.error("MediaModule: File input not found when 'IMPORT MEDIA' clicked.");
          }
        }
      });
    }

    if (state.dom.mediaGallery) {
      state.dom.mediaGallery.addEventListener('click', (e) => {
        const thumbnail = e.target.closest('.media-thumbnail');
        if (!thumbnail) return;
        hideContextMenu();
        hideInlinePanel();

        const mediaId = thumbnail.dataset.id;
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (!media) return;

        if (e.target.closest('.media-delete-btn')) {
          e.stopPropagation(); e.preventDefault();
          handleMediaDelete(media);
        } else {
          handleThumbnailClick(e, media, thumbnail);
        }
      });

      state.dom.mediaGallery.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const thumbnail = e.target.closest('.media-thumbnail');
        if (!thumbnail) {
          hideContextMenu();
          return;
        }
        const mediaId = thumbnail.dataset.id;
        showContextMenu(e, mediaId, 'effect', thumbnail);
      });
    }

    if (state.dom.playlistControlsContainer) {
      state.dom.playlistControlsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.matches('#playlist-play-button')) playPlaylist();
        else if (target.matches('#playlist-shuffle-button')) toggleShuffle();
        else if (target.matches('#playlist-clear-button')) confirmClearPlaylist();
      });
    }

    if (state.dom.playlistContainer) {
      state.dom.playlistContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.playlist-item');
        const addTransitionButton = e.target.closest('.playlist-item-add-transition');

        if (addTransitionButton && item) {
          e.stopPropagation();
          const playlistIndex = parseInt(addTransitionButton.dataset.index, 10);
          if (!isNaN(playlistIndex)) {
            showInlinePanel(e, playlistIndex, 'transition', addTransitionButton);
          } else {
            console.warn("Invalid data-index for transition button on item:", item);
          }
        } else if (item) {
          hideContextMenu();
          hideInlinePanel();
          const mediaId = item.dataset.id;
          const index = parseInt(item.dataset.index, 10);
          const media = state.mediaLibrary.find(m => m.id === mediaId);

          if (e.target.closest('.playlist-item-delete')) {
            e.stopPropagation();
            removeFromPlaylist(index);
          } else if (media) {
            if (state.playlist.isPlaying && state.playlist.currentIndex === index) {
              pausePlaylist();
            } else {
              state.playlist.currentIndex = index;
              playPlaylist();
              updateActiveHighlight(media.id, 'playlist');
            }
          }
        }
      });
    }
  };

  const showContextMenu = (event, targetId, type, anchorElement) => {
    hideContextMenu();
    hideInlinePanel();

    const menu = state.dom.contextMenuContainer;
    if (!menu) { console.error("Context menu container not found."); return; }
    menu.innerHTML = '';
    menu.style.display = 'block';

    const importSubmenuRect = state.dom.importSubmenu.getBoundingClientRect();
    let x = event.clientX - importSubmenuRect.left;
    let y = event.clientY - importSubmenuRect.top;

    const menuWidth = 180;
    const menuHeight = 50;
    if (x + menuWidth > importSubmenuRect.width) x = importSubmenuRect.width - menuWidth - 5;
    if (y + menuHeight > importSubmenuRect.height) y = importSubmenuRect.height - menuHeight - 5;
    if (x < 0) x = 5;
    if (y < 0) y = 5;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    state.contextualEditing.contextMenuElement = menu;
    state.contextualEditing.targetId = targetId;
    state.contextualEditing.type = type;
    state.contextualEditing.activeItem = null;

    if (type === 'effect') {
      const editEffectsButton = createUIElement('button', {
        textContent: 'Add/Edit Effect',
        className: 'context-menu-item',
        events: { click: () => {
            hideContextMenu();
            showInlinePanel(event, targetId, 'effect', anchorElement);
          }}
      });
      menu.appendChild(editEffectsButton);
    }
  };

  const hideContextMenu = () => {
    if (state.contextualEditing.contextMenuElement) {
      state.contextualEditing.contextMenuElement.style.display = 'none';
      state.contextualEditing.contextMenuElement.innerHTML = '';
    }
    state.contextualEditing.contextMenuElement = null;
  };

  const showInlinePanel = (event, targetId, type, anchorElement) => {
    hideInlinePanel();
    hideContextMenu();

    const panel = state.dom.inlinePanelContainer;
    if (!panel) { console.error("Inline panel container not found."); return; }
    panel.innerHTML = '';
    panel.style.display = 'block';
    state.contextualEditing.panelElement = panel;
    state.contextualEditing.targetId = targetId;
    state.contextualEditing.type = type;
    state.contextualEditing.activeItem = null;

    if (anchorElement && state.dom.importSubmenu) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const submenuRect = state.dom.importSubmenu.getBoundingClientRect();
      let panelTop = anchorRect.bottom - submenuRect.top + 5;
      let panelLeft = anchorRect.left - submenuRect.left;
      const panelWidth = 280;
      const panelHeightEstimate = 200;

      if (panelLeft + panelWidth > submenuRect.width) panelLeft = anchorRect.right - submenuRect.left - panelWidth;
      if (panelTop + panelHeightEstimate > submenuRect.height) panelTop = anchorRect.top - submenuRect.top - panelHeightEstimate - 5;
      if (panelLeft < 0) panelLeft = 5;
      if (panelTop < 0) panelTop = 5;

      panel.style.top = `${panelTop}px`;
      panel.style.left = `${panelLeft}px`;
    } else {
      panel.style.top = '50px'; panel.style.left = '50px';
    }

    const mediaItemForTitle = type === 'effect' ? state.mediaLibrary.find(m=>m.id === targetId) : null;
    const titleText = type === 'effect' ? `Effects for ${mediaItemForTitle?.name || 'Item'}` : `Transition before item ${targetId + 1}`;
    const panelTitle = createUIElement('div', { textContent: titleText, className: 'inline-panel-title' });
    panel.appendChild(panelTitle);

    const itemsContainer = createUIElement('div', { className: 'inline-panel-items' });
    const itemsToList = type === 'effect' ? CONSTANTS.AVAILABLE_EFFECTS : CONSTANTS.AVAILABLE_TRANSITIONS;

    itemsToList.forEach(item => {
      const itemButton = createUIElement('button', {
        textContent: item.name,
        className: 'inline-panel-item-button',
        events: { click: (e) => {
            itemsContainer.querySelectorAll('.inline-panel-item-button.selected').forEach(btn => btn.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            state.contextualEditing.activeItem = item;
            populateInlinePanelControls(item, type, targetId);
          }}
      });
      itemsContainer.appendChild(itemButton);
    });
    panel.appendChild(itemsContainer);

    const controlsContainer = createUIElement('div', { id: 'inline-panel-controls', className: 'inline-panel-controls-container'});
    panel.appendChild(controlsContainer);

    const applyButton = createUIElement('button', { textContent: 'Apply', className: 'btn btn-primary btn-small inline-panel-button-apply' });
    applyButton.addEventListener('click', () => {
      if (type === 'effect') applyEffect(targetId);
      else if (type === 'transition') applyTransition(targetId);
    });
    const closeButton = createUIElement('button', { textContent: 'Close', className: 'btn btn-secondary btn-small' });
    closeButton.addEventListener('click', hideInlinePanel);

    const footer = createUIElement('div', {className: 'inline-panel-footer'});
    footer.appendChild(applyButton);
    footer.appendChild(closeButton);
    panel.appendChild(footer);
  };

  const populateInlinePanelControls = (selectedItem, type, targetId) => {
    const controlsContainer = document.getElementById('inline-panel-controls');
    if (!controlsContainer) return;
    controlsContainer.innerHTML = '';

    let existingSettingsBundle = null;
    if (type === 'effect') {
      const mediaItem = state.mediaLibrary.find(m => m.id === targetId);
      if (mediaItem && mediaItem.settings && mediaItem.settings.effects) {
        existingSettingsBundle = mediaItem.settings.effects.find(eff => eff.effectId === selectedItem.id);
      }
    } else if (type === 'transition') {
      const transitionAtTarget = state.playlist.transitions[targetId];
      if (transitionAtTarget && transitionAtTarget.transitionId === selectedItem.id) {
        existingSettingsBundle = transitionAtTarget;
      }
    }

    selectedItem.params.forEach(param => {
      const paramGroup = createUIElement('div', { className: 'form-group inline-param-group' });
      const label = createUIElement('label', { textContent: param.name, attributes: {'for': `param-${param.id}`} });
      paramGroup.appendChild(label);

      let input;
      const currentValue = existingSettingsBundle?.params?.[param.id] !== undefined ? existingSettingsBundle.params[param.id] : param.value;

      if (param.type === 'slider') {
        input = createUIElement('input', {
          type: 'range', id: `param-${param.id}`, min: param.min, max: param.max, value: currentValue,
          attributes: { 'data-param-id': param.id }
        });
        const unitDisplay = param.unit || '';
        const valueSpan = createUIElement('span', {textContent: `${currentValue}${unitDisplay}`, className: 'param-value-display'});
        input.addEventListener('input', (e) => {
          valueSpan.textContent = `${e.target.value}${unitDisplay}`;
        });
        paramGroup.appendChild(input);
        paramGroup.appendChild(valueSpan);
      } else if (param.type === 'select') {
        input = createUIElement('select', { id: `param-${param.id}`, attributes: { 'data-param-id': param.id } });
        param.options.forEach(opt => {
          const optionEl = createUIElement('option', { textContent: opt, value: opt });
          if (opt === currentValue) optionEl.selected = true;
          input.appendChild(optionEl);
        });
        paramGroup.appendChild(input);
      }
      controlsContainer.appendChild(paramGroup);
    });
  };

  const hideInlinePanel = () => {
    if (state.contextualEditing.panelElement) {
      state.contextualEditing.panelElement.style.display = 'none';
      state.contextualEditing.panelElement.innerHTML = '';
    }
    state.contextualEditing.panelElement = null;
    state.contextualEditing.active = false;
    state.contextualEditing.targetId = null;
    state.contextualEditing.type = null;
    state.contextualEditing.activeItem = null;
  };

  const applyEffect = (mediaId) => {
    const mediaItem = state.mediaLibrary.find(m => m.id === mediaId);
    if (!mediaItem) return;

    const panel = state.contextualEditing.panelElement;
    const activeEffectItem = state.contextualEditing.activeItem;

    if (!panel || !activeEffectItem) {
      showNotification("No active effect selected or panel not found.", "error");
      return;
    }
    const currentEffectId = activeEffectItem.id;

    if (!mediaItem.settings) mediaItem.settings = {};
    if (!mediaItem.settings.effects) mediaItem.settings.effects = [];

    mediaItem.settings.effects = mediaItem.settings.effects.filter(eff => eff.effectId !== currentEffectId);

    const effectParams = {};
    panel.querySelectorAll('#inline-panel-controls [data-param-id]').forEach(inputEl => {
      effectParams[inputEl.dataset.paramId] = inputEl.type === 'range' ? parseFloat(inputEl.value) : inputEl.value;
    });

    mediaItem.settings.effects.push({ effectId: currentEffectId, params: effectParams });
    showNotification(`Effect ${activeEffectItem.name} applied.`, 'success');
    saveMediaList();
    updateMediaGallery();

    const currentlyDisplayedElement = state.dom.mediaContainer.querySelector(`[src="${mediaItem.url}"], video[data-media-id="${mediaId}"]`);
    if (currentlyDisplayedElement) {
      const tempElement = createMediaElement(mediaItem, false, currentlyDisplayedElement.loop);
      if (tempElement && tempElement.style.filter) {
        currentlyDisplayedElement.style.filter = tempElement.style.filter;
      } else {
        currentlyDisplayedElement.style.filter = 'none';
      }
    }
  };

  const applyTransition = (playlistIndex) => {
    const panel = state.contextualEditing.panelElement;
    const activeTransitionItem = state.contextualEditing.activeItem;

    if (!panel || !activeTransitionItem) {
      showNotification("No active transition selected or panel not found.", "error");
      return;
    }
    const currentTransitionId = activeTransitionItem.id;

    const transitionParams = {};
    panel.querySelectorAll('#inline-panel-controls [data-param-id]').forEach(inputEl => {
      transitionParams[inputEl.dataset.paramId] = inputEl.type === 'range' ? parseFloat(inputEl.value) : inputEl.value;
    });

    state.playlist.transitions[playlistIndex] = { transitionId: currentTransitionId, params: transitionParams };
    showNotification(`Transition ${activeTransitionItem.name} applied.`, 'success');
    saveMediaList();
    updatePlaylistUI();
  };

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) {
      return;
    }
    let validCount = 0;
    let invalidCount = 0;
    const processingPromises = [];

    Array.from(files).forEach(file => {
      if (isFileSupported(file.type)) {
        processingPromises.push(
            processFile(file)
                .then(() => { validCount++; })
                .catch(err => { invalidCount++; console.error(`Error processing file "${file.name}":`, err); })
        );
      } else {
        invalidCount++;
        console.warn(`File "${file.name}" (type: ${file.type}) is not supported.`);
      }
    });

    try {
      await Promise.all(processingPromises);
    } catch (error) {
      console.error("Error during Promise.all in handleFileSelect:", error);
    }

    if (validCount > 0) showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}.`, 'success');
    if (invalidCount > 0) showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} unsupported.`, 'warning');

    updateMediaGallery();
    updatePlaylistUI();
    saveMediaList();
  };

  const isFileSupported = (type) => CONSTANTS.SUPPORTED_TYPES.video.includes(type) || CONSTANTS.SUPPORTED_TYPES.image.includes(type);

  const processFile = async (file) => {
    const id = generateMediaId();
    const url = URL.createObjectURL(file);
    const type = CONSTANTS.SUPPORTED_TYPES.video.includes(file.type) ? 'video' : 'image';
    const mediaItem = {
      id, name: file.name, type, mimeType: file.type, size: file.size, url, dateAdded: Date.now(), thumbnail: null,
      settings: { effects: [] }
    };
    state.mediaLibrary.push(mediaItem);
    try {
      mediaItem.thumbnail = await generateThumbnail(mediaItem, file);
    } catch (err) {
      console.warn(`Error generating thumbnail for "${mediaItem.name}", using fallback. Error:`, err);
      mediaItem.thumbnail = createFallbackThumbnail(mediaItem.type);
    }
  };

  const generateMediaId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  const getVideoDuration = (videoUrl) => new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    let timeoutId = null;
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.onloadedmetadata = null; video.onerror = null; video.pause();
      video.removeAttribute('src'); try { video.load(); } catch(e) { /* ignore */ }
    };
    video.onloadedmetadata = function() {
      const duration = video.duration;
      cleanup();
      if (typeof duration === 'number' && !isNaN(duration) && duration > 0) resolve(duration);
      else { console.warn(`Invalid duration (${duration}) for video: ${videoUrl}. Resolving with 0.`); resolve(0); }
    };
    video.onerror = function(e) {
      cleanup(); const errorMsg = `Error loading video metadata for ${videoUrl}`;
      console.warn(errorMsg, e); reject(new Error(errorMsg));
    };
    timeoutId = setTimeout(() => {
      const errorMsg = `Timeout loading video metadata for ${videoUrl} after ${CONSTANTS.VIDEO_METADATA_TIMEOUT}ms.`;
      console.warn(errorMsg); cleanup(); reject(new Error(errorMsg));
    }, CONSTANTS.VIDEO_METADATA_TIMEOUT);
    try { video.src = videoUrl; }
    catch (e) {
      const errorMsg = `Error setting video source for ${videoUrl}`;
      console.warn(errorMsg, e); cleanup(); reject(new Error(errorMsg));
    }
  });

  const generateThumbnail = (mediaItem, file) => new Promise((resolve, reject) => {
    if (mediaItem.type === 'image') {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = (err) => {
        console.error(`Image thumbnail (FileReader) error for ${mediaItem.name}:`, err);
        reject(new Error(`FileReader error for ${mediaItem.name}`));
      };
      reader.readAsDataURL(file);
    } else if (mediaItem.type === 'video') {
      generateVideoThumbnail(mediaItem.url, mediaItem.name)
          .then(resolve)
          .catch(reject);
    } else {
      console.error(`Unsupported type for thumbnail generation: ${mediaItem.type}`);
      reject(new Error(`Unsupported type for thumbnail generation: ${mediaItem.type}`));
    }
  });

  const generateVideoThumbnail = (videoUrl, videoName) => new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata'; video.muted = true; video.crossOrigin = "anonymous";
    let thumbnailGenerated = false; let timeoutId = null;
    const cleanupAndResolve = (thumbnailUrl) => {
      if (timeoutId) clearTimeout(timeoutId);
      video.onloadedmetadata = null; video.onseeked = null; video.onerror = null;
      video.pause(); video.removeAttribute('src'); try { video.load(); } catch(e) { /* ignore */ }
      resolve(thumbnailUrl);
    };
    const cleanupAndReject = (errorMsg) => {
      if (timeoutId) clearTimeout(timeoutId);
      video.onloadedmetadata = null; video.onseeked = null; video.onerror = null;
      video.pause(); video.removeAttribute('src'); try { video.load(); } catch(e) { /* ignore */ }
      console.warn(errorMsg); reject(new Error(errorMsg));
    };
    const generateFrame = () => {
      if (thumbnailGenerated) return; thumbnailGenerated = true;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width; canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanupAndReject(`Could not get 2D context for ${videoName}`); return; }
        ctx.fillStyle = '#1A1A1A'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const videoAspectRatio = video.videoWidth / video.videoHeight;
          const canvasAspectRatio = canvas.width / canvas.height;
          let drawWidth, drawHeight, offsetX, offsetY;
          if (videoAspectRatio > canvasAspectRatio) {
            drawHeight = canvas.width / videoAspectRatio; drawWidth = canvas.width;
            offsetY = (canvas.height - drawHeight) / 2; offsetX = 0;
          } else {
            drawWidth = canvas.height * videoAspectRatio; drawHeight = canvas.height;
            offsetX = (canvas.width - drawWidth) / 2; offsetY = 0;
          }
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        } else console.warn(`Video dimensions are zero for ${videoName}. Drawing placeholder.`);
        drawPlayButton(ctx, canvas.width, canvas.height);
        cleanupAndResolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (err) { cleanupAndReject(`Error generating thumbnail canvas for ${videoName}: ${err.message}`); }
    };
    video.onloadedmetadata = function() {
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        try { video.currentTime = Math.min(1.0, video.duration / 3); }
        catch (e) { console.warn(`Error seeking video ${videoName}:`, e); generateFrame(); }
      } else generateFrame();
    };
    video.onseeked = generateFrame;
    video.onerror = (e) => {
      const errorDetail = e.target && e.target.error ? `Code: ${e.target.error.code}, Message: ${e.target.error.message}` : (e.message || e.type || 'Unknown video error');
      cleanupAndReject(`Error loading video for thumbnail: ${videoName}. Error: ${errorDetail}`);
    };
    timeoutId = setTimeout(() => {
      if (!thumbnailGenerated) cleanupAndReject(`Thumbnail generation timeout for ${videoName} after ${CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT}ms.`);
    }, CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT);
    try { video.src = videoUrl; }
    catch (e) { cleanupAndReject(`Error setting video source for thumbnail: ${videoName}. Error: ${e.message}`); }
  });

  const createFallbackThumbnail = (type = 'media') => {
    const canvas = document.createElement('canvas');
    canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width; canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    ctx.fillStyle = '#333'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ccc'; ctx.font = `bold ${Math.min(canvas.height / 4, 20)}px Barlow, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (type === 'video') drawPlayButton(ctx, canvas.width, canvas.height, '#ccc');
    else ctx.fillText(type.toUpperCase(), canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
  };

  const drawPlayButton = (ctx, width, height, color = 'rgba(255, 255, 255, 0.7)') => {
    ctx.fillStyle = color;
    const centerX = width / 2; const centerY = height / 2;
    const triangleSize = Math.min(width, height) * 0.25;
    ctx.beginPath();
    ctx.moveTo(centerX - triangleSize / 2, centerY - triangleSize * 0.866 / 2);
    ctx.lineTo(centerX - triangleSize / 2, centerY + triangleSize * 0.866 / 2);
    ctx.lineTo(centerX + triangleSize * 0.8, centerY);
    ctx.closePath(); ctx.fill();
  };

  const updateMediaGallery = () => {
    const gallery = state.dom.mediaGallery;
    const emptyState = state.dom.mediaEmptyState;
    if (!gallery || !emptyState) { console.error("Media gallery or empty state DOM element not found in updateMediaGallery."); return; }
    emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';

    const fragment = document.createDocumentFragment();
    state.mediaLibrary.forEach(media => {
      fragment.appendChild(createMediaThumbnail(media));
    });
    Array.from(gallery.children).forEach(child => {
      if (child !== emptyState && !child.classList.contains('selection-box')) gallery.removeChild(child);
    });
    gallery.appendChild(fragment);
    updateMediaSelectionUI();
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'library') {
      updateActiveHighlight(state.activeHighlight.mediaId, 'library');
    }
  };

  const createMediaThumbnail = (media) => {
    const thumbnail = createUIElement('div', {
      className: 'media-thumbnail', attributes: { 'data-id': media.id, draggable: 'true' }
    });
    const highlightRing = createUIElement('div', { className: 'media-active-highlight-ring' });
    thumbnail.appendChild(highlightRing);

    thumbnail.addEventListener('dragstart', (e) => {
      if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
        const multiData = JSON.stringify({ type: 'multiple-media', ids: Array.from(state.selection.items) });
        e.dataTransfer.setData('application/json', multiData);
      } else {
        e.dataTransfer.setData('text/plain', media.id);
      }
      e.dataTransfer.effectAllowed = 'copy';
      thumbnail.classList.add('dragging');
    });
    thumbnail.addEventListener('dragend', () => thumbnail.classList.remove('dragging'));

    const imgContainer = createUIElement('div', {
      className: 'media-thumbnail-img-container',
      style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } :
          { backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white', fontWeight: 'bold' }
    });
    if (!media.thumbnail) imgContainer.textContent = media.type.charAt(0).toUpperCase();
    thumbnail.appendChild(imgContainer);

    if (media.settings?.effects?.length > 0) {
      const fxIndicator = createUIElement('div', {className: 'media-thumbnail-fx-indicator', textContent: 'FX'});
      thumbnail.appendChild(fxIndicator);
    }

    const nameLabel = createUIElement('div', { className: 'media-thumbnail-name', textContent: media.name });
    thumbnail.appendChild(nameLabel);
    const badge = createUIElement('div', { className: 'media-type-badge', textContent: media.type.toUpperCase() });
    thumbnail.appendChild(badge);

    const deleteBtn = createUIElement('button', {
      className: 'media-delete-btn btn btn-icon btn-danger', innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': `Delete ${media.name}` }
    });
    thumbnail.appendChild(deleteBtn);
    thumbnail.setAttribute('title', `${media.name}\n(Right-click for options)`);
    return thumbnail;
  };

  const handleMediaDelete = (media) => {
    const mediaId = media.id;
    if (state.selection.items.has(mediaId) && state.selection.items.size > 1) {
      Array.from(state.selection.items).forEach(id => deleteMedia(id, true));
      clearSelection();
    } else {
      deleteMedia(mediaId);
    }
  };

  const handleThumbnailClick = (e, media, thumbnailElement) => {
    if (state.selection.shiftKeyActive && state.selection.lastSelected) {
      selectRange(state.selection.lastSelected, media.id);
    } else if (state.selection.shiftKeyActive) {
      clearSelection(); addToSelection(media.id); state.selection.lastSelected = media.id;
    } else if (e.ctrlKey || e.metaKey) {
      toggleSelection(media.id);
      state.selection.lastSelected = state.selection.items.has(media.id) ? media.id : null;
    } else {
      const wasSelected = state.selection.items.has(media.id);
      const multipleSelected = state.selection.items.size > 1;
      if (wasSelected && !multipleSelected) {
        selectMedia(media, true);
      } else {
        clearSelection(); addToSelection(media.id); state.selection.lastSelected = media.id;
        selectMedia(media, true);
      }
    }
    updateMediaSelectionUI();
  };

  const clearSelection = () => { state.selection.items.clear(); state.selection.lastSelected = null; updateMediaSelectionUI(); };
  const addToSelection = (mediaId) => state.selection.items.add(mediaId);
  const removeFromSelection = (mediaId) => state.selection.items.delete(mediaId);
  const toggleSelection = (mediaId) => { state.selection.items.has(mediaId) ? state.selection.items.delete(mediaId) : state.selection.items.add(mediaId); };
  const selectRange = (startId, endId) => {
    const allThumbnails = Array.from(state.dom.mediaGallery.querySelectorAll('.media-thumbnail'));
    const startIndex = allThumbnails.findIndex(t => t.dataset.id === startId);
    const endIndex = allThumbnails.findIndex(t => t.dataset.id === endId);
    if (startIndex === -1 || endIndex === -1) return;
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    for (let i = minIndex; i <= maxIndex; i++) {
      const mediaIdInRange = allThumbnails[i].dataset.id;
      if (mediaIdInRange) addToSelection(mediaIdInRange);
    }
    state.selection.lastSelected = endId;
  };
  const updateMediaSelectionUI = () => {
    if (!state.dom.mediaGallery) return;
    state.dom.mediaGallery.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
      thumbnail.classList.toggle('selected', state.selection.items.has(thumbnail.dataset.id));
    });
  };

  const handlePlaylistDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/json')) {
      e.dataTransfer.dropEffect = 'move';
    } else if (e.dataTransfer.types.includes('text/plain')) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handlePlaylistDrop = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '';
    try {
      const jsonDataText = e.dataTransfer.getData('application/json');
      if (jsonDataText) {
        const jsonData = JSON.parse(jsonDataText);
        if (jsonData?.type === 'multiple-media' && Array.isArray(jsonData.ids)) {
          const targetElement = e.target.closest('.playlist-item');
          let insertAtIndex = state.playlist.items.length;
          if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            insertAtIndex = parseInt(targetElement.dataset.index || '0', 10) + (isDroppedOnTopHalf ? 0 : 1);
          }
          jsonData.ids.reverse().forEach(id => addToPlaylist(id, insertAtIndex));
          showNotification(`Added ${jsonData.ids.length} items to playlist.`, 'success');
          return;
        } else if (jsonData?.type === 'playlist-reorder') {
          const fromIndex = parseInt(jsonData.index);
          const targetElement = e.target.closest('.playlist-item');
          let toIndex = state.playlist.items.length -1;
          if (targetElement) {
            toIndex = parseInt(targetElement.dataset.index);
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            if (!isDroppedOnTopHalf) toIndex++;
            if (fromIndex < toIndex) toIndex--;
          }
          reorderPlaylistItem(fromIndex, toIndex);
          return;
        }
      }

      const mediaId = e.dataTransfer.getData('text/plain');
      if (mediaId) {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) {
          let insertAtIndex = state.playlist.items.length;
          const targetElement = e.target.closest('.playlist-item');
          if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            insertAtIndex = parseInt(targetElement.dataset.index || '0', 10) + (isDroppedOnTopHalf ? 0 : 1);
          }
          addToPlaylist(mediaId, insertAtIndex);
        } else {
          console.warn(`Media ID "${mediaId}" from drag data not found in library.`);
          showNotification(`Dragged media not found.`, 'error');
        }
      }
    } catch (err) {
      console.error('Error in handlePlaylistDrop:', err);
      showNotification('Error adding item to playlist.', 'error');
    }
  };

  const handleMediaGalleryDragOver = (e) => { e.preventDefault(); /* ... */ };
  const handleMediaGalleryDrop = (e) => { e.preventDefault(); /* ... */ };
  const reorderMediaLibraryItem = (draggedId, targetId, insertBefore) => { /* ... */ };

  const addToPlaylist = (mediaId, insertAtIndex = -1) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) {
      showNotification(`Media ID ${mediaId} not found in library. Cannot add to playlist.`, 'warning');
      return;
    }
    const wasEmpty = state.playlist.items.length === 0;
    if (insertAtIndex === -1 || insertAtIndex >= state.playlist.items.length) {
      state.playlist.items.push(mediaId);
    } else {
      state.playlist.items.splice(insertAtIndex, 0, mediaId);
      if (state.playlist.isPlaying && insertAtIndex <= state.playlist.currentIndex) {
        state.playlist.currentIndex++;
      }
    }
    if (wasEmpty && state.playlist.items.length > 0) {
      state.playlist.currentIndex = 0;
    }
    updatePlaylistUI();
    saveMediaList();
    showNotification(`Added to playlist: ${media.name}`, 'success');
  };

  const removeFromPlaylist = (index) => {
    if (index < 0 || index >= state.playlist.items.length) return;
    state.playlist.items.splice(index, 1);
    delete state.playlist.transitions[index];
    const newTransitions = {};
    for (const key in state.playlist.transitions) {
      const oldKey = parseInt(key);
      if (oldKey > index) newTransitions[oldKey - 1] = state.playlist.transitions[key];
      else if (oldKey < index) newTransitions[oldKey] = state.playlist.transitions[key];
    }
    state.playlist.transitions = newTransitions;
    if (state.playlist.isPlaying) {
      if (index === state.playlist.currentIndex) {
        if (state.playlist.items.length > 0) {
          state.playlist.currentIndex = Math.min(index, state.playlist.items.length - 1);
          playMediaByIndex(state.playlist.currentIndex);
        } else stopPlaylist();
      } else if (index < state.playlist.currentIndex) state.playlist.currentIndex--;
    } else {
      if (state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = Math.max(0, state.playlist.items.length - 1);
      } else if (index < state.playlist.currentIndex) {
        state.playlist.currentIndex--;
      }
      if (state.playlist.items.length === 0) state.playlist.currentIndex = -1;
    }
    updatePlaylistUI(); saveMediaList();
  };

  const reorderPlaylistItem = (fromIndex, toIndex) => {
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length || toIndex < 0 || toIndex > state.playlist.items.length || fromIndex === toIndex) return;
    try {
      const itemToMove = state.playlist.items.splice(fromIndex, 1)[0];
      state.playlist.items.splice(toIndex, 0, itemToMove);
      const oldTransitions = JSON.parse(JSON.stringify(state.playlist.transitions));
      const newTransitions = {};
      Object.keys(oldTransitions).forEach(keyStr => {
        const key = parseInt(keyStr); const transitionData = oldTransitions[key]; let newKey = key;
        if (key === fromIndex) newKey = toIndex;
        else {
          if (fromIndex < toIndex) { if (key > fromIndex && key <= toIndex) newKey = key - 1; }
          else { if (key >= toIndex && key < fromIndex) newKey = key + 1; }
        }
        if (transitionData) newTransitions[newKey] = transitionData;
      });
      state.playlist.transitions = newTransitions;
      if (state.playlist.currentIndex === fromIndex) state.playlist.currentIndex = toIndex;
      else if (state.playlist.currentIndex > fromIndex && state.playlist.currentIndex <= toIndex) state.playlist.currentIndex--;
      else if (state.playlist.currentIndex < fromIndex && state.playlist.currentIndex >= toIndex) state.playlist.currentIndex++;
      updatePlaylistUI(); saveMediaList();
    } catch (e) { console.error('Error reordering playlist item:', e); }
  };

  const confirmClearPlaylist = () => {
    if (state.playlist.items.length === 0) { showNotification('Playlist is already empty.', 'info'); return; }
    if (typeof WallpaperApp !== 'undefined' && WallpaperApp.UI?.showModal) {
      WallpaperApp.UI.showModal({
        id: 'confirm-clear-playlist-modal', title: 'Confirm Clear Playlist',
        content: 'Are you sure you want to clear the entire playlist? This action cannot be undone.',
        footerButtons: [
          { text: 'Clear', classes: 'btn-danger', onClick: () => { clearPlaylistLogic(); return true; } },
          { text: 'Cancel', classes: 'btn-secondary', onClick: () => true }
        ]
      });
    } else if (confirm('Are you sure you want to clear the entire playlist?')) clearPlaylistLogic();
  };

  const clearPlaylistLogic = () => {
    try {
      stopPlaylist(); state.playlist.items = []; state.playlist.transitions = {};
      state.playlist.currentIndex = -1; state.playlist.playedInShuffle.clear();
      updatePlaylistUI(); saveMediaList(); showNotification('Playlist cleared.', 'info');
    } catch (e) { console.error('Error in clearPlaylistLogic:', e); }
  };

  const selectMedia = (media, loopSingle = false) => {
    stopPlaylist(false);
    clearMediaDisplay();
    const element = createMediaElement(media, !loopSingle, loopSingle);
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      showNotification(`Playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');
      state.playlist.isPlaying = !loopSingle;
      if (loopSingle) {
        state.playlist.currentIndex = -1;
        updateActiveHighlight(media.id, 'library');
      } else {
        const playlistIndex = state.playlist.items.indexOf(media.id);
        if (playlistIndex !== -1) {
          state.playlist.currentIndex = playlistIndex;
          updateActiveHighlight(media.id, 'playlist');
        } else {
          updateActiveHighlight(media.id, 'library');
        }
      }
      updatePlaylistUI();
    } else showNotification(`Cannot play ${media.name}. File might be corrupted or unsupported.`, 'error');
  };

  const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
    let element;
    if (!media || !media.type || !media.url) { return null; }
    state.activeVideoElement = null;

    if (media.type === 'image') {
      element = createUIElement('img', { src: media.url, alt: media.name, style: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' } });
      if (isPlaylistContext) {
        clearPlaybackTimers();
        state.playlist.playbackTimer = setTimeout(() => { if (state.playlist.isPlaying) playNextItem(); }, CONSTANTS.IMAGE_DISPLAY_DURATION);
      }
    } else if (media.type === 'video') {
      element = document.createElement('video');
      element.src = media.url; element.autoplay = true; element.loop = loopOverride; element.muted = true; element.dataset.mediaId = media.id;
      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });
      element.addEventListener('error', function(e) { console.error(`Error loading video: ${media.name}`, e.target.error); if (isPlaylistContext && state.playlist.isPlaying) setTimeout(() => playNextItem(), 100);});
      if (isPlaylistContext && !loopOverride) element.addEventListener('ended', () => { if (state.playlist.isPlaying) playNextItem(); });
      state.activeVideoElement = element;
    }

    if (media.settings?.effects?.length > 0 && element) {
      let filterString = "";
      media.settings.effects.forEach(eff => {
        const paramValue = eff.params?.intensity !== undefined ? eff.params.intensity : (eff.params?.level !== undefined ? eff.params.level : null);
        const intensity = paramValue !== null ? parseFloat(paramValue) : 100;
        if (eff.effectId === 'blur' && !isNaN(intensity)) filterString += `blur(${intensity/10}px) `;
        if (eff.effectId === 'grayscale' && !isNaN(intensity)) filterString += `grayscale(${intensity}%) `;
        if (eff.effectId === 'sepia' && !isNaN(intensity)) filterString += `sepia(${intensity}%) `;
        if (eff.effectId === 'brightness' && !isNaN(intensity)) filterString += `brightness(${intensity}%) `;
      });
      element.style.filter = filterString.trim() || 'none';
    } else if (element) {
      element.style.filter = 'none';
    }
    return element;
  };

  const playPlaylist = () => {
    if (state.playlist.items.length === 0) { showNotification('Playlist is empty add some media!', 'info'); return; }
    if (state.playlist.isPlaying) { pausePlaylist(); return; }
    clearPlaybackTimers(); state.playlist.advancingInProgress = false; state.playlist.isPlaying = true;
    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear();
      if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length);
      }
      const currentMediaIdShuffle = state.playlist.items[state.playlist.currentIndex];
      if(currentMediaIdShuffle) state.playlist.playedInShuffle.add(currentMediaIdShuffle);
    } else {
      if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = 0;
    }
    clearMediaDisplay(); playMediaByIndex(state.playlist.currentIndex); updatePlaylistUI();
  };

  const pausePlaylist = () => {
    state.playlist.isPlaying = false; clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement && !videoElement.paused) videoElement.pause();
    updatePlaylistUI(); showNotification("Playlist stopped.", "info");
  };

  const playMediaByIndex = (index) => {
    if (index < 0 || index >= state.playlist.items.length) {
      if (state.playlist.items.length > 0) { index = 0; state.playlist.currentIndex = 0; }
      else { stopPlaylist(); return; }
    }
    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) {
      showNotification(`Media "${mediaId}" not found. Skipping.`, 'warning');
      if (state.playlist.isPlaying) {
        state.playlist.items.splice(index, 1);
        if (index <= state.playlist.currentIndex) state.playlist.currentIndex--;
        if (state.playlist.items.length === 0) { stopPlaylist(); return; }
        const nextIndexToTry = Math.max(0, Math.min(index, state.playlist.items.length - 1));
        playNextItem(nextIndexToTry);
      }
      return;
    }
    state.playlist.currentIndex = index; state.playlist.isPlaying = true;
    clearMediaDisplay();
    const transitionData = state.playlist.transitions[index];
    if (transitionData && state.dom.mediaContainer.children.length > 0) {
      const oldElement = state.dom.mediaContainer.firstChild;
      if (oldElement) oldElement.style.opacity = '0';
      setTimeout(() => {
        if (oldElement && oldElement.parentNode) oldElement.parentNode.removeChild(oldElement);
        const newElement = createMediaElement(media, true);
        if (newElement) {
          newElement.style.opacity = '0';
          state.dom.mediaContainer.appendChild(newElement);
          requestAnimationFrame(() => newElement.style.opacity = '1');
          if (newElement.tagName.toLowerCase() === 'video') newElement.play().catch(e => console.warn("Autoplay prevented:", e));
        }
      }, (transitionData.params.duration || 500) / 2);
    } else {
      const element = createMediaElement(media, true);
      if (element) {
        state.dom.mediaContainer.appendChild(element);
        if (element.tagName.toLowerCase() === 'video') element.play().catch(e => console.warn("Autoplay prevented:", e));
      }
    }
    updateActiveHighlight(media.id, 'playlist');
    if (state.playlist.shuffle) state.playlist.playedInShuffle.add(mediaId);
    updatePlaylistUI();
  };

  const playNextItem = (startIndex = -1) => {
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) { stopPlaylist(); return; }
    if (state.playlist.advancingInProgress) return;
    state.playlist.advancingInProgress = true; clearPlaybackTimers(); let nextIndex;
    if (state.playlist.shuffle) {
      if (state.playlist.playedInShuffle.size >= state.playlist.items.length) state.playlist.playedInShuffle.clear();
      const availableItems = state.playlist.items.filter(id => !state.playlist.playedInShuffle.has(id));
      if (availableItems.length === 0) {
        state.playlist.playedInShuffle.clear();
        nextIndex = Math.floor(Math.random() * state.playlist.items.length);
      } else {
        const randomAvailableId = availableItems[Math.floor(Math.random() * availableItems.length)];
        nextIndex = state.playlist.items.indexOf(randomAvailableId);
      }
    } else { nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length; }
    if (startIndex !== -1 && startIndex >= 0 && startIndex < state.playlist.items.length) nextIndex = startIndex;
    state.playlist.currentIndex = nextIndex; playMediaByIndex(nextIndex);
    setTimeout(() => { state.playlist.advancingInProgress = false; }, 200);
  };

  const clearPlaybackTimers = () => { if (state.playlist.playbackTimer) { clearTimeout(state.playlist.playbackTimer); state.playlist.playbackTimer = null; }};
  const toggleShuffle = () => {
    state.playlist.shuffle = !state.playlist.shuffle;
    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear();
      if (state.playlist.isPlaying && state.playlist.items.length > 0 && state.playlist.currentIndex >=0) {
        const currentMediaIdShuffle = state.playlist.items[state.playlist.currentIndex];
        if(currentMediaIdShuffle) state.playlist.playedInShuffle.add(currentMediaIdShuffle);
      }
    }
    updatePlaylistUI(); saveMediaList(); showNotification(state.playlist.shuffle ? 'Shuffle: On' : 'Shuffle: Off', 'info');
  };
  const stopPlaylist = (resetIndexAndDisplay = true) => {
    state.playlist.isPlaying = false; clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) videoElement.pause();
    if (resetIndexAndDisplay) { state.playlist.currentIndex = -1; clearMediaDisplay(); updateActiveHighlight(null); }
    state.playlist.playedInShuffle.clear(); updatePlaylistUI(); state.activeVideoElement = null;
  };
  const clearMediaDisplay = () => {
    try {
      clearPlaybackTimers(); state.activeVideoElement = null;
      const container = state.dom.mediaContainer;
      while (container.firstChild) {
        const el = container.firstChild;
        if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) {
          el.pause(); el.removeAttribute('src'); el.load();
        }
        container.removeChild(el);
      }
    } catch (e) { console.error("Error clearing media display:", e); if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = ''; }
  };

  const deleteMedia = (id, suppressNotification = false) => {
    const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id);
    if (indexInLibrary === -1) return;
    const mediaToDelete = state.mediaLibrary[indexInLibrary];
    if (mediaToDelete.url && mediaToDelete.url.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.url);
    if (mediaToDelete.thumbnail && mediaToDelete.thumbnail.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.thumbnail);
    state.mediaLibrary.splice(indexInLibrary, 1);
    let wasPlayingDeletedItem = false; let deletedItemOriginalPlaylistIndex = -1;
    for (let i = state.playlist.items.length - 1; i >= 0; i--) {
      if (state.playlist.items[i] === id) {
        if (state.playlist.isPlaying && i === state.playlist.currentIndex) { wasPlayingDeletedItem = true; deletedItemOriginalPlaylistIndex = i; }
        state.playlist.items.splice(i, 1);
        delete state.playlist.transitions[i];
        const newTransitions = {};
        Object.keys(state.playlist.transitions).forEach(keyStr => {
          const oldKey = parseInt(keyStr);
          if (oldKey > i) newTransitions[oldKey - 1] = state.playlist.transitions[keyStr];
          else if (oldKey < i) newTransitions[oldKey] = state.playlist.transitions[keyStr];
        });
        state.playlist.transitions = newTransitions;
        if (i < state.playlist.currentIndex) state.playlist.currentIndex--;
      }
    }
    if (wasPlayingDeletedItem) {
      if (state.playlist.items.length > 0) {
        const nextIndexToPlay = Math.min(deletedItemOriginalPlaylistIndex, state.playlist.items.length - 1);
        state.playlist.currentIndex = nextIndexToPlay; playMediaByIndex(nextIndexToPlay);
      } else stopPlaylist();
    } else if (state.playlist.currentIndex >= state.playlist.items.length && state.playlist.items.length > 0) {
      state.playlist.currentIndex = state.playlist.items.length - 1;
    } else if (state.playlist.items.length === 0) {
      state.playlist.currentIndex = -1; stopPlaylist();
    }
    const currentMediaElement = state.dom.mediaContainer.querySelector(`[src="${mediaToDelete.url}"], video[data-media-id="${id}"]`);
    if (currentMediaElement) { clearMediaDisplay(); updateActiveHighlight(null); }
    if (state.mediaLibrary.length === 0) clearPlaylistLogic(); else updatePlaylistUI();
    updateMediaGallery(); saveMediaList();
    if (!suppressNotification) showNotification(`Deleted: ${mediaToDelete.name}`, 'info');
    clearSelection();
  };

  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer;
    const emptyState = state.dom.playlistEmptyState;
    const controlsContainer = state.dom.playlistControlsContainer;
    if (!playlistContainer || !emptyState || !controlsContainer) { console.error("Playlist UI elements missing in updatePlaylistUI."); return; }

    const fragment = document.createDocumentFragment();
    if (state.playlist.items.length === 0) {
      emptyState.style.display = 'block';
      controlsContainer.style.visibility = 'hidden';
    } else {
      emptyState.style.display = 'none';
      controlsContainer.style.visibility = 'visible';
      state.playlist.items.forEach((mediaId, index) => {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) fragment.appendChild(createPlaylistItem(media, index));
      });
    }
    Array.from(playlistContainer.querySelectorAll('.playlist-item')).forEach(child => child.remove());
    playlistContainer.appendChild(fragment);

    const shuffleButton = document.getElementById('playlist-shuffle-button');
    if (shuffleButton) { shuffleButton.classList.toggle('active', state.playlist.shuffle); shuffleButton.innerHTML = state.playlist.shuffle ? '<span style="filter: grayscale(0%); color: var(--primary-color);">🔀</span> Shuffle On' : '<span style="filter: grayscale(100%);">🔀</span> Shuffle Off'; }
    const playButton = document.getElementById('playlist-play-button');
    if (playButton) playButton.innerHTML = state.playlist.isPlaying ? '<span style="filter: grayscale(100%);">⏸</span> Pause' : '<span style="filter: grayscale(100%);">▶</span> Play All';

    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'playlist') {
      updateActiveHighlight(state.activeHighlight.mediaId, 'playlist');
    }
  };

  const createPlaylistItem = (media, index) => {
    const item = createUIElement('div', {
      className: 'playlist-item',
      attributes: { 'data-id': media.id, 'data-index': index.toString(), draggable: 'true' }
    });
    const highlightRing = createUIElement('div', { className: 'media-active-highlight-ring' });
    item.appendChild(highlightRing);
    item.addEventListener('dragstart', function(e) { e.dataTransfer.setData('application/json', JSON.stringify({ type: 'playlist-reorder', id: media.id, index: index })); e.dataTransfer.effectAllowed = 'move'; this.classList.add('dragging'); });
    item.addEventListener('dragend', function() { this.classList.remove('dragging'); });

    const thumbnailDiv = createUIElement('div', { className: 'playlist-item-thumbnail', style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } : { backgroundColor: '#333' } });
    if (!media.thumbnail) thumbnailDiv.textContent = media.type.charAt(0).toUpperCase();
    item.appendChild(thumbnailDiv);

    const infoContainer = createUIElement('div', { className: 'playlist-item-info' });
    const nameEl = createUIElement('div', { className: 'playlist-item-name', textContent: media.name });
    const detailsEl = createUIElement('div', { className: 'playlist-item-details', textContent: `${media.type.charAt(0).toUpperCase() + media.type.slice(1)} · ${formatFileSize(media.size)}` });

    const transitionData = state.playlist.transitions[index];
    if (transitionData) {
      const transitionName = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionData.transitionId)?.name || 'Custom';
      const transitionIndicator = createUIElement('div', {
        className: 'playlist-item-transition-indicator',
        textContent: `➔ ${transitionName} (${transitionData.params.duration || '?'}ms)`,
      });
      infoContainer.appendChild(transitionIndicator);
    }
    infoContainer.appendChild(nameEl);
    infoContainer.appendChild(detailsEl);
    item.appendChild(infoContainer);

    const controlsWrap = createUIElement('div', {className: 'playlist-item-controls-wrap'});
    const addTransitionBtn = createUIElement('button', {
      className: 'btn btn-icon playlist-item-add-transition',
      innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>',
      attributes: { 'aria-label': `Add transition before ${media.name}`, 'data-index': index.toString() }
    });
    controlsWrap.appendChild(addTransitionBtn);
    const deleteBtn = createUIElement('button', { className: 'btn btn-icon btn-danger playlist-item-delete', innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>', attributes: { 'aria-label': `Remove ${media.name} from playlist` } });
    controlsWrap.appendChild(deleteBtn);
    item.appendChild(controlsWrap);

    if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
      item.classList.add('current');
      const playingIndicator = createUIElement('div', { className: 'playlist-item-playing-indicator', innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>' });
      thumbnailDiv.appendChild(playingIndicator);
    }
    return item;
  };

  const updateActiveHighlight = (mediaId, sourceType) => {
    removeAllActiveHighlights();
    if (!mediaId) { state.activeHighlight.mediaId = null; state.activeHighlight.sourceType = null; return; }
    state.activeHighlight.mediaId = mediaId; state.activeHighlight.sourceType = sourceType;
    let elementToHighlight;
    if (sourceType === 'library') {
      if (state.dom.mediaGallery) elementToHighlight = state.dom.mediaGallery.querySelector(`.media-thumbnail[data-id="${mediaId}"]`);
    } else if (sourceType === 'playlist') {
      if (state.dom.playlistContainer) {
        elementToHighlight = state.dom.playlistContainer.querySelector(`.playlist-item[data-id="${mediaId}"]`);
        state.dom.playlistContainer.querySelectorAll('.playlist-item.current').forEach(el => el.classList.remove('current'));
        if (elementToHighlight) {
          elementToHighlight.classList.add('current');
          const playingIndicator = elementToHighlight.querySelector('.playlist-item-playing-indicator');
          if (state.playlist.isPlaying) {
            if (!playingIndicator) {
              const newIndicator = createUIElement('div', { className: 'playlist-item-playing-indicator', innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>' });
              const thumbnailDiv = elementToHighlight.querySelector('.playlist-item-thumbnail');
              if (thumbnailDiv) thumbnailDiv.appendChild(newIndicator);
            }
          } else {
            if (playingIndicator) playingIndicator.remove();
          }
        }
      }
    }
    if (elementToHighlight) elementToHighlight.classList.add('playing-from-here');
  };

  const removeAllActiveHighlights = () => {
    document.querySelectorAll('.media-thumbnail.playing-from-here, .playlist-item.playing-from-here').forEach(el => el.classList.remove('playing-from-here'));
    if(state.dom.playlistContainer) {
      state.dom.playlistContainer.querySelectorAll('.playlist-item.current').forEach(el => {
        el.classList.remove('current');
        const indicator = el.querySelector('.playlist-item-playing-indicator');
        if (indicator) indicator.remove();
      });
    }
  };

  const saveMediaList = () => {
    try {
      const mediaForStorage = state.mediaLibrary.map(media => {
        const { url, thumbnail, ...mediaMeta } = media;
        return { ...mediaMeta, originalUrlExists: !!url, originalThumbnailExists: !!thumbnail, settings: media.settings || {effects: []} };
      });
      const storageData = { media: mediaForStorage, playlist: { items: state.playlist.items, shuffle: state.playlist.shuffle, transitions: state.playlist.transitions || {} } };
      localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(storageData));
    } catch (e) { console.error('Failed to save media list:', e); }
  };

  const loadSavedMedia = () => {
    try {
      const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEY);
      if (!savedData) {
        const oldSavedData = localStorage.getItem(CONSTANTS.STORAGE_KEY_OLD);
        if (oldSavedData) {
          try {
            const oldParsedData = JSON.parse(oldSavedData);
            if (oldParsedData.media?.length > 0) showNotification(`Found old library data (${oldParsedData.media.length} items). Please re-import files for full functionality.`, 'warning', 10000);
            localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
          } catch (oldParseError) { console.warn("Error parsing old saved data, removing it:", oldParseError); localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD); }
        }
        updateMediaGallery(); updatePlaylistUI(); return;
      }
      const parsedData = JSON.parse(savedData);
      if (parsedData.media?.length > 0) showNotification(`Loaded metadata for ${parsedData.media.length} media entries. Re-import files for playback.`, 'info', 7000);
      state.mediaLibrary = (parsedData.media || []).map(media => ({ ...media, url: null, thumbnail: createFallbackThumbnail(media.type), settings: media.settings || { effects: [] } }));
      state.playlist.items = parsedData.playlist?.items || [];
      state.playlist.shuffle = parsedData.playlist?.shuffle || false;
      state.playlist.transitions = parsedData.playlist?.transitions || {};
      updateMediaGallery(); updatePlaylistUI();
    } catch (e) { console.error('Failed to load saved media:', e); localStorage.removeItem(CONSTANTS.STORAGE_KEY); updateMediaGallery(); updatePlaylistUI(); }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
    const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  const showNotification = (message, type = 'info', duration = (typeof WallpaperApp !== 'undefined' ? WallpaperApp.config.notificationDuration : 3000)) => {
    if (typeof WallpaperApp !== 'undefined' && typeof WallpaperApp.UI?.showNotification === 'function') WallpaperApp.UI.showNotification(message, type, duration);
    else console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`);
  };

  return {
    init,
    hideContextMenu,
    hideInlinePanel,
    _getState: () => state
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', MediaModule.init);
} else {
  MediaModule.init();
}

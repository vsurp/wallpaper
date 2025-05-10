/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Version 0.1.4 - Refactored video trim preview logic extensively
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
    STORAGE_KEY: 'flStudioWallpaper_media_v3',
    STORAGE_KEY_OLD: 'flStudioWallpaper_media_v2',
    VIDEO_METADATA_TIMEOUT: 10000,
    VIDEO_THUMBNAIL_TIMEOUT: 10000
  };

  // Application state
  const state = {
    mediaLibrary: [],
    playlist: {
      items: [],
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
      playlistSection: null
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
    fileInput: null
  };

  // Initialization
  const init = () => {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initMediaImporter, 100);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') state.selection.shiftKeyActive = true;
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') state.selection.shiftKeyActive = false;
    });
  };

  const initMediaImporter = () => {
    state.dom.importSubmenu = document.getElementById('import-media-submenu');
    state.dom.mediaContainer = document.getElementById('media-container');

    if (!state.dom.importSubmenu || !state.dom.mediaContainer) {
      console.error('Required DOM elements not found for MediaModule. Retrying in 1s...');
      setTimeout(initMediaImporter, 1000);
      return;
    }

    setupMediaImportUI();
    loadSavedMedia();
  };

  // UI Setup Functions
  const setupMediaImportUI = () => {
    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
    if (!menuContent) {
      console.error("Menu content not found in import-media-submenu");
      return;
    }

    menuContent.innerHTML = '';
    setupFileInput();

    const importButton = createUIElement('button', {
      className: 'submenu-item import-media-button',
      textContent: 'IMPORT MEDIA',
      attributes: { 'data-action': 'import-media-action' },
      events: { click: () => state.fileInput.click() }
    });
    menuContent.appendChild(importButton);
    menuContent.appendChild(createDivider());

    const mediaLibrarySection = createMediaLibrarySection();
    state.dom.mediaLibrarySection = mediaLibrarySection;
    menuContent.appendChild(mediaLibrarySection);
    menuContent.appendChild(createDivider());

    const quickNavSection = createQuickNavSection();
    menuContent.appendChild(quickNavSection);
    menuContent.appendChild(createDivider());

    const playlistSection = createPlaylistSection();
    state.dom.playlistSection = playlistSection;
    menuContent.appendChild(playlistSection);

    state.dom.playbackControls = { style: { display: 'none' } };
  };

  const setupFileInput = () => {
    if (state.fileInput && state.fileInput.parentNode) {
      state.fileInput.parentNode.removeChild(state.fileInput);
    }

    state.fileInput = createUIElement('input', {
      type: 'file',
      id: 'media-file-input',
      accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','),
      multiple: true,
      style: { display: 'none' },
      events: {
        change: (e) => {
          handleFileSelect(e.target.files);
          e.target.value = '';
        }
      }
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

  const createDivider = () => {
    const hr = document.createElement('hr');
    hr.className = 'divider';
    return hr;
  };

  const createMediaLibrarySection = () => {
    const section = document.createElement('div');
    section.id = 'media-library-section';
    const title = createUIElement('h3', { textContent: 'MEDIA LIBRARY' });
    const selectionInfo = createUIElement('div', { className: 'selection-info', textContent: 'Shift+Click or drag to select multiple' });
    const gallery = createUIElement('div', { id: 'media-gallery' });
    setupGalleryDragSelection(gallery);
    const emptyState = createUIElement('div', { id: 'media-empty-state', textContent: '' });
    gallery.appendChild(emptyState);
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
          left: state.selection.startPoint.x - gallery.scrollLeft + 'px',
          top: state.selection.startPoint.y - gallery.scrollTop + 'px',
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
      state.selection.selectionBoxElement.style.left = x1 - gallery.scrollLeft + 'px';
      state.selection.selectionBoxElement.style.top = y1 - gallery.scrollTop + 'px';
      state.selection.selectionBoxElement.style.width = (x2 - x1) + 'px';
      state.selection.selectionBoxElement.style.height = (y2 - y1) + 'px';
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

  const createQuickNavSection = () => {
    const section = createUIElement('div', { id: 'quick-nav-section' });
    const effectsButton = createUIElement('button', {
      id: 'effects-quick-nav-button', textContent: 'EFFECTS', className: 'quick-nav-button btn btn-secondary',
      events: { click: () => {
          if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
            window.WallpaperApp.MenuTools.openL2Submenu('effects-list-submenu');
            applyTemporaryHighlight(state.dom.mediaLibrarySection);
          } else showNotification('Menu function (effects) not available.', 'warning');
        }}
    });
    const transitionsButton = createUIElement('button', {
      id: 'transitions-quick-nav-button', textContent: 'TRANSITIONS', className: 'quick-nav-button btn btn-secondary',
      events: { click: () => {
          if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
            window.WallpaperApp.MenuTools.openL2Submenu('transitions-list-submenu');
            applyTemporaryHighlight(state.dom.playlistSection);
          } else showNotification('Menu function (transitions) not available.', 'warning');
        }}
    });
    section.appendChild(effectsButton);
    section.appendChild(transitionsButton);
    return section;
  };

  const createPlaylistSection = () => {
    const section = createUIElement('div', { id: 'playlist-section' });
    const title = createUIElement('h3', { textContent: 'PLAYLIST' });
    const playlistContainer = createUIElement('div', {
      id: 'playlist-container',
      events: {
        dragover: handlePlaylistDragOver,
        drop: handlePlaylistDrop,
        dragenter: (e) => { e.preventDefault(); playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)'; },
        dragleave: (e) => { e.preventDefault(); playlistContainer.style.backgroundColor = ''; }
      }
    });
    const emptyState = createUIElement('div', { id: 'playlist-empty-state', textContent: 'Drag media here to create playlist' });
    playlistContainer.appendChild(emptyState);
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
      { id: 'playlist-play-button', html: '<span style="filter: grayscale(100%);">▶</span> Play All', handler: playPlaylist, class: 'btn-primary' },
      { id: 'playlist-shuffle-button', html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle', handler: toggleShuffle, class: 'btn-secondary' },
      { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', handler: clearPlaylist, class: 'btn-danger' }
    ];
    buttons.forEach(btnData => {
      const button = createUIElement('button', {
        id: btnData.id, innerHTML: btnData.html, className: `btn playlist-button ${btnData.class || 'btn-secondary'}`,
        events: { click: btnData.handler }
      });
      controlsContainer.appendChild(button);
    });
  };

  // Media Management Functions
  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;
    let validCount = 0;
    let invalidCount = 0;
    const processingPromises = [];
    Array.from(files).forEach(file => {
      if (isFileSupported(file.type)) {
        processingPromises.push(processFile(file).then(() => validCount++));
      } else invalidCount++;
    });
    await Promise.all(processingPromises);
    if (validCount > 0) showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}.`, 'success');
    if (invalidCount > 0) showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} not supported.`, 'warning');
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
      settings: { volume: 0, playbackRate: 1, originalDuration: null },
      trimSettings: type === 'video' ? { trimEnabled: false, startTime: 0, endTime: null } : null
    };
    state.mediaLibrary.push(mediaItem);
    try {
      mediaItem.thumbnail = await generateThumbnail(mediaItem, file);
    } catch (err) {
      console.warn(`Error generating thumbnail for ${mediaItem.name}:`, err);
      mediaItem.thumbnail = createFallbackThumbnail(mediaItem.type);
    }
    if (type === 'video') {
      try {
        mediaItem.settings.originalDuration = await getVideoDuration(mediaItem.url);
        if (mediaItem.trimSettings) mediaItem.trimSettings.endTime = mediaItem.settings.originalDuration;
      } catch (err) {
        console.warn(`Error getting video duration for ${mediaItem.name}:`, err);
        mediaItem.settings.originalDuration = 0;
        if (mediaItem.trimSettings) mediaItem.trimSettings.endTime = 0;
      }
    }
  };

  const generateMediaId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  const getVideoDuration = (videoUrl) => {
    return new Promise((resolve, reject) => {
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
  };

  const generateThumbnail = (mediaItem, file) => {
    return new Promise((resolve, reject) => {
      if (mediaItem.type === 'image') {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`FileReader error for ${mediaItem.name}`));
        reader.readAsDataURL(file);
      } else if (mediaItem.type === 'video') {
        generateVideoThumbnail(mediaItem.url, mediaItem.name).then(resolve).catch(reject);
      } else reject(new Error(`Unsupported type for thumbnail generation: ${mediaItem.type}`));
    });
  };

  const generateVideoThumbnail = (videoUrl, videoName) => {
    return new Promise((resolve, reject) => {
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
      video.onerror = (e) => cleanupAndReject(`Error loading video for thumbnail: ${videoName}. Error: ${e.message || e.type}`);
      timeoutId = setTimeout(() => {
        if (!thumbnailGenerated) cleanupAndReject(`Thumbnail generation timeout for ${videoName} after ${CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT}ms.`);
      }, CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT);
      try { video.src = videoUrl; }
      catch (e) { cleanupAndReject(`Error setting video source for thumbnail: ${videoName}. Error: ${e.message}`); }
    });
  };

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

  // UI Update Functions
  const updateMediaGallery = () => {
    const gallery = state.dom.mediaGallery;
    const emptyState = document.getElementById('media-empty-state');
    if (!gallery) { console.error("Media gallery DOM element not found, cannot update."); return; }
    if (emptyState) {
      emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
      if (state.mediaLibrary.length === 0) emptyState.textContent = '';
    }
    Array.from(gallery.children).forEach(child => {
      if (child.id !== 'media-empty-state' && !child.classList.contains('selection-box')) child.remove();
    });
    state.mediaLibrary.forEach(media => gallery.appendChild(createMediaThumbnail(media)));
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
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'multiple-media', ids: Array.from(state.selection.items) }));
      } else e.dataTransfer.setData('text/plain', media.id);
      e.dataTransfer.effectAllowed = 'copy'; thumbnail.classList.add('dragging');
    });
    thumbnail.addEventListener('dragend', () => thumbnail.classList.remove('dragging'));
    const imgContainer = createUIElement('div', {
      className: 'media-thumbnail-img-container',
      style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } :
          { backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white', fontWeight: 'bold' }
    });
    if (!media.thumbnail) imgContainer.textContent = media.type.charAt(0).toUpperCase();
    thumbnail.appendChild(imgContainer);
    const nameLabel = createUIElement('div', { className: 'media-thumbnail-name', textContent: media.name });
    thumbnail.appendChild(nameLabel);
    const badge = createUIElement('div', { className: 'media-type-badge', textContent: media.type.toUpperCase() });
    thumbnail.appendChild(badge);
    const settingsBtn = createUIElement('button', {
      className: 'media-settings-btn btn btn-icon', innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49 1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>',
      attributes: { 'aria-label': `Settings for ${media.name}` },
      events: { click: (e) => { e.stopPropagation(); openMediaSettingsDialog(media); } }
    });
    thumbnail.appendChild(settingsBtn);
    const deleteBtn = createUIElement('button', {
      className: 'media-delete-btn btn btn-icon btn-danger', innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': `Delete ${media.name}` },
      events: { click: (e) => {
          e.stopPropagation();
          if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
            if (confirm(`Delete ${state.selection.items.size} selected clips? This cannot be undone.`)) {
              Array.from(state.selection.items).forEach(idToDelete => deleteMedia(idToDelete));
              clearSelection();
            }
          } else if (confirm(`Delete "${media.name}"? This cannot be undone.`)) deleteMedia(media.id);
        }}
    });
    thumbnail.appendChild(deleteBtn);
    thumbnail.setAttribute('title', media.name);
    thumbnail.addEventListener('click', (e) => handleThumbnailClick(e, media));
    return thumbnail;
  };

  // Selection Management
  const handleThumbnailClick = (e, media) => {
    const settingsBtn = e.currentTarget.querySelector('.media-settings-btn');
    const deleteBtn = e.currentTarget.querySelector('.media-delete-btn');
    if (e.target === settingsBtn || settingsBtn?.contains(e.target) || e.target === deleteBtn || deleteBtn?.contains(e.target)) return;

    if (state.selection.shiftKeyActive && state.selection.lastSelected) selectRange(state.selection.lastSelected, media.id);
    else if (state.selection.shiftKeyActive) { clearSelection(); addToSelection(media.id); state.selection.lastSelected = media.id; }
    else if (e.ctrlKey || e.metaKey) { toggleSelection(media.id); state.selection.lastSelected = state.selection.items.has(media.id) ? media.id : null; }
    else {
      const wasSelected = state.selection.items.has(media.id);
      const multipleSelected = state.selection.items.size > 1;
      if (wasSelected && !multipleSelected) selectMedia(media, true);
      else { clearSelection(); addToSelection(media.id); state.selection.lastSelected = media.id; selectMedia(media, true); }
    }
    updateMediaSelectionUI();
  };

  const clearSelection = () => { state.selection.items.clear(); state.selection.lastSelected = null; updateMediaSelectionUI(); };
  const addToSelection = (mediaId) => state.selection.items.add(mediaId);
  const removeFromSelection = (mediaId) => state.selection.items.delete(mediaId);
  const toggleSelection = (mediaId) => {
    if (state.selection.items.has(mediaId)) state.selection.items.delete(mediaId);
    else state.selection.items.add(mediaId);
  };
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

  // Media Settings Dialog
  const openMediaSettingsDialog = (media) => {
    const existingDialog = document.getElementById('media-settings-dialog-backdrop');
    if (existingDialog) existingDialog.remove();
    const backdrop = createUIElement('div', { id: 'media-settings-dialog-backdrop', className: 'media-settings-dialog-backdrop acrylic acrylic-dark' });
    const dialog = createUIElement('div', { id: 'media-settings-dialog', className: 'media-settings-dialog' });
    setTimeout(() => { dialog.classList.add('open'); backdrop.classList.add('open'); }, 10);
    createDialogContent(dialog, media, backdrop);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    const firstInput = dialog.querySelector('input, textarea, select');
    if (firstInput) firstInput.focus();
  };

  const createDialogContent = (dialog, media, backdrop) => {
    const header = createUIElement('div', { className: 'media-settings-dialog-header' });
    const title = createUIElement('h3', { textContent: `Settings: ${media.name}` });
    const closeBtn = createUIElement('button', {
      className: 'btn btn-icon dialog-close-btn', innerHTML: '&times;',
      attributes: { 'aria-label': 'Close settings' }, events: { click: () => closeDialog(dialog, backdrop) }
    });
    header.appendChild(title); header.appendChild(closeBtn); dialog.appendChild(header);
    const body = createUIElement('div', { className: 'media-settings-dialog-body' });
    const settingsTooltip = createUIElement('div', { className: 'settings-tooltip', textContent: 'Settings apply to playback from library and playlist.' });
    body.appendChild(settingsTooltip);
    const nameGroup = createFormGroup('Clip Name:', 'text', media.name, `media-name-${media.id}`);
    body.appendChild(nameGroup);
    if (media.type === 'video') createVideoSettings(body, media);
    const navButtonsContainer = createUIElement('div', { style: { display: 'flex', gap: '10px', marginTop: '20px' } });
    const effectsLink = createUIElement('button', {
      textContent: 'EFFECTS', className: 'btn btn-secondary setting-btn', style: { flex: '1' },
      events: { click: () => { closeBtn.click(); document.getElementById('effects-quick-nav-button')?.click(); }}
    });
    const transitionsLink = createUIElement('button', {
      textContent: 'TRANSITIONS', className: 'btn btn-secondary setting-btn', style: { flex: '1' },
      events: { click: () => { closeBtn.click(); document.getElementById('transitions-quick-nav-button')?.click(); }}
    });
    navButtonsContainer.appendChild(effectsLink); navButtonsContainer.appendChild(transitionsLink); body.appendChild(navButtonsContainer);
    dialog.appendChild(body);
    const footer = createUIElement('div', { className: 'media-settings-dialog-footer' });
    const saveBtn = createUIElement('button', {
      className: 'btn btn-primary', textContent: 'Save Changes',
      events: { click: () => saveMediaSettings(media, dialog, backdrop) }
    });
    const cancelBtn = createUIElement('button', {
      className: 'btn btn-secondary', textContent: 'Cancel', events: { click: () => closeBtn.click() }
    });
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn); dialog.appendChild(footer);
  };

  const createFormGroup = (labelText, inputType, inputValue, inputId, options = {}) => {
    const group = createUIElement('div', { className: 'form-group' });
    const label = createUIElement('label', { htmlFor: inputId, textContent: labelText });
    const input = createUIElement('input', { type: inputType, id: inputId, value: inputValue, ...options });
    group.appendChild(label); group.appendChild(input);
    return group;
  };

  const createVideoSettings = (body, media) => {
    const trimGroup = createUIElement('div', { className: 'form-group' });
    const trimLabel = createUIElement('label', { textContent: 'Trim Video:' });
    trimGroup.appendChild(trimLabel);

    const videoPreview = createUIElement('video', {
      src: media.url, controls: true, muted: true,
      style: { width: '100%', marginBottom: '10px', backgroundColor: '#000', borderRadius: '4px' }
    });

    let videoDuration = media.settings?.originalDuration || 0;
    console.log(`[Trim Editor for ${media.name}] Initial videoDuration: ${videoDuration.toFixed(3)}s`);

    // Deep copy trim settings to avoid modifying original object until save
    let currentTrimSettings = JSON.parse(JSON.stringify(media.trimSettings || {
      trimEnabled: false, startTime: 0, endTime: videoDuration
    }));

    // Ensure endTime is initialized correctly if null or invalid, based on a valid videoDuration
    if (videoDuration > 0) {
      if (currentTrimSettings.endTime === null || currentTrimSettings.endTime > videoDuration || currentTrimSettings.endTime <= 0) {
        currentTrimSettings.endTime = videoDuration;
      }
      // Ensure startTime is not greater than endTime
      if (currentTrimSettings.startTime >= currentTrimSettings.endTime) {
        currentTrimSettings.startTime = Math.max(0, currentTrimSettings.endTime - 0.1); // Ensure startTime is before endTime
      }
    } else { // If videoDuration is not yet known or 0
      currentTrimSettings.endTime = 0; // Or handle as appropriate, maybe disable trimming
      currentTrimSettings.startTime = 0;
    }
    console.log(`[Trim Editor for ${media.name}] Initial currentTrimSettings:`, JSON.parse(JSON.stringify(currentTrimSettings)));

    videoPreview.onloadedmetadata = function() {
      const elementDuration = this.duration;
      console.log(`[Trim Editor for ${media.name}] onloadedmetadata: Element duration=${elementDuration.toFixed(3)}s. Current videoDuration state=${videoDuration.toFixed(3)}s`);

      if (typeof elementDuration === 'number' && !isNaN(elementDuration) && elementDuration > 0) {
        videoDuration = elementDuration; // Update with the most accurate duration
        console.log(`[Trim Editor for ${media.name}] onloadedmetadata: Updated videoDuration to ${videoDuration.toFixed(3)}s`);

        // Update originalDuration in media object if it wasn't set or was incorrect
        if (!media.settings.originalDuration || media.settings.originalDuration <= 0 || Math.abs(media.settings.originalDuration - videoDuration) > 0.01) {
          media.settings.originalDuration = videoDuration;
        }

        // Re-validate/initialize currentTrimSettings.endTime based on the (potentially new) videoDuration
        if (currentTrimSettings.endTime === null || currentTrimSettings.endTime > videoDuration || currentTrimSettings.endTime <= currentTrimSettings.startTime) {
          currentTrimSettings.endTime = videoDuration;
          console.log(`[Trim Editor for ${media.name}] onloadedmetadata: Adjusted endTime to ${currentTrimSettings.endTime.toFixed(3)}s`);
        }
        // Ensure startTime is valid and not after endTime
        if (currentTrimSettings.startTime >= videoDuration || currentTrimSettings.startTime >= currentTrimSettings.endTime) {
          currentTrimSettings.startTime = 0; // Reset or adjust as needed
          console.log(`[Trim Editor for ${media.name}] onloadedmetadata: Adjusted startTime to ${currentTrimSettings.startTime.toFixed(3)}s due to invalid range`);
        }
      }

      this.currentTime = currentTrimSettings.startTime || 0;
      console.log(`[Trim Editor for ${media.name}] onloadedmetadata: Set currentTime to ${this.currentTime.toFixed(3)}s`);
      updateTrimUI(); // Update sliders and text displays

      if (currentTrimSettings.trimEnabled && videoDuration > 0) {
        console.log(`[Trim Editor for ${media.name}] onloadedmetadata: Trim is enabled & videoDuration > 0. Start: ${currentTrimSettings.startTime.toFixed(3)}s, End: ${currentTrimSettings.endTime.toFixed(3)}s. Attempting to play.`);
        this.play().catch(err => console.warn(`[Trim Editor for ${media.name}] Initial preview play (onloadedmetadata, trim enabled) interrupted:`, err.message));
      } else {
        console.log(`[Trim Editor for ${media.name}] onloadedmetadata: Trim not enabled OR videoDuration is 0. Preview will not autoplay. TrimEnabled: ${currentTrimSettings.trimEnabled}, videoDuration: ${videoDuration.toFixed(3)}s`);
      }
    };

    videoPreview.onerror = function(e) {
      console.error(`[Trim Editor for ${media.name}] Error loading video preview:`, e.target.error?.message || 'Unknown error');
      const timeDisplay = trimGroup.querySelector('.time-display-js');
      if (timeDisplay) timeDisplay.textContent = "Error loading preview.";
      // Optionally disable sliders here
      document.getElementById(`trim-start-${media.id}`).disabled = true;
      document.getElementById(`trim-end-${media.id}`).disabled = true;
    };

    videoPreview.addEventListener('timeupdate', function() {
      if (this.seeking) return; // Don't interfere with user seeking

      // Fallback: if videoDuration wasn't set by onloadedmetadata but element has it now
      if (!(videoDuration > 0) && this.duration > 0 && !isNaN(this.duration)) {
        console.log(`[Trim Editor for ${media.name}] timeupdate: videoDuration was ${videoDuration.toFixed(3)}, but element now has ${this.duration.toFixed(3)}. Re-initializing duration-dependent settings.`);
        videoDuration = this.duration;
        if (!media.settings.originalDuration || media.settings.originalDuration <= 0) {
          media.settings.originalDuration = videoDuration;
        }
        // Re-validate trim settings based on new duration
        if (currentTrimSettings.endTime === null || currentTrimSettings.endTime > videoDuration || currentTrimSettings.endTime <= currentTrimSettings.startTime) {
          currentTrimSettings.endTime = videoDuration;
        }
        if (currentTrimSettings.startTime >= videoDuration) {
          currentTrimSettings.startTime = 0;
        }
        updateTrimUI(); // Update UI to reflect new duration calculations
      }

      if (!(videoDuration > 0) || !currentTrimSettings || !currentTrimSettings.trimEnabled) {
        return; // Not ready or trim not active
      }

      const playbackStartTime = currentTrimSettings.startTime;
      const playbackEndTime = currentTrimSettings.endTime;

      // Loop logic
      if (this.currentTime >= playbackEndTime - 0.1 || this.currentTime < playbackStartTime) {
        // console.log(`[Trim Editor for ${media.name}] timeupdate: Looping/Correcting. CT: ${this.currentTime.toFixed(3)} -> ${playbackStartTime.toFixed(3)}. Paused: ${this.paused}`);
        this.currentTime = playbackStartTime;
        // Ensure it plays after resetting time for loop, even if it was paused by browser or end of segment
        this.play().catch(err => {
          // console.warn(`[Trim Editor for ${media.name}] Preview loop play attempt at ${this.currentTime.toFixed(3)}s interrupted:`, err.message);
        });
      }
    });

    trimGroup.appendChild(videoPreview);
    const trimDescription = createUIElement('div', { className: 'trim-description', textContent: 'Adjust start and end points. Video will loop within the trimmed section during preview.' });
    trimGroup.appendChild(trimDescription);
    const trimContainer = createUIElement('div');

    const startTimeGroup = createTrimControl('Start Point:', `trim-start-${media.id}`, (value) => {
      if (videoDuration <= 0) { console.warn(`[Trim Editor for ${media.name}] Start slider: videoDuration is 0 or invalid. Ignoring.`); return; }
      const percent = parseFloat(value) / 100;
      let newStartTime = Math.max(0, percent * videoDuration);

      // Ensure startTime does not exceed endTime
      if (newStartTime >= currentTrimSettings.endTime && currentTrimSettings.endTime > 0.01) { // allow some buffer
        newStartTime = Math.max(0, currentTrimSettings.endTime - 0.01);
      } else if (newStartTime >= currentTrimSettings.endTime) { // if endTime is 0 or very small
        newStartTime = 0;
      }
      currentTrimSettings.startTime = newStartTime;
      currentTrimSettings.trimEnabled = true;
      updateTrimUI();
      videoPreview.currentTime = currentTrimSettings.startTime;
      console.log(`[Trim Editor for ${media.name}] Start slider: Set preview currentTime to ${videoPreview.currentTime.toFixed(3)}s. Attempting to play.`);
      videoPreview.play().catch(err => console.warn(`[Trim Editor for ${media.name}] Preview play after start trim (to time ${videoPreview.currentTime.toFixed(3)}s) interrupted:`, err.message));
    });

    const endTimeGroup = createTrimControl('End Point:', `trim-end-${media.id}`, (value) => {
      if (videoDuration <= 0) { console.warn(`[Trim Editor for ${media.name}] End slider: videoDuration is 0 or invalid. Ignoring.`); return; }
      const percent = parseFloat(value) / 100;
      let newEndTime = Math.min(videoDuration, percent * videoDuration);

      // Ensure endTime is not before startTime
      if (newEndTime <= currentTrimSettings.startTime && currentTrimSettings.startTime < videoDuration - 0.01) { // allow some buffer
        newEndTime = Math.min(videoDuration, currentTrimSettings.startTime + 0.01);
      } else if (newEndTime <= currentTrimSettings.startTime) { // if startTime is at the very end
        newEndTime = videoDuration;
      }
      currentTrimSettings.endTime = newEndTime;
      currentTrimSettings.trimEnabled = true;
      updateTrimUI();
      videoPreview.currentTime = currentTrimSettings.startTime; // Seek to start of trim for consistent preview
      console.log(`[Trim Editor for ${media.name}] End slider: Set preview currentTime to ${videoPreview.currentTime.toFixed(3)}s (start of trim). Attempting to play.`);
      videoPreview.play().catch(err => console.warn(`[Trim Editor for ${media.name}] Preview play after end trim (to time ${videoPreview.currentTime.toFixed(3)}s) interrupted:`, err.message));
    });

    trimContainer.appendChild(startTimeGroup); trimContainer.appendChild(endTimeGroup);
    const trimUIContainer = createUIElement('div', { style: { position: 'relative', height: '20px', backgroundColor: '#111', borderRadius: '4px', overflow: 'hidden', marginTop: '15px', marginBottom: '15px' } });
    const timeline = createUIElement('div', { style: { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: '#333' } });
    const trimRegion = createUIElement('div', { style: { position: 'absolute', top: '0', height: '100%', backgroundColor: 'rgba(var(--primary-color-rgb), 0.5)', borderLeft: '2px solid var(--primary-color)', borderRight: '2px solid var(--primary-color)', boxSizing: 'border-box' } });
    const timeDisplay = createUIElement('div', { className: 'time-display-js', style: { marginTop: '5px', fontSize: '12px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' } });

    const updateTrimUI = () => {
      const startInput = document.getElementById(`trim-start-${media.id}`);
      const endInput = document.getElementById(`trim-end-${media.id}`);

      if (videoDuration <= 0) {
        if (startInput) { startInput.value = 0; startInput.disabled = true; }
        if (endInput) { endInput.value = 100; endInput.disabled = true; }
        timeDisplay.textContent = 'Waiting for video duration...';
        trimRegion.style.left = '0%'; trimRegion.style.width = '0%';
        // console.log(`[Trim Editor for ${media.name}] updateTrimUI: videoDuration is ${videoDuration.toFixed(3)}s. UI disabled.`);
        return;
      }

      if (startInput) startInput.disabled = false;
      if (endInput) endInput.disabled = false;

      // Ensure currentTrimSettings are valid against the current videoDuration
      currentTrimSettings.startTime = Math.max(0, Math.min(currentTrimSettings.startTime ?? 0, videoDuration));
      currentTrimSettings.endTime = Math.max(currentTrimSettings.startTime, Math.min(currentTrimSettings.endTime ?? videoDuration, videoDuration));
      if (currentTrimSettings.endTime <= currentTrimSettings.startTime) { // Final check if somehow still invalid
        currentTrimSettings.endTime = Math.min(videoDuration, currentTrimSettings.startTime + 0.1);
        if (currentTrimSettings.endTime <= currentTrimSettings.startTime) currentTrimSettings.endTime = videoDuration;
      }

      const startVal = currentTrimSettings.startTime;
      const endVal = currentTrimSettings.endTime;
      const startPercent = (startVal / videoDuration) * 100;
      const endPercent = (endVal / videoDuration) * 100;

      trimRegion.style.left = `${startPercent}%`;
      trimRegion.style.width = `${Math.max(0, endPercent - startPercent)}%`;
      timeDisplay.textContent = `Start: ${formatTime(startVal)} | End: ${formatTime(endVal)} | Duration: ${formatTime(Math.max(0, endVal - startVal))}`;

      if (startInput && parseFloat(startInput.value) !== startPercent) startInput.value = startPercent;
      if (endInput && parseFloat(endInput.value) !== endPercent) endInput.value = endPercent;

      const startDisplay = startTimeGroup.querySelector('span');
      const endDisplay = endTimeGroup.querySelector('span');
      if (startDisplay) startDisplay.textContent = formatTime(startVal);
      if (endDisplay) endDisplay.textContent = formatTime(endVal);
      // console.log(`[Trim Editor for ${media.name}] updateTrimUI: Updated. Start=${startVal.toFixed(3)}, End=${endVal.toFixed(3)}, Duration=${videoDuration.toFixed(3)}`);
    };

    timeline.addEventListener('click', (e) => {
      if (videoDuration <= 0) return;
      const trimRect = trimUIContainer.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - trimRect.left) / trimRect.width));
      videoPreview.currentTime = percent * videoDuration;
      if (currentTrimSettings.trimEnabled) {
        console.log(`[Trim Editor for ${media.name}] Timeline click: Set preview currentTime to ${videoPreview.currentTime.toFixed(3)}s. Attempting to play.`);
        videoPreview.play().catch(err => console.warn(`[Trim Editor for ${media.name}] Preview play after timeline click interrupted:`, err.message));
      }
    });

    timeline.appendChild(trimRegion); trimUIContainer.appendChild(timeline);
    trimContainer.appendChild(trimUIContainer); trimContainer.appendChild(timeDisplay);
    trimGroup.appendChild(trimContainer); body.appendChild(trimGroup);

    // Store currentTrimSettings and updateTrimUI on the body for access in saveMediaSettings
    body.currentTrimSettings = currentTrimSettings;
    body.updateTrimUI = updateTrimUI; // Expose for potential external calls if needed

    const volumeGroup = createSliderControl('Volume:', `media-volume-${media.id}`, media.settings?.volume ?? 0, 0, 1, 0.01, (value) => { videoPreview.volume = parseFloat(value); videoPreview.muted = parseFloat(value) === 0; }, (value) => `${Math.round(parseFloat(value) * 100)}%`);
    body.appendChild(volumeGroup);
    const rateGroup = createSliderControl('Playback Speed:', `media-rate-${media.id}`, media.settings?.playbackRate ?? 1, 0.25, 2, 0.05, (value) => { videoPreview.playbackRate = parseFloat(value); }, (value) => `${parseFloat(value).toFixed(2)}x`);
    body.appendChild(rateGroup);

    updateTrimUI(); // Initial UI setup based on current settings
  };

  const createTrimControl = (labelText, inputId, onInput) => {
    const group = createUIElement('div', { className: 'form-group', style: { marginBottom: '15px' } });
    const label = createUIElement('label', { htmlFor: inputId, textContent: labelText });
    const input = createUIElement('input', { type: 'range', id: inputId, min: '0', max: '100', step: '0.1', value: '0', events: { input: (e) => onInput(e.target.value) } });
    const valueDisplay = createUIElement('span', { style: { marginLeft: '10px', minWidth: '50px', display: 'inline-block' } });
    group.appendChild(label); group.appendChild(input); group.appendChild(valueDisplay);
    return group;
  };

  const createSliderControl = (labelText, inputId, defaultValue, min, max, step, onInput, formatValue) => {
    const group = createUIElement('div', { className: 'form-group' });
    const label = createUIElement('label', { htmlFor: inputId, textContent: labelText });
    const inputContainer = createUIElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' }});
    const input = createUIElement('input', {
      type: 'range', id: inputId, min: min.toString(), max: max.toString(), step: step.toString(), value: defaultValue.toString(),
      style: { flexGrow: '1'}, events: { input: (e) => { const value = e.target.value; valueDisplay.textContent = formatValue(value); if (onInput) onInput(value); } }
    });
    const valueDisplay = createUIElement('span', { textContent: formatValue(defaultValue), style: { minWidth: '40px', textAlign: 'right'} });
    inputContainer.appendChild(input); inputContainer.appendChild(valueDisplay);
    group.appendChild(label); group.appendChild(inputContainer);
    return group;
  };

  const saveMediaSettings = (media, dialog, backdrop) => {
    media.name = document.getElementById(`media-name-${media.id}`).value.trim() || media.name;
    if (media.type === 'video') {
      if (!media.settings) media.settings = {};
      media.settings.volume = parseFloat(document.getElementById(`media-volume-${media.id}`).value);
      media.settings.playbackRate = parseFloat(document.getElementById(`media-rate-${media.id}`).value);

      const body = dialog.querySelector('.media-settings-dialog-body');
      if (body && body.currentTrimSettings) {
        // Use the originalDuration from media.settings as the source of truth for duration
        const videoDuration = media.settings.originalDuration || 0;
        let { startTime, endTime, trimEnabled } = body.currentTrimSettings;

        // Validate and sanitize trim values against the known original duration
        startTime = Math.max(0, Math.min(startTime ?? 0, videoDuration));
        endTime = Math.max(startTime, Math.min(endTime ?? videoDuration, videoDuration));
        if (endTime <= startTime && videoDuration > 0) { // Ensure endTime is always after startTime if duration exists
          endTime = videoDuration;
        }

        // Determine if trim is effectively active (i.e., actually changes playback from full duration)
        const effectivelyTrimmed = (startTime > 0.01) ||
            (videoDuration > 0 && Math.abs(endTime - videoDuration) > 0.01 && endTime < videoDuration);

        media.trimSettings = {
          startTime: parseFloat(startTime.toFixed(3)), // Store with precision
          endTime: parseFloat(endTime.toFixed(3)),   // Store with precision
          trimEnabled: trimEnabled && effectivelyTrimmed
        };
        console.log(`[Trim Editor for ${media.name}] Saving trim settings:`, JSON.parse(JSON.stringify(media.trimSettings)));
      } else {
        console.warn(`[Trim Editor for ${media.name}] Could not find currentTrimSettings on dialog body during save.`);
      }
    }
    updateMediaGallery();
    updatePlaylistUI(); // This will re-render playlist items, potentially showing new trim indicators
    saveMediaList();
    showNotification('Settings saved!', 'success');
    closeDialog(dialog, backdrop);
  };

  const closeDialog = (dialog, backdrop) => {
    dialog.classList.remove('open'); backdrop.classList.remove('open');
    const videoPreview = dialog.querySelector('video');
    if (videoPreview) {
      console.log(`[Trim Editor] Closing dialog. Pausing video preview for dialog associated with media.`);
      videoPreview.pause();
      // Consider removing src and calling load() to free resources, if not causing issues
      // videoPreview.removeAttribute('src');
      // videoPreview.load();
    }
    setTimeout(() => {
      if (backdrop.parentElement) { // Check if still in DOM before removing
        backdrop.remove();
      }
    }, 300);
  };

  // Playlist Management
  const handlePlaylistDragOver = (e) => {
    e.preventDefault();
    const isReordering = e.dataTransfer.types.includes('application/json') && JSON.parse(e.dataTransfer.getData('application/json') || '{}').type === 'playlist-reorder';
    const isAddingNew = e.dataTransfer.types.includes('text/plain') || (e.dataTransfer.types.includes('application/json') && JSON.parse(e.dataTransfer.getData('application/json') || '{}').type === 'multiple-media');
    if (isReordering) e.dataTransfer.dropEffect = 'move';
    else if (isAddingNew) e.dataTransfer.dropEffect = 'copy';
    else e.dataTransfer.dropEffect = 'none';
  };

  const handlePlaylistDrop = (e) => {
    e.preventDefault(); e.currentTarget.style.backgroundColor = '';
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
            insertAtIndex = parseInt(targetElement.dataset.index || '0') + (isDroppedOnTopHalf ? 0 : 1);
          }
          jsonData.ids.reverse().forEach(id => addToPlaylist(id, insertAtIndex));
          showNotification(`Added ${jsonData.ids.length} items to playlist.`, 'success'); return;
        } else if (jsonData?.type === 'playlist-reorder') {
          const fromIndex = parseInt(jsonData.index);
          const targetElement = e.target.closest('.playlist-item');
          if (targetElement) {
            let toIndex = parseInt(targetElement.dataset.index);
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            if (!isDroppedOnTopHalf) toIndex++;
            if (fromIndex < toIndex) toIndex--;
            reorderPlaylistItem(fromIndex, toIndex);
          } else reorderPlaylistItem(fromIndex, state.playlist.items.length -1);
          return;
        }
      }
      const mediaId = e.dataTransfer.getData('text/plain');
      if (mediaId) {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) {
          const targetElement = e.target.closest('.playlist-item');
          let insertAtIndex = state.playlist.items.length;
          if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            insertAtIndex = parseInt(targetElement.dataset.index || '0') + (isDroppedOnTopHalf ? 0 : 1);
          }
          addToPlaylist(mediaId, insertAtIndex);
        }
      }
    } catch (err) { console.error('Error in handlePlaylistDrop:', err); showNotification('Error adding item to playlist.', 'error'); }
  };

  const addToPlaylist = (mediaId, insertAtIndex = -1) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) { showNotification(`Media with ID ${mediaId} not found in library.`, 'warning'); return; }
    const wasEmpty = state.playlist.items.length === 0;
    if (insertAtIndex === -1 || insertAtIndex >= state.playlist.items.length) state.playlist.items.push(mediaId);
    else {
      state.playlist.items.splice(insertAtIndex, 0, mediaId);
      if (state.playlist.isPlaying && insertAtIndex <= state.playlist.currentIndex) state.playlist.currentIndex++;
    }
    if (wasEmpty && state.playlist.items.length > 0) state.playlist.currentIndex = 0;
    updatePlaylistUI(); saveMediaList(); showNotification(`Added to playlist: ${media.name}`, 'success');
  };

  const removeFromPlaylist = (index) => {
    if (index < 0 || index >= state.playlist.items.length) return;
    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    state.playlist.items.splice(index, 1);
    if (state.playlist.isPlaying) {
      if (index === state.playlist.currentIndex) {
        if (state.playlist.items.length > 0) {
          state.playlist.currentIndex = Math.min(index, state.playlist.items.length - 1);
          playMediaByIndex(state.playlist.currentIndex);
        } else stopPlaylist();
      } else if (index < state.playlist.currentIndex) state.playlist.currentIndex--;
    } else {
      if (state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = Math.max(0, state.playlist.items.length - 1);
      else if (index < state.playlist.currentIndex) state.playlist.currentIndex--;
      if (state.playlist.items.length === 0) state.playlist.currentIndex = -1;
    }
    updatePlaylistUI(); saveMediaList();
    if (media) showNotification(`Removed from playlist: ${media.name}`, 'info');
  };

  const reorderPlaylistItem = (fromIndex, toIndex) => {
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length || toIndex < 0 || toIndex > state.playlist.items.length || fromIndex === toIndex) return;
    try {
      const itemToMove = state.playlist.items.splice(fromIndex, 1)[0];
      state.playlist.items.splice(toIndex, 0, itemToMove);
      if (state.playlist.currentIndex === fromIndex) state.playlist.currentIndex = toIndex;
      else if (state.playlist.currentIndex > fromIndex && state.playlist.currentIndex <= toIndex) state.playlist.currentIndex--;
      else if (state.playlist.currentIndex < fromIndex && state.playlist.currentIndex >= toIndex) state.playlist.currentIndex++;
      updatePlaylistUI(); saveMediaList();
    } catch (e) { console.error('Error reordering playlist item:', e); showNotification('Error reordering playlist.', 'error'); }
  };

  const clearPlaylist = () => {
    try {
      if (state.playlist.items.length === 0) { showNotification('Playlist is already empty.', 'info'); return; }
      if (!confirm('Are you sure you want to clear the entire playlist?')) return;
      stopPlaylist(); state.playlist.items = []; state.playlist.currentIndex = -1; state.playlist.playedInShuffle.clear();
      updatePlaylistUI(); saveMediaList(); showNotification('Playlist cleared.', 'info');
    } catch (e) { console.error('Error in clearPlaylist:', e); showNotification('Error clearing playlist.', 'error'); }
  };

  // Playback Functions
  const selectMedia = (media, loopSingle = false) => {
    stopPlaylist(false); clearMediaDisplay();
    const element = createMediaElement(media, !loopSingle, loopSingle);
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      showNotification(`Now playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');
      state.playlist.isPlaying = !loopSingle;
      if (loopSingle) { state.playlist.currentIndex = -1; updateActiveHighlight(media.id, 'library'); }
      else updateActiveHighlight(null);
      updatePlaylistUI();
    } else showNotification(`Could not play ${media.name}. File might be corrupted or unsupported.`, 'error');
  };

  const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
    let element;
    if (!media || !media.type || !media.url) { console.error("Cannot create media element: media item or URL is invalid.", media); return null; }
    const useTrim = media.type === 'video' && media.trimSettings?.trimEnabled && typeof media.trimSettings.startTime === 'number' && typeof media.trimSettings.endTime === 'number' && media.trimSettings.endTime > media.trimSettings.startTime;
    const trimSettings = media.trimSettings || {};
    const startTime = useTrim ? trimSettings.startTime : 0;
    const endTime = useTrim ? trimSettings.endTime : (media.settings?.originalDuration || Infinity);

    if (media.type === 'image') {
      element = createUIElement('img', { src: media.url, alt: media.name, style: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' } });
      if (isPlaylistContext) {
        clearPlaybackTimers();
        state.playlist.playbackTimer = setTimeout(() => { if (state.playlist.isPlaying) playNextItem(); }, CONSTANTS.IMAGE_DISPLAY_DURATION);
      }
    } else if (media.type === 'video') {
      element = document.createElement('video');
      element.src = media.url; element.autoplay = true; element.loop = loopOverride;
      element.muted = (media.settings?.volume === 0) || (media.settings?.volume === undefined && !isPlaylistContext);
      element.volume = media.settings?.volume ?? (isPlaylistContext ? 0.5 : 0);
      element.playbackRate = media.settings?.playbackRate ?? 1;
      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });
      element.addEventListener('error', function(e) {
        console.error(`Error loading video: ${media.name}`, e.target.error);
        showNotification(`Error playing ${media.name}: ${e.target.error?.message || 'Unknown error'}`, 'error');
        if (isPlaylistContext && state.playlist.isPlaying) setTimeout(() => playNextItem(), 100);
      });
      if (useTrim) {
        element.addEventListener('loadedmetadata', function() {
          if (typeof this.duration === 'number' && !isNaN(this.duration)) this.currentTime = Math.max(0, Math.min(startTime, this.duration - 0.1));
        });
        element.addEventListener('timeupdate', function() {
          if (this.currentTime < (startTime - 0.05) && !this.seeking) this.currentTime = startTime;
          if (this.currentTime >= endTime - 0.05 ) {
            if (isPlaylistContext && state.playlist.isPlaying && !loopOverride) playNextItem();
            else if (loopOverride) { this.currentTime = startTime; this.play().catch(e => console.warn("Autoplay prevented on trim loop:", media.name, e)); }
            else this.pause();
          }
        });
      }
      if (isPlaylistContext && !loopOverride && !useTrim) {
        element.addEventListener('ended', () => { if (state.playlist.isPlaying) playNextItem(); });
      }
    }
    return element;
  };

  const playPlaylist = () => {
    if (state.playlist.items.length === 0) { showNotification('Playlist is empty. Add some media!', 'info'); return; }
    if (state.playlist.isPlaying) { pausePlaylist(); return; }
    clearPlaybackTimers(); state.playlist.advancingInProgress = false; state.playlist.isPlaying = true;
    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear();
      if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length);
      }
      const currentMediaId = state.playlist.items[state.playlist.currentIndex];
      if(currentMediaId) state.playlist.playedInShuffle.add(currentMediaId);
    } else if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = 0;
    clearMediaDisplay(); playMediaByIndex(state.playlist.currentIndex); updatePlaylistUI();
  };

  const pausePlaylist = () => {
    state.playlist.isPlaying = false; clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement && !videoElement.paused) videoElement.pause();
    updatePlaylistUI(); showNotification("Playlist paused.", "info");
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
    state.playlist.currentIndex = index; state.playlist.isPlaying = true; clearMediaDisplay();
    const element = createMediaElement(media, true);
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      if (element.tagName.toLowerCase() === 'video') {
        element.load();
        element.play().catch(e => {
          console.warn("Autoplay prevented by browser for:", media.name, e);
          showNotification(`Playback for ${media.name} might require user interaction.`, "info");
        });
      }
      updateActiveHighlight(media.id, 'playlist');
      if (state.playlist.shuffle) state.playlist.playedInShuffle.add(mediaId);
    } else if (state.playlist.isPlaying) playNextItem();
    updatePlaylistUI();
  };

  const playNextItem = (startIndex = -1) => {
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) { stopPlaylist(); return; }
    if (state.playlist.advancingInProgress) return; state.playlist.advancingInProgress = true;
    clearPlaybackTimers(); let nextIndex;
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
    } else nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
    if (startIndex !== -1 && startIndex >= 0 && startIndex < state.playlist.items.length) nextIndex = startIndex;
    state.playlist.currentIndex = nextIndex; playMediaByIndex(nextIndex);
    setTimeout(() => { state.playlist.advancingInProgress = false; }, 200);
  };

  const clearPlaybackTimers = () => {
    if (state.playlist.playbackTimer) { clearTimeout(state.playlist.playbackTimer); state.playlist.playbackTimer = null; }
  };

  const toggleShuffle = () => {
    state.playlist.shuffle = !state.playlist.shuffle;
    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear();
      if (state.playlist.isPlaying && state.playlist.items.length > 0 && state.playlist.currentIndex >= 0) {
        const currentMediaId = state.playlist.items[state.playlist.currentIndex];
        if (currentMediaId) state.playlist.playedInShuffle.add(currentMediaId);
      }
    }
    updatePlaylistUI(); saveMediaList();
    showNotification(state.playlist.shuffle ? 'Shuffle mode: On' : 'Shuffle mode: Off', 'info');
  };

  const stopPlaylist = (resetIndexAndDisplay = true) => {
    state.playlist.isPlaying = false; clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) videoElement.pause();
    if (resetIndexAndDisplay) { state.playlist.currentIndex = -1; clearMediaDisplay(); updateActiveHighlight(null); }
    state.playlist.playedInShuffle.clear(); updatePlaylistUI();
  };

  const clearMediaDisplay = () => {
    try {
      clearPlaybackTimers();
      while (state.dom.mediaContainer.firstChild) {
        const el = state.dom.mediaContainer.firstChild;
        if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) {
          el.pause(); el.removeAttribute('src');
          if (typeof el.load === 'function') try { el.load(); } catch(e) { /* ignore */ }
        }
        state.dom.mediaContainer.removeChild(el);
      }
    } catch (e) {
      console.error("Error clearing media display:", e);
      if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = '';
    }
  };

  const deleteMedia = (id) => {
    const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id);
    if (indexInLibrary === -1) return;
    const mediaToDelete = state.mediaLibrary[indexInLibrary];
    if (mediaToDelete.url && mediaToDelete.url.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.url);
    if (mediaToDelete.thumbnail && mediaToDelete.thumbnail.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.thumbnail);
    state.mediaLibrary.splice(indexInLibrary, 1);
    let wasPlayingDeletedItem = false; let deletedItemOriginalPlaylistIndex = -1;
    for (let i = state.playlist.items.length - 1; i >= 0; i--) {
      if (state.playlist.items[i] === id) {
        if (state.playlist.isPlaying && i === state.playlist.currentIndex) {
          wasPlayingDeletedItem = true; deletedItemOriginalPlaylistIndex = i;
        }
        state.playlist.items.splice(i, 1);
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
    } else if (state.playlist.items.length === 0) { state.playlist.currentIndex = -1; stopPlaylist(); }
    const currentMediaElement = state.dom.mediaContainer.querySelector('img, video');
    if (currentMediaElement && currentMediaElement.src === mediaToDelete.url) { clearMediaDisplay(); updateActiveHighlight(null); }
    if (state.mediaLibrary.length === 0) clearPlaylist();
    else updatePlaylistUI();
    updateMediaGallery(); saveMediaList(); showNotification(`Removed: ${mediaToDelete.name}`, 'info'); clearSelection();
  };

  // UI Update Functions (Playlist, Active Highlight)
  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer;
    const emptyState = document.getElementById('playlist-empty-state');
    const controlsContainer = state.dom.playlistControlsContainer;
    if (!playlistContainer || !controlsContainer) { console.error("Playlist UI elements not found, cannot update."); return; }
    Array.from(playlistContainer.querySelectorAll('.playlist-item')).forEach(child => child.remove());
    if (state.playlist.items.length === 0) {
      if (emptyState) { emptyState.style.display = 'block'; emptyState.textContent = 'Drag media here or from library to create a playlist.'; }
      controlsContainer.style.visibility = 'hidden';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      controlsContainer.style.visibility = 'visible';
      state.playlist.items.forEach((mediaId, index) => {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) playlistContainer.appendChild(createPlaylistItem(media, index));
        else console.warn(`Media with ID ${mediaId} found in playlist but not in library. Removing from playlist.`);
      });
    }
    const shuffleButton = document.getElementById('playlist-shuffle-button');
    if (shuffleButton) {
      shuffleButton.classList.toggle('active', state.playlist.shuffle);
      shuffleButton.innerHTML = state.playlist.shuffle ? '<span style="filter: grayscale(0%); color: var(--primary-color);">🔀</span> Shuffle On' : '<span style="filter: grayscale(100%);">🔀</span> Shuffle Off';
    }
    const playButton = document.getElementById('playlist-play-button');
    if (playButton) playButton.innerHTML = state.playlist.isPlaying ? '<span style="filter: grayscale(100%);">⏸</span> Pause' : '<span style="filter: grayscale(100%);">▶</span> Play All';
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'playlist') updateActiveHighlight(state.activeHighlight.mediaId, 'playlist');
  };

  const createPlaylistItem = (media, index) => {
    const item = createUIElement('div', { className: 'playlist-item', attributes: { 'data-id': media.id, 'data-index': index.toString(), draggable: 'true' } });
    if (index === state.playlist.currentIndex) item.classList.add('current');
    const highlightRing = createUIElement('div', { className: 'media-active-highlight-ring' });
    item.appendChild(highlightRing);
    item.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'playlist-reorder', id: media.id, index: index }));
      e.dataTransfer.effectAllowed = 'move'; this.classList.add('dragging');
    });
    item.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
    });
    item.addEventListener('dragover', function(e) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const rect = this.getBoundingClientRect();
      const isOverTopHalf = e.clientY < rect.top + rect.height / 2;
      document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom').forEach(i => { if (i !== this) i.classList.remove('drag-over-top', 'drag-over-bottom'); });
      this.classList.toggle('drag-over-top', isOverTopHalf); this.classList.toggle('drag-over-bottom', !isOverTopHalf);
    });
    item.addEventListener('dragleave', function() { this.classList.remove('drag-over-top', 'drag-over-bottom'); });
    item.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation(); this.classList.remove('drag-over-top', 'drag-over-bottom');
      try {
        const dataText = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        if (!dataText) return; let droppedData;
        try { droppedData = JSON.parse(dataText); } catch (err) {
          const droppedMediaId = dataText;
          if (state.mediaLibrary.find(m => m.id === droppedMediaId)) {
            const targetIndexDrop = parseInt(this.dataset.index || '0'); const rect = this.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
            const insertAtIndex = isDroppedOnTopHalf ? targetIndexDrop : targetIndexDrop + 1;
            addToPlaylist(droppedMediaId, insertAtIndex);
          } return;
        }
        if (droppedData?.type === 'playlist-reorder') {
          const fromIndex = parseInt(droppedData.index); let toIndexDrop = parseInt(this.dataset.index || '0');
          const rect = this.getBoundingClientRect(); const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
          if (!isDroppedOnTopHalf) toIndexDrop++; if (fromIndex < toIndexDrop) toIndexDrop--;
          reorderPlaylistItem(fromIndex, toIndexDrop);
        } else if (droppedData?.type === 'multiple-media' && Array.isArray(droppedData.ids)) {
          const targetIndexDrop = parseInt(this.dataset.index || '0'); const rect = this.getBoundingClientRect();
          const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
          let insertAtIndex = isDroppedOnTopHalf ? targetIndexDrop : targetIndexDrop + 1;
          droppedData.ids.reverse().forEach(id => addToPlaylist(id, insertAtIndex));
          showNotification(`Added ${droppedData.ids.length} items to playlist.`, 'success');
        }
      } catch (err) { console.error('Error during playlist item drop handling:', err); showNotification('Error processing dropped item.', 'error'); }
    });
    const thumbnailDiv = createUIElement('div', { className: 'playlist-item-thumbnail', style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } : { backgroundColor: '#333' } });
    if (!media.thumbnail) thumbnailDiv.textContent = media.type.charAt(0).toUpperCase();
    item.appendChild(thumbnailDiv);
    if (media.type === 'video' && media.trimSettings?.trimEnabled) {
      const originalDuration = media.settings.originalDuration;
      const isEffectivelyTrimmed = (media.trimSettings.startTime || 0) > 0.01 || (typeof originalDuration === 'number' && originalDuration > 0 && typeof media.trimSettings.endTime === 'number' && Math.abs(media.trimSettings.endTime - originalDuration) > 0.01 && media.trimSettings.endTime < originalDuration);
      if (isEffectivelyTrimmed) {
        const trimIndicator = createUIElement('div', { className: 'playlist-item-trim-indicator', innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">✂️</span>', title: `Trimmed: ${formatTime(media.trimSettings.startTime)} - ${formatTime(media.trimSettings.endTime)}` });
        thumbnailDiv.appendChild(trimIndicator);
      }
    }
    const infoContainer = createUIElement('div', { className: 'playlist-item-info' });
    const nameEl = createUIElement('div', { className: 'playlist-item-name', textContent: media.name });
    infoContainer.appendChild(nameEl);
    const detailsEl = createUIElement('div', { className: 'playlist-item-details' });
    let detailsText = `${media.type.charAt(0).toUpperCase() + media.type.slice(1)} · ${formatFileSize(media.size)}`;
    if (media.type === 'video' && media.trimSettings?.trimEnabled) {
      const duration = (media.trimSettings.endTime ?? 0) - (media.trimSettings.startTime ?? 0);
      if (duration > 0) detailsText += ` · Trimmed (${formatTime(duration)})`;
    } else if (media.type === 'video' && media.settings?.originalDuration) detailsText += ` · ${formatTime(media.settings.originalDuration)}`;
    detailsEl.textContent = detailsText; infoContainer.appendChild(detailsEl); item.appendChild(infoContainer);
    const deleteBtn = createUIElement('button', {
      className: 'btn btn-icon btn-danger playlist-item-delete', innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': `Remove ${media.name} from playlist` }, events: { click: (e) => { e.stopPropagation(); removeFromPlaylist(index); }}
    });
    item.appendChild(deleteBtn);
    item.addEventListener('click', function(e) {
      if (e.target === deleteBtn || deleteBtn.contains(e.target)) return;
      if (state.playlist.isPlaying && state.playlist.currentIndex === index) pausePlaylist();
      else { state.playlist.currentIndex = index; playPlaylist(); updateActiveHighlight(media.id, 'playlist'); }
    });
    if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
      const playingIndicator = createUIElement('div', { className: 'playlist-item-playing-indicator', innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>' });
      thumbnailDiv.appendChild(playingIndicator);
    }
    return item;
  };

  const updateActiveHighlight = (mediaId, sourceType) => {
    removeAllActiveHighlights();
    if (!mediaId) { state.activeHighlight.mediaId = null; state.activeHighlight.sourceType = null; return; }
    state.activeHighlight.mediaId = mediaId; state.activeHighlight.sourceType = sourceType;
    const selector = sourceType === 'library' ? `.media-thumbnail[data-id="${mediaId}"]` : `.playlist-item[data-id="${mediaId}"]`;
    const container = sourceType === 'library' ? state.dom.mediaGallery : state.dom.playlistContainer;
    const element = container?.querySelector(selector);
    if (element) element.classList.add('playing-from-here');
  };

  const removeAllActiveHighlights = () => {
    document.querySelectorAll('.media-thumbnail.playing-from-here, .playlist-item.playing-from-here').forEach(el => el.classList.remove('playing-from-here'));
  };

  // Storage Functions
  const saveMediaList = () => {
    try {
      const mediaForStorage = state.mediaLibrary.map(media => {
        const { url, thumbnail, ...mediaMeta } = media; return { ...mediaMeta };
      });
      const storageData = { media: mediaForStorage, playlist: { items: state.playlist.items, shuffle: state.playlist.shuffle } };
      localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(storageData));
    } catch (e) { console.error('Failed to save media list:', e); showNotification('Error saving media library. Storage might be full.', 'error'); }
  };

  const loadSavedMedia = () => {
    try {
      const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEY);
      if (!savedData) {
        const oldSavedData = localStorage.getItem(CONSTANTS.STORAGE_KEY_OLD);
        if (oldSavedData) {
          try {
            const oldParsedData = JSON.parse(oldSavedData);
            if (oldParsedData.media?.length > 0) showNotification(`Old library data found (${oldParsedData.media.length} items). Please re-import files for full functionality as old data cannot be automatically migrated.`, 'warning', 10000);
            localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
          } catch (oldParseError) { console.warn("Error parsing old saved data, removing it:", oldParseError); localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD); }
        }
        updateMediaGallery(); updatePlaylistUI(); return;
      }
      const parsedData = JSON.parse(savedData);
      if (parsedData.media && Array.isArray(parsedData.media) && parsedData.media.length > 0) {
        showNotification(`Loaded metadata for ${parsedData.media.length} media entries. Please re-import the actual files to make them playable.`, 'info', 7000);
      }
      state.mediaLibrary = []; state.playlist.items = []; // Files need re-importing
      updateMediaGallery(); updatePlaylistUI();
    } catch (e) {
      console.error('Failed to load or parse saved media data:', e);
      showNotification('Error loading saved media library. Data might be corrupted.', 'error');
      localStorage.removeItem(CONSTANTS.STORAGE_KEY); localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
      updateMediaGallery(); updatePlaylistUI();
    }
  };

  // Utility Functions
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
  const showNotification = (message, type = 'info', duration = 3000) => {
    if (typeof WallpaperApp !== 'undefined' && typeof WallpaperApp.UI?.showNotification === 'function') WallpaperApp.UI.showNotification(message, type, duration);
    else console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`);
  };
  const applyTemporaryHighlight = (element) => {
    if (!element) return;
    element.classList.add('pulse-highlight-effect');
    setTimeout(() => element.classList.remove('pulse-highlight-effect'), 1400);
  };

  // Public API
  return {
    init,
    getCurrentPlaylist: () => JSON.parse(JSON.stringify(state.playlist)),
    getMediaLibrary: () => JSON.parse(JSON.stringify(state.mediaLibrary)),
    openMediaSettings: (mediaId) => {
      const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (media) openMediaSettingsDialog(media);
      else showNotification(`Media item with ID ${mediaId} not found.`, 'warning');
    },
    _getState: () => state // Expose internal state for debugging (use with caution)
  };
})();

MediaModule.init();

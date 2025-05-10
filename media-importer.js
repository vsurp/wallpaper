/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Version 0.2.8 - Advanced video editor UI: Trimming preview, dual-thumb slider, speed slider with notches.
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
        STORAGE_KEY: 'flStudioWallpaper_media_v6', // Incremented version
        STORAGE_KEY_OLD: 'flStudioWallpaper_media_v5',
        VIDEO_METADATA_TIMEOUT: 10000,
        VIDEO_THUMBNAIL_TIMEOUT: 10000,
        PLAYBACK_SPEED_STEPS: [0.25, 0.5, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 2.0] // Now 9 steps with 1.0 in the middle
      };'image/svg+xml', 'image/webp']
    },
        THUMBNAIL_DIMENSIONS: {
      width: 120,
      height: 90
    },
    IMAGE_DISPLAY_DURATION: 5000,
    STORAGE_KEY: 'flStudioWallpaper_media_v6', // Incremented version
    STORAGE_KEY_OLD: 'flStudioWallpaper_media_v5',
    VIDEO_METADATA_TIMEOUT: 10000,
    VIDEO_THUMBNAIL_TIMEOUT: 10000,
    PLAYBACK_SPEED_STEPS: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
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
  fileInput: null,
  activeVideoElement: null, // Main player
  activeTrimPreviewVideoElement: null, // Preview video in settings dialog
  trimSliderState: { // State for the custom dual-thumb slider
    isDraggingStart: false,
    isDraggingEnd: false,
    container: null,
    track: null,
    startThumb: null,
    endThumb: null,
    originalDuration: 0,
    currentTrimStart: 0,
    currentTrimEnd: 0,
    mediaId: null
  }
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

  // Global mouseup for slider dragging
  document.addEventListener('mouseup', handleGlobalMouseUpForTrimSlider);
  document.addEventListener('touchend', handleGlobalMouseUpForTrimSlider);
  document.addEventListener('mousemove', handleGlobalMouseMoveForTrimSlider);
  document.addEventListener('touchmove', handleGlobalMouseMoveForTrimSlider, { passive: false });

};

const initMediaImporter = () => {
  state.dom.importSubmenu = document.getElementById('import-media-submenu');
  state.dom.mediaContainer = document.getElementById('media-container');

  if (!state.dom.importSubmenu || !state.dom.mediaContainer) {
    console.error('Required DOM elements not found for MediaModule. Elements found:', {
      importSubmenu: !!state.dom.importSubmenu,
      mediaContainer: !!state.dom.mediaContainer
    });
    setTimeout(initMediaImporter, 1000);
    return;
  }

  console.log('MediaModule initialized with container:', state.dom.mediaContainer);

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
    type: 'file', id: 'media-file-input',
    accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','),
    multiple: true, style: { display: 'none' },
    events: { change: (e) => { handleFileSelect(e.target.files); e.target.value = ''; } }
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
  const selectionInfo = createUIElement('div', { className: 'selection-info', textContent: 'Shift+Click or drag to select multiple' });
  const gallery = createUIElement('div', { id: 'media-gallery' });
  setupGalleryDragSelection(gallery);
  gallery.appendChild(createUIElement('div', { id: 'media-empty-state', textContent: '' }));
  section.appendChild(title);
  section.appendChild(selectionInfo);
  section.appendChild(gallery);
  state.dom.mediaGallery = gallery;
  return section;
};

const setupGalleryDragSelection = (gallery) => { /* ... (no changes from previous version) ... */
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
        } else showNotification('Menu function (effects) unavailable.', 'warning');
      }}
  });
  const transitionsButton = createUIElement('button', {
    id: 'transitions-quick-nav-button', textContent: 'TRANSITIONS', className: 'quick-nav-button btn btn-secondary',
    events: { click: () => {
        if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
          window.WallpaperApp.MenuTools.openL2Submenu('transitions-list-submenu');
          applyTemporaryHighlight(state.dom.playlistSection);
        } else showNotification('Menu function (transitions) unavailable.', 'warning');
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
      dragover: handlePlaylistDragOver, drop: handlePlaylistDrop,
      dragenter: (e) => { e.preventDefault(); playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)'; },
      dragleave: (e) => { e.preventDefault(); playlistContainer.style.backgroundColor = ''; }
    }
  });
  playlistContainer.appendChild(createUIElement('div', { id: 'playlist-empty-state', textContent: 'Drag media here to create playlist' }));
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
    { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', handler: confirmClearPlaylist, class: 'btn-danger' }
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
const handleFileSelect = async (files) => { /* ... (no changes from previous version) ... */
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
  if (invalidCount > 0) showNotification(`${invalidCount} unsupported file${invalidCount !== 1 ? 's' : ''}.`, 'warning');
  updateMediaGallery();
  updatePlaylistUI();
  saveMediaList();
};

const isFileSupported = (type) => CONSTANTS.SUPPORTED_TYPES.video.includes(type) || CONSTANTS.SUPPORTED_TYPES.image.includes(type);

const processFile = async (file) => { /* ... (no changes from previous version regarding trimEnd initialization) ... */
  const id = generateMediaId();
  const url = URL.createObjectURL(file);
  const type = CONSTANTS.SUPPORTED_TYPES.video.includes(file.type) ? 'video' : 'image';
  const mediaItem = {
    id, name: file.name, type, mimeType: file.type, size: file.size, url, dateAdded: Date.now(), thumbnail: null,
    settings: {
      volume: 0, playbackRate: 1, originalDuration: null,
      trimStart: 0, trimEnd: null
    },
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
      const duration = await getVideoDuration(mediaItem.url);
      mediaItem.settings.originalDuration = duration;
      mediaItem.settings.trimEnd = duration; // Default trimEnd to full duration
    } catch (err) {
      console.warn(`Error getting video duration for ${mediaItem.name}:`, err);
      mediaItem.settings.originalDuration = 0;
      mediaItem.settings.trimEnd = 0;
    }
  }
};

const generateMediaId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
const getVideoDuration = (videoUrl) => { /* ... (no changes from previous version) ... */
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
const generateThumbnail = (mediaItem, file) => { /* ... (no changes from previous version) ... */
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
const generateVideoThumbnail = (videoUrl, videoName) => { /* ... (no changes from previous version) ... */
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
const createFallbackThumbnail = (type = 'media') => { /* ... (no changes from previous version) ... */
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
const drawPlayButton = (ctx, width, height, color = 'rgba(255, 255, 255, 0.7)') => { /* ... (no changes from previous version) ... */
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
const updateMediaGallery = () => { /* ... (no changes from previous version) ... */
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
const createMediaThumbnail = (media) => { /* ... (updated with English labels) ... */
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
    className: 'media-settings-btn btn btn-icon', innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24-.42-.12-.64l2 3.46c.12.22.39.3.61.22l2.49 1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>',
    attributes: { 'aria-label': `Settings for ${media.name}` },
    events: { click: (e) => { e.stopPropagation(); openMediaSettingsDialog(media); } }
  });
  thumbnail.appendChild(settingsBtn);
  const deleteBtn = createUIElement('button', {
    className: 'media-delete-btn btn btn-icon btn-danger', innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    attributes: { 'aria-label': `Delete ${media.name}` },
    events: { click: (e) => {
        e.stopPropagation(); e.preventDefault();
        const mediaId = media.id;
        const performDelete = (idToDelete) => deleteMedia(idToDelete);
        const performMultipleDelete = (idsToDelete) => { idsToDelete.forEach(id => deleteMedia(id, true)); clearSelection(); };
        const useCustomModal = typeof WallpaperApp !== 'undefined' && WallpaperApp.UI && typeof WallpaperApp.UI.showModal === 'function';

        if (state.selection.items.has(mediaId) && state.selection.items.size > 1) {
          if (useCustomModal) {
            WallpaperApp.UI.showModal({
              title: 'Confirm Delete',
              content: `Are you sure you want to delete ${state.selection.items.size} selected clips? This action cannot be undone.`,
              footerButtons: [
                { text: 'Delete', classes: 'btn-danger', onClick: () => { performMultipleDelete(Array.from(state.selection.items)); return true; } },
                { text: 'Keep', classes: 'btn-secondary', onClick: () => true }
              ]
            });
          } else {
            if (confirm(`Delete ${state.selection.items.size} selected clips? This action cannot be undone.`)) {
              performMultipleDelete(Array.from(state.selection.items));
            }
          }
        } else {
          performDelete(mediaId);
        }
      }}
  });
  thumbnail.appendChild(deleteBtn);
  thumbnail.setAttribute('title', media.name);
  thumbnail.addEventListener('click', (e) => handleThumbnailClick(e, media));
  return thumbnail;
};

// Selection Management
const handleThumbnailClick = (e, media) => { /* ... (no changes from previous version) ... */
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
const toggleSelection = (mediaId) => { state.selection.items.has(mediaId) ? state.selection.items.delete(mediaId) : state.selection.items.add(mediaId); };
const selectRange = (startId, endId) => { /* ... (no changes from previous version) ... */
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
const updateMediaSelectionUI = () => { /* ... (no changes from previous version) ... */
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
  createDialogContent(dialog, media, backdrop); // This function is now heavily modified
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  const firstInput = dialog.querySelector('input, textarea, select, video'); // Added video
  if (firstInput) firstInput.focus();

  // Initialize custom trim slider if it's a video
  if (media.type === 'video') {
    setTimeout(() => initCustomTrimSlider(media), 50); // Delay to ensure DOM is ready
  }
};

const createDialogContent = (dialog, media, backdrop) => {
  const header = createUIElement('div', { className: 'media-settings-dialog-header' });
  const title = createUIElement('h3', { textContent: `Video Editor: ${media.name}` });
  const closeBtn = createUIElement('button', {
    className: 'btn btn-icon dialog-close-btn', innerHTML: '&times;',
    attributes: { 'aria-label': 'Close settings' }, events: { click: () => closeDialog(dialog, backdrop) }
  });
  header.appendChild(title); header.appendChild(closeBtn); dialog.appendChild(header);

  const body = createUIElement('div', { className: 'media-settings-dialog-body' });

  // Clip name at the top
  const nameGroup = createFormGroup('Clip name:', 'text', media.name, `media-name-${media.id}`);
  body.appendChild(nameGroup);
  body.appendChild(createDivider());

  // --- Video Trimming Section ---
  if (media.type === 'video') {
    const trimSection = createUIElement('div', { className: 'form-group trim-section-container' }); // New CSS class
    const trimTitle = createUIElement('h4', { textContent: 'Video Trimming:', style: { marginBottom: '10px', fontSize: '1em', fontWeight: '600' } });
    trimSection.appendChild(trimTitle);

    // Video Preview Element
    const previewVideo = createUIElement('video', {
      id: `media-trim-preview-${media.id}`,
      className: 'trim-video-preview',
      src: media.url,
      muted: true,
      controls: true,
      preload: 'auto', // Changed to auto for better loading
      style: { width: '100%', maxHeight: '200px', backgroundColor: '#000', borderRadius: '4px', marginBottom: '10px' }
    });

    // Set initial volume to 0 for preview
    previewVideo.volume = 0;
    previewVideo.muted = true;
    previewVideo.playbackRate = media.settings?.playbackRate ?? 1;

    // Force video to load and show a frame
    previewVideo.addEventListener('loadeddata', () => {
      // Set to trim start or a small offset to ensure we see a frame
      const startTime = media.settings?.trimStart || 0.1;
      previewVideo.currentTime = startTime;
    });

    previewVideo.addEventListener('loadedmetadata', () => {
      // Update trim slider range and preview duration display once metadata is loaded
      const duration = previewVideo.duration;
      state.trimSliderState.originalDuration = duration;

      // Initialize slider thumbs based on current media settings
      updateTrimSliderThumbs(media.settings.trimStart, media.settings.trimEnd, duration);
      updateTrimPreviewTimeDisplay(media.id, media.settings.trimStart, media.settings.trimEnd);
    });

    // Force a frame to show after seeking
    previewVideo.addEventListener('seeked', () => {
      // Ensure we see a frame by playing briefly then pausing
      const playPromise = previewVideo.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setTimeout(() => {
            previewVideo.pause();
          }, 50); // Pause after 50ms
        }).catch(error => {
          console.log("Auto-play was prevented:", error);
        });
      }
    });
    previewVideo.addEventListener('timeupdate', () => {
      // Loop preview within trim range
      if (state.activeTrimPreviewVideoElement && state.activeTrimPreviewVideoElement.dataset.mediaId === media.id) {
        const currentTrimStart = state.trimSliderState.currentTrimStart;
        const currentTrimEnd = state.trimSliderState.currentTrimEnd;
        if (previewVideo.currentTime < currentTrimStart && !previewVideo.seeking) {
          previewVideo.currentTime = currentTrimStart;
        }
        if (previewVideo.currentTime >= currentTrimEnd && !previewVideo.seeking) {
          previewVideo.currentTime = currentTrimStart; // Loop back
          if(previewVideo.paused) previewVideo.play().catch(e=>console.warn("Preview play error", e));
        }
      }
    });
    state.activeTrimPreviewVideoElement = previewVideo;
    state.activeTrimPreviewVideoElement.dataset.mediaId = media.id;
    trimSection.appendChild(previewVideo);


    // Custom Dual-Thumb Slider Placeholder (actual elements created in initCustomTrimSlider)
    const sliderInteractiveArea = createUIElement('div', {
      id: `trim-slider-interactive-area-${media.id}`,
      className: 'trim-slider-interactive-area' // New CSS class
      // Style this with CSS: position relative, height, etc.
    });
    // Hidden inputs to store values, will be created by initCustomTrimSlider
    trimSection.appendChild(sliderInteractiveArea);


    const trimValuesDisplay = createUIElement('div', { className: 'trim-values-display', style: { fontSize: '0.85em', color: 'rgba(255,255,255,0.7)', marginTop: '5px', textAlign: 'center' } });
    trimValuesDisplay.innerHTML =
        `Start: <span id="trim-start-value-display-${media.id}">${formatTime(media.settings.trimStart)}</span> | ` +
        `End: <span id="trim-end-value-display-${media.id}">${formatTime(media.settings.trimEnd ?? media.settings.originalDuration)}</span> | ` +
        `Length: <span id="trimmed-duration-display-${media.id}">${formatTime((media.settings.trimEnd ?? media.settings.originalDuration) - media.settings.trimStart)}</span>`;
    trimSection.appendChild(trimValuesDisplay);

    const originalDurationDisplay = createUIElement('div', {
      className: 'setting-description', style: {textAlign: 'center', marginTop: '2px'},
      textContent: `Original clip length: ${formatTime(media.settings?.originalDuration ?? 0)}`
    });
    trimSection.appendChild(originalDurationDisplay);


    body.appendChild(trimSection);
    body.appendChild(createDivider());

    // Volume Slider with notches (single slider only) - Always start at 0
    const volumeGroup = createUIElement('div', { className: 'form-group' });
    const volumeLabel = createUIElement('label', { htmlFor: `media-volume-${media.id}`, textContent: 'Volume:' });
    const volumeSliderContainer = createUIElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' }});
    const volumeSlider = createUIElement('input', {
      type: 'range', id: `media-volume-${media.id}`,
      min: "0", max: "100", step: "1",
      value: "0" // Always start at 0
    });

    // Add datalist for volume notches at 0, 25, 50, 75, 100
    const volumeDatalistId = `media-volume-datalist-${media.id}`;
    volumeSlider.setAttribute('list', volumeDatalistId);
    const volumeDatalist = createUIElement('datalist', { id: volumeDatalistId });
    [0, 25, 50, 75, 100].forEach(val => {
      const option = createUIElement('option', { value: val.toString() });
      volumeDatalist.appendChild(option);
    });

    const volumeValueDisplay = createUIElement('span', {
      id: `media-volume-value-${media.id}`,
      textContent: '0%', // Start at 0%
      style: { minWidth: '50px', textAlign: 'right' }
    });

    // Add snap behavior for volume slider
    volumeSlider.addEventListener('input', (e) => {
      let value = parseInt(e.target.value);

      // Snap to notch values if close
      const notches = [0, 25, 50, 75, 100];
      const snapThreshold = 3; // Snap if within 3% of a notch

      for (const notch of notches) {
        if (Math.abs(value - notch) <= snapThreshold) {
          value = notch;
          e.target.value = value.toString();
          break;
        }
      }

      document.getElementById(`media-volume-value-${media.id}`).textContent = `${value}%`;
      // Update preview video volume in real-time
      if (state.activeTrimPreviewVideoElement) {
        state.activeTrimPreviewVideoElement.volume = value / 100;
        state.activeTrimPreviewVideoElement.muted = (value === 0);
      }
    });

    volumeSliderContainer.appendChild(volumeSlider);
    volumeSliderContainer.appendChild(volumeValueDisplay);
    volumeGroup.appendChild(volumeLabel);
    volumeGroup.appendChild(volumeSliderContainer);
    volumeGroup.appendChild(volumeDatalist);
    body.appendChild(volumeGroup);

    // Playback Speed Slider with 9 functional steps
    const speedGroup = createUIElement('div', { className: 'form-group' });
    const speedLabel = createUIElement('label', { htmlFor: `media-rate-${media.id}`, textContent: 'Playback speed:' });
    const speedSliderContainer = createUIElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' }});

    // Find index of 1.0x speed (should be at index 4 for 9 steps)
    const defaultSpeedIndex = CONSTANTS.PLAYBACK_SPEED_STEPS.indexOf(1.0);

    const speedSlider = createUIElement('input', {
      type: 'range', id: `media-rate-${media.id}`,
      min: "0", max: "8", step: "1", // 0-8 for 9 steps
      value: defaultSpeedIndex.toString() // Start at 1.0x speed (index 4)
    });

    // Add datalist for notches at each speed step
    const speedDatalistId = `media-rate-datalist-${media.id}`;
    speedSlider.setAttribute('list', speedDatalistId);
    const speedDatalist = createUIElement('datalist', { id: speedDatalistId });
    for (let i = 0; i < 9; i++) {
      const option = createUIElement('option', { value: i.toString() });
      speedDatalist.appendChild(option);
    }

    const speedValueDisplay = createUIElement('span', {
      id: `media-rate-value-${media.id}`,
      textContent: '1.00x', // Start at 1.0x
      style: { minWidth: '50px', textAlign: 'right' }
    });

    speedSlider.addEventListener('input', (e) => {
      const index = parseInt(e.target.value);
      const selectedSpeed = CONSTANTS.PLAYBACK_SPEED_STEPS[index];
      document.getElementById(`media-rate-value-${media.id}`).textContent = `${selectedSpeed.toFixed(2)}x`;
      // Update preview video playback rate in real-time
      if (state.activeTrimPreviewVideoElement) {
        state.activeTrimPreviewVideoElement.playbackRate = selectedSpeed;
      }
    });

    speedSliderContainer.appendChild(speedSlider);
    speedSliderContainer.appendChild(speedValueDisplay);
    speedGroup.appendChild(speedLabel);
    speedGroup.appendChild(speedSliderContainer);
    speedGroup.appendChild(speedDatalist);
    body.appendChild(speedGroup);
  }
  // --- End Video Settings ---


  const settingsTooltip = createUIElement('div', { className: 'settings-tooltip', textContent: 'Settings apply to library and playlist playback.' });
  body.appendChild(settingsTooltip);


  const navButtonsContainer = createUIElement('div', { style: { display: 'flex', gap: '10px', marginTop: '20px' } });
  const effectsLink = createUIElement('button', {
    textContent: 'EFFECTS', className: 'btn btn-secondary setting-btn', style: { flex: '1' },
    events: { click: () => { closeBtn.click(); document.getElementById('effects-quick-nav-button')?.click(); }}
  });
  navButtonsContainer.appendChild(effectsLink);
  body.appendChild(navButtonsContainer);
  dialog.appendChild(body);

  const footer = createUIElement('div', { className: 'media-settings-dialog-footer' });
  const saveBtn = createUIElement('button', {
    className: 'btn btn-primary', textContent: 'Save',
    events: { click: () => saveMediaSettings(media, dialog, backdrop) }
  });
  const cancelBtn = createUIElement('button', {
    className: 'btn btn-secondary', textContent: 'Cancel', events: { click: () => closeDialog(dialog, backdrop) }
  });
  footer.appendChild(cancelBtn); footer.appendChild(saveBtn); dialog.appendChild(footer);
};

const initCustomTrimSlider = (media) => {
  const sliderArea = document.getElementById(`trim-slider-interactive-area-${media.id}`);
  if (!sliderArea) {
    console.error("Trim slider area not found for media:", media.id);
    return;
  }
  sliderArea.innerHTML = ''; // Clear previous content if any

  const track = createUIElement('div', { className: 'trim-slider-track' }); // CSS: position relative, height, background
  const startThumb = createUIElement('div', { id: `trim-thumb-start-${media.id}`, className: 'trim-slider-thumb start-thumb' }); // CSS: position absolute, width, height, background, cursor
  const endThumb = createUIElement('div', { id: `trim-thumb-end-${media.id}`, className: 'trim-slider-thumb end-thumb' });     // CSS: as above

  sliderArea.appendChild(track);
  sliderArea.appendChild(startThumb);
  sliderArea.appendChild(endThumb);

  // Store references
  state.trimSliderState.container = sliderArea;
  state.trimSliderState.track = track;
  state.trimSliderState.startThumb = startThumb;
  state.trimSliderState.endThumb = endThumb;
  state.trimSliderState.originalDuration = media.settings.originalDuration || 0;
  state.trimSliderState.currentTrimStart = media.settings.trimStart || 0;
  state.trimSliderState.currentTrimEnd = media.settings.trimEnd || state.trimSliderState.originalDuration;
  state.trimSliderState.mediaId = media.id;


  updateTrimSliderThumbs(state.trimSliderState.currentTrimStart, state.trimSliderState.currentTrimEnd, state.trimSliderState.originalDuration);

  const makeThumbDraggable = (thumbElement, isStartThumb) => {
    const onDown = (e) => {
      e.preventDefault(); // Prevent text selection, etc.
      if (isStartThumb) state.trimSliderState.isDraggingStart = true;
      else state.trimSliderState.isDraggingEnd = true;
      thumbElement.classList.add('dragging');
    };
    thumbElement.addEventListener('mousedown', onDown);
    thumbElement.addEventListener('touchstart', onDown, { passive: false });
  };

  makeThumbDraggable(startThumb, true);
  makeThumbDraggable(endThumb, false);
};

const handleGlobalMouseMoveForTrimSlider = (e) => {
  if (!state.trimSliderState.isDraggingStart && !state.trimSliderState.isDraggingEnd) return;
  e.preventDefault(); // Important for touchmove

  const { container, track, startThumb, endThumb, originalDuration, mediaId } = state.trimSliderState;
  if (!container || !track || !startThumb || !endThumb || !mediaId) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const trackRect = track.getBoundingClientRect();
  let newX = clientX - trackRect.left;
  const trackWidth = track.offsetWidth;

  // Clamp newX within track bounds
  newX = Math.max(0, Math.min(newX, trackWidth));
  let newTime = (newX / trackWidth) * originalDuration;

  if (state.trimSliderState.isDraggingStart) {
    newTime = Math.min(newTime, state.trimSliderState.currentTrimEnd - 0.1); // Ensure start < end (add small buffer)
    newTime = Math.max(0, newTime);
    state.trimSliderState.currentTrimStart = newTime;
    startThumb.style.left = `${(newTime / originalDuration) * 100}%`;
  } else if (state.trimSliderState.isDraggingEnd) {
    newTime = Math.max(newTime, state.trimSliderState.currentTrimStart + 0.1); // Ensure end > start
    newTime = Math.min(originalDuration, newTime);
    state.trimSliderState.currentTrimEnd = newTime;
    endThumb.style.left = `${(newTime / originalDuration) * 100}%`;
  }
  updateTrimPreviewTimeDisplay(mediaId, state.trimSliderState.currentTrimStart, state.trimSliderState.currentTrimEnd);

  // Update preview video
  if (state.activeTrimPreviewVideoElement && state.activeTrimPreviewVideoElement.dataset.mediaId === mediaId) {
    if (state.trimSliderState.isDraggingStart) {
      state.activeTrimPreviewVideoElement.currentTime = state.trimSliderState.currentTrimStart;
    }
    // No need to seek for end thumb drag, timeupdate handles loop/end
    if (!state.activeTrimPreviewVideoElement.paused && state.activeTrimPreviewVideoElement.seeking) {
      // if it was playing and now seeking, might need to replay
    } else if (state.activeTrimPreviewVideoElement.paused) {
      state.activeTrimPreviewVideoElement.play().catch(e=>console.warn("preview play error", e));
    }
  }
};

const handleGlobalMouseUpForTrimSlider = () => {
  if (state.trimSliderState.startThumb) state.trimSliderState.startThumb.classList.remove('dragging');
  if (state.trimSliderState.endThumb) state.trimSliderState.endThumb.classList.remove('dragging');
  state.trimSliderState.isDraggingStart = false;
  state.trimSliderState.isDraggingEnd = false;
};

const updateTrimSliderThumbs = (trimStart, trimEnd, duration) => {
  if (!state.trimSliderState.startThumb || !state.trimSliderState.endThumb || duration <= 0) return;
  const startPercent = (trimStart / duration) * 100;
  const endPercent = (trimEnd / duration) * 100;
  state.trimSliderState.startThumb.style.left = `${Math.max(0, Math.min(100, startPercent))}%`;
  state.trimSliderState.endThumb.style.left = `${Math.max(0, Math.min(100, endPercent))}%`;
};

const updateTrimPreviewTimeDisplay = (mediaId, startTime, endTime) => {
  const startDisplay = document.getElementById(`trim-start-value-display-${mediaId}`);
  const endDisplay = document.getElementById(`trim-end-value-display-${mediaId}`);
  const durationDisplay = document.getElementById(`trimmed-duration-display-${mediaId}`);

  if (startDisplay) startDisplay.textContent = formatTime(startTime);
  if (endDisplay) endDisplay.textContent = formatTime(endTime);
  if (durationDisplay) durationDisplay.textContent = formatTime(Math.max(0, endTime - startTime));
};


const createFormGroup = (labelText, inputType, inputValue, inputId, options = {}) => {
  const group = createUIElement('div', { className: 'form-group' });
  const label = createUIElement('label', { htmlFor: inputId, textContent: labelText });
  const input = createUIElement('input', { type: inputType, id: inputId, value: inputValue, ...options });
  if (options.step) input.step = options.step;
  group.appendChild(label); group.appendChild(input);
  return group;
};

const saveMediaSettings = (media, dialog, backdrop) => {
  media.name = document.getElementById(`media-name-${media.id}`).value.trim() || media.name;
  if (media.type === 'video') {
    if (!media.settings) media.settings = {};

    // Get volume from slider
    const volumeValue = parseFloat(document.getElementById(`media-volume-${media.id}`).value);
    media.settings.volume = volumeValue / 100;

    // Get speed from slider
    const speedSliderValue = document.getElementById(`media-rate-${media.id}`).value;
    media.settings.playbackRate = CONSTANTS.PLAYBACK_SPEED_STEPS[parseInt(speedSliderValue)];

    // Get values from custom trim slider state
    media.settings.trimStart = state.trimSliderState.currentTrimStart;
    media.settings.trimEnd = state.trimSliderState.currentTrimEnd;

    const originalDuration = media.settings.originalDuration || 0;
    media.settings.trimStart = Math.max(0, Math.min(media.settings.trimStart, originalDuration));
    media.settings.trimEnd = Math.max(media.settings.trimStart, Math.min(media.settings.trimEnd, originalDuration));
    if (isNaN(media.settings.trimStart)) media.settings.trimStart = 0;
    if (isNaN(media.settings.trimEnd) || media.settings.trimEnd <= media.settings.trimStart) media.settings.trimEnd = originalDuration;


    if (state.activeVideoElement && state.activeVideoElement.dataset.mediaId === media.id) {
      state.activeVideoElement.volume = media.settings.volume;
      state.activeVideoElement.muted = (media.settings.volume === 0);
      state.activeVideoElement.playbackRate = media.settings.playbackRate;
      if (!state.activeVideoElement.paused) {
        if (state.activeVideoElement.currentTime < media.settings.trimStart) {
          state.activeVideoElement.currentTime = media.settings.trimStart;
        } else if (state.activeVideoElement.currentTime > media.settings.trimEnd) {
          if (state.activeVideoElement.loop) {
            state.activeVideoElement.currentTime = media.settings.trimStart;
          }
        }
      }
    }
  }
  updateMediaGallery();
  updatePlaylistUI();
  saveMediaList();
  showNotification('Settings saved!', 'success');

  // Close the dialog after saving
  closeDialog(dialog, backdrop);
};

const closeDialog = (dialog, backdrop) => {
  dialog.classList.remove('open'); backdrop.classList.remove('open');
  state.activeTrimPreviewVideoElement = null; // Clear reference
  // Reset trim slider state for next use
  state.trimSliderState.isDraggingStart = false;
  state.trimSliderState.isDraggingEnd = false;
  state.trimSliderState.container = null;
  state.trimSliderState.track = null;
  state.trimSliderState.startThumb = null;
  state.trimSliderState.endThumb = null;
  state.trimSliderState.mediaId = null;

  setTimeout(() => {
    if (backdrop.parentElement) {
      backdrop.remove();
    }
  }, 300);
};

// Playlist Management (updated with English translations)
const handlePlaylistDragOver = (e) => { /* ... (no changes from previous version) ... */
  e.preventDefault();
  const isReordering = e.dataTransfer.types.includes('application/json') && JSON.parse(e.dataTransfer.getData('application/json') || '{}').type === 'playlist-reorder';
  const isAddingNew = e.dataTransfer.types.includes('text/plain') || (e.dataTransfer.types.includes('application/json') && JSON.parse(e.dataTransfer.getData('application/json') || '{}').type === 'multiple-media');
  if (isReordering) e.dataTransfer.dropEffect = 'move';
  else if (isAddingNew) e.dataTransfer.dropEffect = 'copy';
  else e.dataTransfer.dropEffect = 'none';
};
const handlePlaylistDrop = (e) => { /* ... (no changes from previous version) ... */
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
const addToPlaylist = (mediaId, insertAtIndex = -1) => { /* ... (updated with English messages) ... */
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
const removeFromPlaylist = (index) => { /* ... (updated with English messages) ... */
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
const reorderPlaylistItem = (fromIndex, toIndex) => { /* ... (updated with English messages) ... */
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
const confirmClearPlaylist = () => { /* ... (updated with English messages) ... */
  if (state.playlist.items.length === 0) {
    showNotification('Playlist is already empty.', 'info');
    return;
  }
  const useCustomModal = typeof WallpaperApp !== 'undefined' && WallpaperApp.UI && typeof WallpaperApp.UI.showModal === 'function';
  if (useCustomModal) {
    WallpaperApp.UI.showModal({
      id: 'confirm-clear-playlist-modal', title: 'Confirm Clear Playlist',
      content: 'Are you sure you want to clear the entire playlist? This action cannot be undone.',
      footerButtons: [
        { text: 'Delete', classes: 'btn-danger', onClick: () => { clearPlaylistLogic(); return true; } },
        { text: 'Keep', classes: 'btn-secondary', onClick: () => true }
      ]
    });
  } else {
    if (confirm('Are you sure you want to clear the entire playlist?')) {
      clearPlaylistLogic();
    }
  }
};
const clearPlaylistLogic = () => { /* ... (updated with English messages) ... */
  try {
    stopPlaylist();
    state.playlist.items = []; state.playlist.currentIndex = -1; state.playlist.playedInShuffle.clear();
    updatePlaylistUI(); saveMediaList(); showNotification('Playlist cleared.', 'info');
  } catch (e) { console.error('Error in clearPlaylistLogic:', e); showNotification('Error clearing playlist.', 'error'); }
};

// Playback Functions
const selectMedia = (media, loopSingle = false) => {
  stopPlaylist(false);
  clearMediaDisplay();

  const element = createMediaElement(media, !loopSingle, loopSingle);
  if (element) {
    state.dom.mediaContainer.appendChild(element);
    showNotification(`Playing: ${media.name}${loopSingle ? ' (looped)' : ''}`, 'info');
    state.playlist.isPlaying = !loopSingle;
    if (loopSingle) {
      state.playlist.currentIndex = -1;
      updateActiveHighlight(media.id, 'library');
    }
    else updateActiveHighlight(null);
    updatePlaylistUI();
  } else {
    showNotification(`Cannot play ${media.name}. File may be corrupt or unsupported.`, 'error');
  }
};

const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
  let element;
  if (!media || !media.type || !media.url) {
    console.error("Cannot create media element: media item or URL is invalid.", media);
    return null;
  }
  state.activeVideoElement = null;

  if (media.type === 'image') {
    element = createUIElement('img', {
      src: media.url,
      alt: media.name,
      style: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        top: '0',
        left: '0'
      }
    });
    if (isPlaylistContext) {
      clearPlaybackTimers();
      state.playlist.playbackTimer = setTimeout(() => {
        if (state.playlist.isPlaying) playNextItem();
      }, CONSTANTS.IMAGE_DISPLAY_DURATION);
    }
  } else if (media.type === 'video') {
    element = document.createElement('video');
    element.src = media.url;
    element.autoplay = true;
    element.loop = loopOverride;
    element.muted = (media.settings?.volume === 0);
    element.volume = media.settings?.volume ?? 0;
    element.playbackRate = media.settings?.playbackRate ?? 1;
    element.dataset.mediaId = media.id;

    const trimStart = media.settings?.trimStart ?? 0;
    const trimEnd = media.settings?.trimEnd ?? media.settings?.originalDuration ?? Infinity;
    element.currentTime = trimStart;

    element.addEventListener('timeupdate', function() {
      if (this.currentTime >= trimEnd) {
        if (this.loop) {
          this.currentTime = trimStart;
          this.play().catch(e => console.warn("Error re-playing on trim loop:", e));
        } else if (isPlaylistContext && state.playlist.isPlaying && !this.ended) {
          this.pause();
        }
      }
    });

    Object.assign(element.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      position: 'absolute',
      top: '0',
      left: '0'
    });

    element.addEventListener('error', function(e) {
      console.error(`Error loading video: ${media.name}`, e.target.error);
      showNotification(`Error playing ${media.name}: ${e.target.error?.message || 'Unknown error'}`, 'error');
      if (isPlaylistContext && state.playlist.isPlaying) setTimeout(() => playNextItem(), 100);
    });

    if (isPlaylistContext && !loopOverride) {
      element.addEventListener('ended', () => {
        if (state.playlist.isPlaying) playNextItem();
      });
    }
    state.activeVideoElement = element;
  }
  return element;
};

const playPlaylist = () => { /* ... (updated with English messages) ... */
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
const pausePlaylist = () => { /* ... (updated with English messages) ... */
  state.playlist.isPlaying = false; clearPlaybackTimers();
  const videoElement = state.dom.mediaContainer.querySelector('video');
  if (videoElement && !videoElement.paused) videoElement.pause();
  updatePlaylistUI(); showNotification("Playlist paused.", "info");
};
const playMediaByIndex = (index) => {
  console.log('playMediaByIndex called with index:', index);

  if (index < 0 || index >= state.playlist.items.length) {
    if (state.playlist.items.length > 0) {
      index = 0;
      state.playlist.currentIndex = 0;
    }
    else {
      stopPlaylist();
      return;
    }
  }

  const mediaId = state.playlist.items[index];
  const media = state.mediaLibrary.find(m => m.id === mediaId);

  if (!media) {
    showNotification(`Media "${mediaId}" not found. Skipping.`, 'warning');
    if (state.playlist.isPlaying) {
      state.playlist.items.splice(index, 1);
      if (index <= state.playlist.currentIndex) state.playlist.currentIndex--;
      if (state.playlist.items.length === 0) {
        stopPlaylist();
        return;
      }
      const nextIndexToTry = Math.max(0, Math.min(index, state.playlist.items.length - 1));
      playNextItem(nextIndexToTry);
    }
    return;
  }

  state.playlist.currentIndex = index;
  state.playlist.isPlaying = true;
  clearMediaDisplay();

  console.log('Creating media element for:', media);
  const element = createMediaElement(media, true);

  if (element) {
    console.log('Appending element to container:', state.dom.mediaContainer);
    state.dom.mediaContainer.appendChild(element);

    if (element.tagName.toLowerCase() === 'video') {
      element.play().catch(e => {
        console.warn("Autoplay prevented by browser for:", media.name, e);
        showNotification(`Playing ${media.name} may require user interaction.`, "info");
      });
    }
    updateActiveHighlight(media.id, 'playlist');
    if (state.playlist.shuffle) state.playlist.playedInShuffle.add(mediaId);
  } else if (state.playlist.isPlaying) {
    console.error('Failed to create media element');
    playNextItem();
  }
  updatePlaylistUI();
};
const playNextItem = (startIndex = -1) => { /* ... (no changes from previous version) ... */
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
const clearPlaybackTimers = () => { /* ... (no changes from previous version) ... */
  if (state.playlist.playbackTimer) { clearTimeout(state.playlist.playbackTimer); state.playlist.playbackTimer = null; }
};
const toggleShuffle = () => { /* ... (updated with English messages) ... */
  state.playlist.shuffle = !state.playlist.shuffle;
  if (state.playlist.shuffle) {
    state.playlist.playedInShuffle.clear();
    if (state.playlist.isPlaying && state.playlist.items.length > 0 && state.playlist.currentIndex >= 0) {
      const currentMediaId = state.playlist.items[state.playlist.currentIndex];
      if (currentMediaId) state.playlist.playedInShuffle.add(currentMediaId);
    }
  }
  updatePlaylistUI(); saveMediaList();
  showNotification(state.playlist.shuffle ? 'Shuffle mode: Enabled' : 'Shuffle mode: Disabled', 'info');
};
const stopPlaylist = (resetIndexAndDisplay = true) => { /* ... (no changes from previous version) ... */
  state.playlist.isPlaying = false; clearPlaybackTimers();
  const videoElement = state.dom.mediaContainer.querySelector('video');
  if (videoElement) videoElement.pause();
  if (resetIndexAndDisplay) { state.playlist.currentIndex = -1; clearMediaDisplay(); updateActiveHighlight(null); }
  state.playlist.playedInShuffle.clear(); updatePlaylistUI();
  state.activeVideoElement = null;
};
const clearMediaDisplay = () => {
  try {
    clearPlaybackTimers();
    state.activeVideoElement = null;
    while (state.dom.mediaContainer.firstChild) {
      const el = state.dom.mediaContainer.firstChild;
      if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) {
        el.pause();
        el.removeAttribute('src');
        if (typeof el.load === 'function') {
          try {
            el.load();
          } catch(e) {
            /* ignore */
          }
        }
      }
      state.dom.mediaContainer.removeChild(el);
    }
  } catch (e) {
    console.error("Error clearing media display:", e);
    if (state.dom.mediaContainer) {
      state.dom.mediaContainer.innerHTML = '';
    }
  }
};
const deleteMedia = (id, suppressNotification = false) => { /* ... (updated with English messages) ... */
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
  if (state.mediaLibrary.length === 0) clearPlaylistLogic(); else updatePlaylistUI();
  updateMediaGallery(); saveMediaList();
  if (!suppressNotification) { /* Notification removed */ }
  clearSelection();
};

// UI Update Functions (Playlist, Active Highlight)
const updatePlaylistUI = () => { /* ... (updated with English messages) ... */
  const playlistContainer = state.dom.playlistContainer;
  const emptyState = document.getElementById('playlist-empty-state');
  const controlsContainer = state.dom.playlistControlsContainer;
  if (!playlistContainer || !controlsContainer) { console.error("Playlist UI elements not found, cannot update."); return; }
  Array.from(playlistContainer.querySelectorAll('.playlist-item')).forEach(child => child.remove());
  if (state.playlist.items.length === 0) {
    if (emptyState) { emptyState.style.display = 'block'; emptyState.textContent = 'Drag media here or from library to create playlist.'; }
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
const createPlaylistItem = (media, index) => { /* ... (minor changes for displaying trimmed duration) ... */
  const item = createUIElement('div', { className: 'playlist-item', attributes: { 'data-id': media.id, 'data-index': index.toString(), draggable: 'true' } });
  if (index === state.playlist.currentIndex) item.classList.add('current');
  const highlightRing = createUIElement('div', { className: 'media-active-highlight-ring' });
  item.appendChild(highlightRing);
  item.addEventListener('dragstart', function(e) {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'playlist-reorder', id: media.id, index: index }));
    e.dataTransfer.effectAllowed = 'move'; this.classList.add('dragging');
  });
  item.addEventListener('dragend', function() { this.classList.remove('dragging'); /* ... */ });
  item.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; /* ... */ });
  item.addEventListener('dragleave', function() { this.classList.remove('drag-over-top', 'drag-over-bottom'); });
  item.addEventListener('drop', function(e) { /* ... (same as before) ... */ });
  const thumbnailDiv = createUIElement('div', { className: 'playlist-item-thumbnail', style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } : { backgroundColor: '#333' } });
  if (!media.thumbnail) thumbnailDiv.textContent = media.type.charAt(0).toUpperCase();
  item.appendChild(thumbnailDiv);

  const infoContainer = createUIElement('div', { className: 'playlist-item-info' });
  const nameEl = createUIElement('div', { className: 'playlist-item-name', textContent: media.name });
  infoContainer.appendChild(nameEl);
  const detailsEl = createUIElement('div', { className: 'playlist-item-details' });
  let detailsText = `${media.type.charAt(0).toUpperCase() + media.type.slice(1)} · ${formatFileSize(media.size)}`;
  if (media.type === 'video' && media.settings?.originalDuration) {
    const trimStart = media.settings.trimStart ?? 0;
    const trimEnd = media.settings.trimEnd ?? media.settings.originalDuration;
    const displayDuration = Math.max(0, trimEnd - trimStart);
    detailsText += ` · ${formatTime(displayDuration)} (Trimmed)`;
  }
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
const updateActiveHighlight = (mediaId, sourceType) => { /* ... (no changes from previous version) ... */
  removeAllActiveHighlights();
  if (!mediaId) { state.activeHighlight.mediaId = null; state.activeHighlight.sourceType = null; return; }
  state.activeHighlight.mediaId = mediaId; state.activeHighlight.sourceType = sourceType;
  const selector = sourceType === 'library' ? `.media-thumbnail[data-id="${mediaId}"]` : `.playlist-item[data-id="${mediaId}"]`;
  const container = sourceType === 'library' ? state.dom.mediaGallery : state.dom.playlistContainer;
  const element = container?.querySelector(selector);
  if (element) element.classList.add('playing-from-here');
};
const removeAllActiveHighlights = () => { /* ... (no changes from previous version) ... */
  document.querySelectorAll('.media-thumbnail.playing-from-here, .playlist-item.playing-from-here').forEach(el => el.classList.remove('playing-from-here'));
};

// Storage Functions
const saveMediaList = () => { /* ... (updated with English messages) ... */
  try {
    const mediaForStorage = state.mediaLibrary.map(media => {
      const { url, thumbnail, ...mediaMeta } = media;
      return { ...mediaMeta };
    });
    const storageData = { media: mediaForStorage, playlist: { items: state.playlist.items, shuffle: state.playlist.shuffle } };
    localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(storageData));
  } catch (e) { console.error('Failed to save media list:', e); showNotification('Error saving media library. Storage may be full.', 'error'); }
};
const loadSavedMedia = () => { /* ... (updated with English messages) ... */
  try {
    const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEY);
    if (!savedData) {
      const oldSavedData = localStorage.getItem(CONSTANTS.STORAGE_KEY_OLD);
      if (oldSavedData) {
        try {
          const oldParsedData = JSON.parse(oldSavedData);
          if (oldParsedData.media?.length > 0) {
            showNotification(`Found old library data (${oldParsedData.media.length} items). Re-import files for full functionality.`, 'warning', 10000);
          }
          localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
        } catch (oldParseError) { console.warn("Error parsing old saved data, removing it:", oldParseError); localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD); }
      }
      updateMediaGallery(); updatePlaylistUI(); return;
    }
    const parsedData = JSON.parse(savedData);
    if (parsedData.media && Array.isArray(parsedData.media) && parsedData.media.length > 0) {
      showNotification(`Loaded metadata for ${parsedData.media.length} media entries. Re-import actual files to enable playback.`, 'info', 7000);
    }
    state.mediaLibrary = (parsedData.media || []).map(media => {
      if (!media.settings) media.settings = {};
      if (typeof media.settings.volume === 'undefined') media.settings.volume = 0;
      if (typeof media.settings.playbackRate === 'undefined') media.settings.playbackRate = 1.0;
      if (typeof media.settings.trimStart === 'undefined') media.settings.trimStart = 0;
      if (typeof media.settings.trimEnd === 'undefined' || media.settings.trimEnd === null) { // Ensure trimEnd is set
        media.settings.trimEnd = media.settings.originalDuration || 0;
      }
      if (media.settings.trimEnd <= media.settings.trimStart && media.settings.originalDuration > 0) {
        media.settings.trimEnd = media.settings.originalDuration;
      }
      return media;
    });
    state.playlist.items = parsedData.playlist?.items || [];
    state.playlist.shuffle = parsedData.playlist?.shuffle || false;
    updateMediaGallery(); updatePlaylistUI();
  } catch (e) {
    console.error('Failed to load or parse saved media data:', e);
    showNotification('Error loading saved media library. Data may be corrupted.', 'error');
    localStorage.removeItem(CONSTANTS.STORAGE_KEY); localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
    updateMediaGallery(); updatePlaylistUI();
  }
};

// Utility Functions
const formatFileSize = (bytes) => { /* ... (no changes from previous version) ... */
  if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
  const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
const formatTime = (totalSeconds) => { /* ... (no changes from previous version) ... */
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
const showNotification = (message, type = 'info', duration = 3000) => { /* ... (no changes from previous version) ... */
  if (typeof WallpaperApp !== 'undefined' && typeof WallpaperApp.UI?.showNotification === 'function') WallpaperApp.UI.showNotification(message, type, duration);
  else console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`);
};
const applyTemporaryHighlight = (element) => { /* ... (no changes from previous version) ... */
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
  _getState: () => state
};
})();

MediaModule.init();
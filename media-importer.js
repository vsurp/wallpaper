/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Version 0.3.0 - Video Editing Features Removed
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
    dom: { // Cached DOM elements
      importSubmenu: null,
      mediaContainer: null,
      mediaGallery: null,
      playlistContainer: null,
      playlistControlsContainer: null,
      playbackControls: null,
      mediaLibrarySection: null,
      playlistSection: null,
      mediaEmptyState: null, // Cached empty state for media gallery
      playlistEmptyState: null, // Cached empty state for playlist
      mainMenu: null // Reference to the main menu for will-change
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
    activeVideoElement: null
  };

  // Initialization
  const init = () => {
    document.addEventListener('DOMContentLoaded', () => {
      // Cache main menu element for will-change optimization
      state.dom.mainMenu = document.getElementById('main-menu');
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
    // Cache DOM elements
    state.dom.importSubmenu = document.getElementById('import-media-submenu');
    state.dom.mediaContainer = document.getElementById('media-container');

    if (!state.dom.importSubmenu || !state.dom.mediaContainer) {
      console.error('Required DOM elements not found for MediaModule. Retrying in 1s...');
      setTimeout(initMediaImporter, 1000);
      return;
    }

    setupMediaImportUI();
    loadSavedMedia();
    setupGlobalEventDelegation(); // Setup event delegation after UI is created
  };

  // UI Setup Functions
  const setupMediaImportUI = () => {
    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
    if (!menuContent) {
      console.error("Menu content not found in import-media-submenu");
      return;
    }

    menuContent.innerHTML = ''; // Clear existing content
    setupFileInput();

    const importButton = createUIElement('button', {
      className: 'submenu-item import-media-button',
      textContent: 'IMPORT MEDIA',
      attributes: { 'data-action': 'import-media-action' },
      // No individual event listener here, will be handled by delegation
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

    state.dom.playbackControls = { style: { display: 'none' } }; // Placeholder
  };

  const setupFileInput = () => {
    if (state.fileInput && state.fileInput.parentNode) {
      state.fileInput.parentNode.removeChild(state.fileInput);
    }
    state.fileInput = createUIElement('input', {
      type: 'file', id: 'media-file-input',
      accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','),
      multiple: true, style: { display: 'none' },
      events: { change: (e) => { handleFileSelect(e.target.files); e.target.value = ''; } } // Keep direct listener for file input change
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
    // Handle event listeners
    if (options.events) {
      Object.entries(options.events).forEach(([event, handler]) => element.addEventListener(event, handler));
    }
    return element;
  };

  const createDivider = () => createUIElement('hr', { className: 'divider' });

  const createMediaLibrarySection = () => {
    const section = createUIElement('div', { id: 'media-library-section' });
    const title = createUIElement('h3', { textContent: 'MEDIA LIBRARY' });
    const selectionInfo = createUIElement('div', { className: 'selection-info', textContent: 'Shift+Click or drag to select multiple' });
    const gallery = createUIElement('div', { id: 'media-gallery' });
    setupGalleryDragSelection(gallery); // This involves mousedown on gallery itself, not individual items
    state.dom.mediaEmptyState = createUIElement('div', { id: 'media-empty-state', textContent: '' });
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
      if (e.button !== 0 || e.target !== gallery) return; // Only on gallery background
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

    // Mousemove for drag selection is on document, already optimized with throttle if needed elsewhere
    // but this specific one is fine as is, as it's conditional (isSelecting)
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
      // Event handled by delegation
    });
    const transitionsButton = createUIElement('button', {
      id: 'transitions-quick-nav-button', textContent: 'TRANSITIONS', className: 'quick-nav-button btn btn-secondary',
      // Event handled by delegation
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
      // Drag/drop events are fine on the container itself
    });

    // Add drag/drop event listeners
    playlistContainer.addEventListener('dragover', handlePlaylistDragOver);
    playlistContainer.addEventListener('drop', handlePlaylistDrop);
    playlistContainer.addEventListener('dragenter', (e) => {
      e.preventDefault();
      playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)';
    });
    playlistContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      playlistContainer.style.backgroundColor = '';
    });

    state.dom.playlistEmptyState = createUIElement('div', { id: 'playlist-empty-state', textContent: 'Drag your media here to create a playlist' });
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
        // Event listeners will be handled by delegation on controlsContainer
      });
      controlsContainer.appendChild(button);
    });
  };

  // --- Event Delegation Setup ---
  const setupGlobalEventDelegation = () => {
    // Delegation for Media Importer Submenu
    if (state.dom.importSubmenu) {
      state.dom.importSubmenu.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.matches('.import-media-button')) {
          state.fileInput.click();
        } else if (target.matches('#effects-quick-nav-button')) {
          if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
            window.WallpaperApp.MenuTools.openL2Submenu('effects-list-submenu');
            removeAllStaticHighlights();
            applyStaticHighlight(state.dom.mediaLibrarySection);
          } else showNotification('Menu function (effects) not available.', 'warning');
        } else if (target.matches('#transitions-quick-nav-button')) {
          if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
            window.WallpaperApp.MenuTools.openL2Submenu('transitions-list-submenu');
            removeAllStaticHighlights();
            applyStaticHighlight(state.dom.playlistSection);
          } else showNotification('Menu function (transitions) not available.', 'warning');
        }
      });
    }

    // Delegation for Media Gallery
    if (state.dom.mediaGallery) {
      state.dom.mediaGallery.addEventListener('click', (e) => {
        const thumbnail = e.target.closest('.media-thumbnail');
        if (!thumbnail) return;

        const mediaId = thumbnail.dataset.id;
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (!media) return;

        if (e.target.closest('.media-delete-btn')) {
          e.stopPropagation();
          e.preventDefault();
          handleMediaDelete(media);
        } else {
          handleThumbnailClick(e, media, thumbnail); // Pass thumbnail to avoid re-query
        }
      });

      // Dragstart for media thumbnails (still needs to be on individual items for dataTransfer)
      // This part is tricky to fully delegate if complex data needs to be set.
      // However, we can simplify createMediaThumbnail not to add these if we handle it here.
      // For now, keeping dragstart on individual items as it's less frequent than click.
    }

    // Delegation for Playlist Controls
    if (state.dom.playlistControlsContainer) {
      state.dom.playlistControlsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.matches('#playlist-play-button')) playPlaylist();
        else if (target.matches('#playlist-shuffle-button')) toggleShuffle();
        else if (target.matches('#playlist-clear-button')) confirmClearPlaylist();
      });
    }

    // Delegation for Playlist Items
    if (state.dom.playlistContainer) {
      state.dom.playlistContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.playlist-item');
        if (!item) return;

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
            playPlaylist(); // This will call playMediaByIndex
            updateActiveHighlight(media.id, 'playlist');
          }
        }
      });
      // Drag events for playlist items (dragstart needs to be on items for data transfer)
    }
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
      settings: {}
    };
    state.mediaLibrary.push(mediaItem);
    try {
      mediaItem.thumbnail = await generateThumbnail(mediaItem, file);
    } catch (err) {
      console.warn(`Error generating thumbnail for ${mediaItem.name}:`, err);
      mediaItem.thumbnail = createFallbackThumbnail(mediaItem.type);
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
    const emptyState = state.dom.mediaEmptyState; // Use cached
    if (!gallery) { console.error("Media gallery DOM element not found, cannot update."); return; }

    if (emptyState) {
      emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
      if (state.mediaLibrary.length === 0) emptyState.textContent = ''; // Set appropriate empty text if needed
    }

    // Use DocumentFragment for batch DOM updates
    const fragment = document.createDocumentFragment();
    state.mediaLibrary.forEach(media => fragment.appendChild(createMediaThumbnail(media)));

    // Clear existing thumbnails (except selection box and empty state)
    Array.from(gallery.children).forEach(child => {
      if (child !== emptyState && !child.classList.contains('selection-box')) {
        gallery.removeChild(child);
      }
    });
    gallery.appendChild(fragment); // Append all new thumbnails at once

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

    // Dragstart still on individual items for simplicity of dataTransfer
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

    // Only delete button, no settings button anymore
    const deleteBtn = createUIElement('button', {
      className: 'media-delete-btn btn btn-icon btn-danger', innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': `Delete ${media.name}` }
    });
    thumbnail.appendChild(deleteBtn);
    thumbnail.setAttribute('title', media.name);
    return thumbnail;
  };

  // Handler for delegated media delete
  const handleMediaDelete = (media) => {
    const mediaId = media.id;

    if (state.selection.items.has(mediaId) && state.selection.items.size > 1) {
      // Delete multiple selected items without confirmation
      Array.from(state.selection.items).forEach(id => deleteMedia(id, true));
      clearSelection();
    } else {
      // Delete single item without confirmation
      deleteMedia(mediaId);
    }
  };

  // Selection Management
  const handleThumbnailClick = (e, media, thumbnailElement) => { // thumbnailElement is passed from delegation
    // Button clicks are handled by their own delegated handlers now
    if (state.selection.shiftKeyActive && state.selection.lastSelected) {
      selectRange(state.selection.lastSelected, media.id);
    } else if (state.selection.shiftKeyActive) { // Shift click without a previous lastSelected
      clearSelection();
      addToSelection(media.id);
      state.selection.lastSelected = media.id;
    } else if (e.ctrlKey || e.metaKey) { // Ctrl/Cmd click
      toggleSelection(media.id);
      state.selection.lastSelected = state.selection.items.has(media.id) ? media.id : null;
    } else { // Normal click
      const wasSelected = state.selection.items.has(media.id);
      const multipleSelected = state.selection.items.size > 1;

      if (wasSelected && !multipleSelected) {
        // If already selected and it's the only one, play it
        selectMedia(media, true); // true for loopSingle
      } else {
        // Otherwise, clear existing selection, select this one, and play it
        clearSelection();
        addToSelection(media.id);
        state.selection.lastSelected = media.id;
        selectMedia(media, true); // true for loopSingle
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

  // Playlist Management
  const handlePlaylistDragOver = (e) => {
    e.preventDefault();

    // During dragover, we can only check types, not read the actual data
    // Check for available data types instead of trying to parse data
    if (e.dataTransfer.types.includes('application/json')) {
      // Could be either multiple-media or playlist-reorder
      e.dataTransfer.dropEffect = 'move'; // Default to move, will be corrected on drop
    } else if (e.dataTransfer.types.includes('text/plain')) {
      // Single media drop
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
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
          jsonData.ids.reverse().forEach(id => addToPlaylist(id, insertAtIndex)); // Add in order
          showNotification(`Added ${jsonData.ids.length} items to playlist.`, 'success'); return;
        } else if (jsonData?.type === 'playlist-reorder') {
          const fromIndex = parseInt(jsonData.index);
          const targetElement = e.target.closest('.playlist-item');
          let toIndex = state.playlist.items.length -1; // Default to end if not dropping on an item
          if (targetElement) {
            toIndex = parseInt(targetElement.dataset.index);
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            if (!isDroppedOnTopHalf) toIndex++;
            if (fromIndex < toIndex) toIndex--; // Adjust if moving down
          }
          reorderPlaylistItem(fromIndex, toIndex);
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

  // Add these new functions after handlePlaylistDrop function

  const handleMediaGalleryDragOver = (e) => {
    e.preventDefault();

    // Check if we're dragging a media item
    if (e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('application/json')) {
      e.dataTransfer.dropEffect = 'move';

      // Find the closest media thumbnail
      const thumbnail = e.target.closest('.media-thumbnail');
      if (thumbnail) {
        // Remove previous hover states
        state.dom.mediaGallery.querySelectorAll('.media-thumbnail').forEach(el => {
          el.classList.remove('drag-over-left', 'drag-over-right');
        });

        // Determine which side of the thumbnail we're on
        const rect = thumbnail.getBoundingClientRect();
        const isLeftHalf = e.clientX < rect.left + rect.width / 2;

        if (isLeftHalf) {
          thumbnail.classList.add('drag-over-left');
        } else {
          thumbnail.classList.add('drag-over-right');
        }
      }
    }
  };

  const handleMediaGalleryDrop = (e) => {
    e.preventDefault();

    // Remove all hover states
    state.dom.mediaGallery.querySelectorAll('.media-thumbnail').forEach(el => {
      el.classList.remove('drag-over-left', 'drag-over-right');
    });

    try {
      let draggedMediaId;
      let isMultipleSelection = false;

      // Check for multiple selection first
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const parsed = JSON.parse(jsonData);
        if (parsed.type === 'multiple-media') {
          // For now, we'll just reorder the first item in a multi-selection
          draggedMediaId = parsed.ids[0];
          isMultipleSelection = true;
        }
      } else {
        draggedMediaId = e.dataTransfer.getData('text/plain');
      }

      if (!draggedMediaId) return;

      // Find the drop target
      const dropTarget = e.target.closest('.media-thumbnail');
      if (!dropTarget) return;

      const dropTargetId = dropTarget.dataset.id;
      if (draggedMediaId === dropTargetId) return; // Can't drop on itself

      // Determine drop position
      const rect = dropTarget.getBoundingClientRect();
      const isLeftHalf = e.clientX < rect.left + rect.width / 2;

      reorderMediaLibraryItem(draggedMediaId, dropTargetId, isLeftHalf);

    } catch (err) {
      console.error('Error handling media gallery drop:', err);
      showNotification('Error reordering media.', 'error');
    }
  };

  const reorderMediaLibraryItem = (draggedId, targetId, insertBefore) => {
    const draggedIndex = state.mediaLibrary.findIndex(m => m.id === draggedId);
    const targetIndex = state.mediaLibrary.findIndex(m => m.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove the dragged item
    const [draggedItem] = state.mediaLibrary.splice(draggedIndex, 1);

    // Calculate new index
    let newIndex = targetIndex;
    if (!insertBefore && draggedIndex < targetIndex) {
      // If we're inserting after and the dragged item was before the target,
      // we need to adjust the index since we removed an item
      newIndex = targetIndex;
    } else if (!insertBefore) {
      newIndex = targetIndex + 1;
    } else if (insertBefore && draggedIndex < targetIndex) {
      newIndex = targetIndex - 1;
    }

    // Insert at new position
    state.mediaLibrary.splice(newIndex, 0, draggedItem);

    // Update UI and save
    updateMediaGallery();
    saveMediaList();
    showNotification('Media reordered.', 'success');
  };

  const addToPlaylist = (mediaId, insertAtIndex = -1) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) { showNotification(`Media ID ${mediaId} not found in library.`, 'warning'); return; }
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
          state.playlist.currentIndex = Math.min(index, state.playlist.items.length - 1); // Stay or move to new item at this index
          playMediaByIndex(state.playlist.currentIndex);
        } else stopPlaylist();
      } else if (index < state.playlist.currentIndex) state.playlist.currentIndex--;
    } else { // Playlist is not playing
      if (state.playlist.currentIndex >= state.playlist.items.length) { // If current index was out of bounds
        state.playlist.currentIndex = Math.max(0, state.playlist.items.length - 1);
      } else if (index < state.playlist.currentIndex) {
        state.playlist.currentIndex--;
      }
      if (state.playlist.items.length === 0) state.playlist.currentIndex = -1;
    }
    updatePlaylistUI(); saveMediaList();
    // Notification removed for delete operations
  };

  const reorderPlaylistItem = (fromIndex, toIndex) => {
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length || toIndex < 0 || toIndex > state.playlist.items.length || fromIndex === toIndex) return;
    try {
      const itemToMove = state.playlist.items.splice(fromIndex, 1)[0];
      state.playlist.items.splice(toIndex, 0, itemToMove);
      // Adjust currentIndex if the currently playing/selected item was moved
      if (state.playlist.currentIndex === fromIndex) {
        state.playlist.currentIndex = toIndex;
      } else if (state.playlist.currentIndex > fromIndex && state.playlist.currentIndex <= toIndex) {
        // Item moved from before current to after current (or at current's new spot if toIndex was current's original spot)
        state.playlist.currentIndex--;
      } else if (state.playlist.currentIndex < fromIndex && state.playlist.currentIndex >= toIndex) {
        // Item moved from after current to before current
        state.playlist.currentIndex++;
      }
      updatePlaylistUI(); saveMediaList();
    } catch (e) { console.error('Error reordering playlist item:', e); showNotification('Error reordering playlist.', 'error'); }
  };

  const confirmClearPlaylist = () => {
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
          { text: 'Clear', classes: 'btn-danger', onClick: () => { clearPlaylistLogic(); return true; } },
          { text: 'Cancel', classes: 'btn-secondary', onClick: () => true }
        ]
      });
    } else {
      if (confirm('Are you sure you want to clear the entire playlist?')) {
        clearPlaylistLogic();
      }
    }
  };

  const clearPlaylistLogic = () => {
    try {
      stopPlaylist();
      state.playlist.items = []; state.playlist.currentIndex = -1; state.playlist.playedInShuffle.clear();
      updatePlaylistUI(); saveMediaList(); showNotification('Playlist cleared.', 'info');
    } catch (e) { console.error('Error in clearPlaylistLogic:', e); showNotification('Error clearing playlist.', 'error'); }
  };

  // Playback Functions
  const selectMedia = (media, loopSingle = false) => {
    stopPlaylist(false); // Stop current playlist playback but don't reset index/display yet
    clearMediaDisplay();
    const element = createMediaElement(media, !loopSingle, loopSingle); // !loopSingle for isPlaylistContext
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      showNotification(`Playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');
      state.playlist.isPlaying = !loopSingle; // Only true if not looping single
      if (loopSingle) {
        state.playlist.currentIndex = -1; // Indicate not part of playlist sequence
        updateActiveHighlight(media.id, 'library');
      } else {
        // This case (selectMedia with loopSingle=false) implies starting a playlist from a selected item.
        // Find the item in the playlist to set currentIndex correctly.
        const playlistIndex = state.playlist.items.indexOf(media.id);
        if (playlistIndex !== -1) {
          state.playlist.currentIndex = playlistIndex;
          updateActiveHighlight(media.id, 'playlist');
        } else {
          // If not in playlist, treat as single play (though loopSingle was false)
          // This scenario should be rare if UI guides user properly
          updateActiveHighlight(media.id, 'library');
        }
      }
      updatePlaylistUI(); // Update button states etc.
    } else showNotification(`Cannot play ${media.name}. File might be corrupted or unsupported.`, 'error');
  };

  const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
    let element;
    if (!media || !media.type || !media.url) { console.error("Cannot create media element: media item or URL is invalid.", media); return null; }
    state.activeVideoElement = null; // Clear previous active video

    if (media.type === 'image') {
      element = createUIElement('img', { src: media.url, alt: media.name, style: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' } });
      if (isPlaylistContext) {
        clearPlaybackTimers();
        state.playlist.playbackTimer = setTimeout(() => { if (state.playlist.isPlaying) playNextItem(); }, CONSTANTS.IMAGE_DISPLAY_DURATION);
      }
    } else if (media.type === 'video') {
      element = document.createElement('video'); // Not using createUIElement to handle src and events directly
      element.src = media.url;
      element.autoplay = true;
      element.loop = loopOverride; // Loop if single play, not if in playlist (unless overridden)
      element.muted = true;
      element.dataset.mediaId = media.id; // For identification

      element.addEventListener('timeupdate', function() {
        // Basic timeupdate handling without trim functionality
      });

      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });
      element.addEventListener('error', function(e) {
        console.error(`Error loading video: ${media.name}`, e.target.error);
        showNotification(`Error playing ${media.name}: ${e.target.error?.message || 'Unknown error'}`, 'error');
        if (isPlaylistContext && state.playlist.isPlaying) setTimeout(() => playNextItem(), 100); // Try next after a short delay
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

  const playPlaylist = () => {
    if (state.playlist.items.length === 0) { showNotification('Playlist is empty add some media!', 'info'); return; }
    if (state.playlist.isPlaying) { pausePlaylist(); return; } // Toggle behavior

    clearPlaybackTimers();
    state.playlist.advancingInProgress = false; // Reset flag
    state.playlist.isPlaying = true;

    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear(); // Clear history for new shuffle sequence
      // If currentIndex is invalid or not set, pick a random start
      if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length);
      }
      // Add the (potentially new) starting item to playedInShuffle
      const currentMediaId = state.playlist.items[state.playlist.currentIndex];
      if(currentMediaId) state.playlist.playedInShuffle.add(currentMediaId);
    } else { // Not shuffling
      // If currentIndex is invalid or not set, start from the beginning
      if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = 0;
      }
    }
    clearMediaDisplay();
    playMediaByIndex(state.playlist.currentIndex);
    updatePlaylistUI(); // Update play/pause button text
  };

  const pausePlaylist = () => {
    state.playlist.isPlaying = false;
    clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement && !videoElement.paused) videoElement.pause();
    updatePlaylistUI(); // Update play/pause button text
    showNotification("Playlist stopped.", "info");
  };

  const playMediaByIndex = (index) => {
    if (index < 0 || index >= state.playlist.items.length) {
      // If index is out of bounds, but playlist has items, wrap around or stop
      if (state.playlist.items.length > 0) {
        index = 0; // Default to start if out of bounds
        state.playlist.currentIndex = 0;
      } else {
        stopPlaylist(); // No items to play
        return;
      }
    }
    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) {
      showNotification(`Media "${mediaId}" not found. Skipping.`, 'warning');
      if (state.playlist.isPlaying) {
        // Remove problematic item and try to continue
        state.playlist.items.splice(index, 1);
        if (index <= state.playlist.currentIndex) state.playlist.currentIndex--; // Adjust current index
        if (state.playlist.items.length === 0) { stopPlaylist(); return; }
        const nextIndexToTry = Math.max(0, Math.min(index, state.playlist.items.length - 1));
        playNextItem(nextIndexToTry); // Try to play next available
      }
      return;
    }

    state.playlist.currentIndex = index;
    state.playlist.isPlaying = true; // Ensure this is set
    clearMediaDisplay();
    const element = createMediaElement(media, true); // true for isPlaylistContext
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      if (element.tagName.toLowerCase() === 'video') {
        element.play().catch(e => {
          console.warn("Autoplay prevented by browser for:", media.name, e);
          showNotification(`Playback of ${media.name} may require user interaction.`, "info");
          // Consider pausing playlist or showing a more prominent message
        });
      }
      updateActiveHighlight(media.id, 'playlist');
      if (state.playlist.shuffle) state.playlist.playedInShuffle.add(mediaId);
    } else if (state.playlist.isPlaying) {
      playNextItem(); // If element creation failed, try next
    }
    updatePlaylistUI(); // Update current item highlight
  };

  const playNextItem = (startIndex = -1) => { // startIndex is for specific cases like error recovery
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) {
      stopPlaylist(); return;
    }
    if (state.playlist.advancingInProgress) return; // Prevent multiple rapid advances
    state.playlist.advancingInProgress = true;

    clearPlaybackTimers();
    let nextIndex;

    if (state.playlist.shuffle) {
      if (state.playlist.playedInShuffle.size >= state.playlist.items.length) {
        state.playlist.playedInShuffle.clear(); // All items played, reset shuffle history
      }
      const availableItems = state.playlist.items.filter(id => !state.playlist.playedInShuffle.has(id));
      if (availableItems.length === 0) { // Should be covered by above, but as a fallback
        state.playlist.playedInShuffle.clear();
        nextIndex = Math.floor(Math.random() * state.playlist.items.length);
      } else {
        const randomAvailableId = availableItems[Math.floor(Math.random() * availableItems.length)];
        nextIndex = state.playlist.items.indexOf(randomAvailableId);
      }
    } else { // Not shuffling
      nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
    }

    // If a specific start index is provided (e.g. after removing a bad item)
    if (startIndex !== -1 && startIndex >= 0 && startIndex < state.playlist.items.length) {
      nextIndex = startIndex;
    }

    state.playlist.currentIndex = nextIndex;
    playMediaByIndex(nextIndex);

    // Release the advancing lock after a short delay to allow current media to start
    setTimeout(() => { state.playlist.advancingInProgress = false; }, 200);
  };

  const clearPlaybackTimers = () => {
    if (state.playlist.playbackTimer) { clearTimeout(state.playlist.playbackTimer); state.playlist.playbackTimer = null; }
  };

  const toggleShuffle = () => {
    state.playlist.shuffle = !state.playlist.shuffle;
    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear();
      // If playing, add current item to history so it's not immediately replayed
      if (state.playlist.isPlaying && state.playlist.items.length > 0 && state.playlist.currentIndex >= 0) {
        const currentMediaId = state.playlist.items[state.playlist.currentIndex];
        if(currentMediaId) state.playlist.playedInShuffle.add(currentMediaId);
      }
    }
    updatePlaylistUI();
    saveMediaList();
    showNotification(state.playlist.shuffle ? 'Shuffle: On' : 'Shuffle: Off', 'info');
  };

  const stopPlaylist = (resetIndexAndDisplay = true) => {
    state.playlist.isPlaying = false;
    clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) videoElement.pause();

    if (resetIndexAndDisplay) {
      state.playlist.currentIndex = -1;
      clearMediaDisplay();
      updateActiveHighlight(null); // Clear any active playing highlight
    }
    state.playlist.playedInShuffle.clear(); // Clear shuffle history on stop
    updatePlaylistUI(); // Update button states
    state.activeVideoElement = null;
  };

  const clearMediaDisplay = () => {
    try {
      clearPlaybackTimers();
      state.activeVideoElement = null;
      // More robust clearing
      const container = state.dom.mediaContainer;
      while (container.firstChild) {
        const el = container.firstChild;
        if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) {
          el.pause();
          el.removeAttribute('src'); // Important to release file handle
          el.load(); // Request browser to release resources
        }
        container.removeChild(el);
      }
    } catch (e) { console.error("Error clearing media display:", e); if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = ''; }
  };

  const deleteMedia = (id, suppressNotification = false) => {
    const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id);
    if (indexInLibrary === -1) return;

    const mediaToDelete = state.mediaLibrary[indexInLibrary];
    // Revoke Object URLs
    if (mediaToDelete.url && mediaToDelete.url.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.url);
    if (mediaToDelete.thumbnail && mediaToDelete.thumbnail.startsWith('blob:')) URL.revokeObjectURL(mediaToDelete.thumbnail);

    state.mediaLibrary.splice(indexInLibrary, 1);

    let wasPlayingDeletedItem = false;
    let deletedItemOriginalPlaylistIndex = -1;

    // Remove from playlist and adjust playback
    for (let i = state.playlist.items.length - 1; i >= 0; i--) {
      if (state.playlist.items[i] === id) {
        if (state.playlist.isPlaying && i === state.playlist.currentIndex) {
          wasPlayingDeletedItem = true;
          deletedItemOriginalPlaylistIndex = i; // Store original index before splice
        }
        state.playlist.items.splice(i, 1);
        if (i < state.playlist.currentIndex) state.playlist.currentIndex--;
      }
    }

    if (wasPlayingDeletedItem) {
      if (state.playlist.items.length > 0) {
        // Try to play the item that is now at the deleted item's original index, or the new last item
        const nextIndexToPlay = Math.min(deletedItemOriginalPlaylistIndex, state.playlist.items.length - 1);
        state.playlist.currentIndex = nextIndexToPlay; // Set before playing
        playMediaByIndex(nextIndexToPlay);
      } else {
        stopPlaylist(); // No more items
      }
    } else if (state.playlist.currentIndex >= state.playlist.items.length && state.playlist.items.length > 0) {
      // If current index is now out of bounds (e.g. last item was deleted, but not playing)
      state.playlist.currentIndex = state.playlist.items.length - 1;
    } else if (state.playlist.items.length === 0) {
      state.playlist.currentIndex = -1; // Reset index if playlist becomes empty
      stopPlaylist(); // Also stop if it was paused and became empty
    }

    // If the currently displayed media (even if paused/single play) was the one deleted
    const currentMediaElement = state.dom.mediaContainer.querySelector('img, video');
    if (currentMediaElement && currentMediaElement.src === mediaToDelete.url) {
      clearMediaDisplay();
      updateActiveHighlight(null);
    }

    if (state.mediaLibrary.length === 0) clearPlaylistLogic(); // Clear playlist if library is empty
    else updatePlaylistUI();

    updateMediaGallery();
    saveMediaList();
    // Notification removed for delete operations
    clearSelection(); // Clear any selection that might have included the deleted item
  };

  // UI Update Functions (Playlist, Active Highlight)
  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer;
    const emptyState = state.dom.playlistEmptyState; // Use cached
    const controlsContainer = state.dom.playlistControlsContainer;
    if (!playlistContainer || !controlsContainer) { console.error("Playlist UI elements not found, cannot update."); return; }

    const fragment = document.createDocumentFragment();
    if (state.playlist.items.length === 0) {
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'Drag media from your library to create a playlist.';
      }
      controlsContainer.style.visibility = 'hidden';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      controlsContainer.style.visibility = 'visible';
      state.playlist.items.forEach((mediaId, index) => {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) fragment.appendChild(createPlaylistItem(media, index));
        else console.warn(`Media with ID ${mediaId} found in playlist but not in library. Consider auto-removing.`);
      });
    }

    // Clear existing items before appending new ones
    Array.from(playlistContainer.querySelectorAll('.playlist-item')).forEach(child => child.remove());
    playlistContainer.appendChild(fragment);

    const shuffleButton = document.getElementById('playlist-shuffle-button');
    if (shuffleButton) {
      shuffleButton.classList.toggle('active', state.playlist.shuffle);
      shuffleButton.innerHTML = state.playlist.shuffle ? '<span style="filter: grayscale(0%); color: var(--primary-color);">🔀</span> Shuffle On' : '<span style="filter: grayscale(100%);">🔀</span> Shuffle Off';
    }
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

    // Dragstart needs to be on individual items for dataTransfer
    item.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'playlist-reorder', id: media.id, index: index }));
      e.dataTransfer.effectAllowed = 'move'; this.classList.add('dragging');
    });
    item.addEventListener('dragend', function() { this.classList.remove('dragging'); });

    const thumbnailDiv = createUIElement('div', {
      className: 'playlist-item-thumbnail',
      style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } : { backgroundColor: '#333' }
    });
    if (!media.thumbnail) thumbnailDiv.textContent = media.type.charAt(0).toUpperCase();
    item.appendChild(thumbnailDiv);

    const infoContainer = createUIElement('div', { className: 'playlist-item-info' });
    const nameEl = createUIElement('div', { className: 'playlist-item-name', textContent: media.name });
    infoContainer.appendChild(nameEl);
    const detailsEl = createUIElement('div', { className: 'playlist-item-details' });
    let detailsText = `${media.type.charAt(0).toUpperCase() + media.type.slice(1)} · ${formatFileSize(media.size)}`;
    detailsEl.textContent = detailsText;
    infoContainer.appendChild(detailsEl);
    item.appendChild(infoContainer);

    // Delete button, event handled by delegation
    const deleteBtn = createUIElement('button', {
      className: 'btn btn-icon btn-danger playlist-item-delete', innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': `Remove ${media.name} from playlist` }
    });
    item.appendChild(deleteBtn);

    // Playing indicator (conditionally added)
    if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
      item.classList.add('current'); // Add current class here
      const playingIndicator = createUIElement('div', { className: 'playlist-item-playing-indicator', innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>' });
      thumbnailDiv.appendChild(playingIndicator); // Append to thumbnail
    }
    return item;
  };

  const updateActiveHighlight = (mediaId, sourceType) => {
    removeAllActiveHighlights();
    if (!mediaId) { state.activeHighlight.mediaId = null; state.activeHighlight.sourceType = null; return; }
    state.activeHighlight.mediaId = mediaId; state.activeHighlight.sourceType = sourceType;

    let elementToHighlight;
    if (sourceType === 'library') {
      if (state.dom.mediaGallery) {
        elementToHighlight = state.dom.mediaGallery.querySelector(`.media-thumbnail[data-id="${mediaId}"]`);
      }
    } else if (sourceType === 'playlist') {
      if (state.dom.playlistContainer) {
        elementToHighlight = state.dom.playlistContainer.querySelector(`.playlist-item[data-id="${mediaId}"]`);
        // Also ensure the 'current' class is correctly set for playlist items
        state.dom.playlistContainer.querySelectorAll('.playlist-item.current').forEach(el => el.classList.remove('current'));
        if (elementToHighlight) {
          elementToHighlight.classList.add('current'); // Visual cue for current playlist item
          // Add/remove playing indicator dynamically
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

    if (elementToHighlight) {
      elementToHighlight.classList.add('playing-from-here'); // Animation class
    }
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

  // Storage Functions
  const saveMediaList = () => {
    try {
      // Only store metadata, not blob URLs
      const mediaForStorage = state.mediaLibrary.map(media => {
        const { url, thumbnail, ...mediaMeta } = media; // Exclude url and thumbnail
        return { ...mediaMeta, originalUrlExists: !!url, originalThumbnailExists: !!thumbnail }; // Store flags
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
            if (oldParsedData.media?.length > 0) {
              showNotification(`Found old library data (${oldParsedData.media.length} items). Please re-import files for full functionality.`, 'warning', 10000);
            }
            localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
          } catch (oldParseError) { console.warn("Error parsing old saved data, removing it:", oldParseError); localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD); }
        }
        updateMediaGallery(); updatePlaylistUI(); return;
      }
      const parsedData = JSON.parse(savedData);
      if (parsedData.media && Array.isArray(parsedData.media) && parsedData.media.length > 0) {
        showNotification(`Loaded metadata for ${parsedData.media.length} media entries. Please re-import actual files for playback.`, 'info', 7000);
      }
      state.mediaLibrary = (parsedData.media || []).map(media => {
        // Restore essential structure, URL/thumbnail will be null until re-import
        return {
          ...media,
          url: null, // Will be populated on re-import or if user provides a mechanism
          thumbnail: createFallbackThumbnail(media.type), // Show fallback initially
          settings: media.settings || {} // Ensure settings object exists
        };
      });
      state.playlist.items = parsedData.playlist?.items || [];
      state.playlist.shuffle = parsedData.playlist?.shuffle || false;
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

  const applyStaticHighlight = (element) => {
    if (!element) return;
    element.classList.add('static-highlight');
  };

  const removeStaticHighlight = (element) => {
    if (!element) return;
    element.classList.remove('static-highlight');
  };

  const removeAllStaticHighlights = () => {
    document.querySelectorAll('.static-highlight').forEach(el => {
      el.classList.remove('static-highlight');
    });
  };

  // Public API
  return {
    init,
    getCurrentPlaylist: () => JSON.parse(JSON.stringify(state.playlist)),
    getMediaLibrary: () => JSON.parse(JSON.stringify(state.mediaLibrary)),
    _getState: () => state // For debugging or advanced access if needed
  };
})();


MediaModule.init();
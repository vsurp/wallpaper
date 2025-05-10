/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Version 0.1.3 - Refactored for better organization and maintainability
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
    VIDEO_METADATA_TIMEOUT: 10000, // Increased from 5000ms to 10000ms
    VIDEO_THUMBNAIL_TIMEOUT: 10000 // Increased from 5000ms to 10000ms
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
      // Delay initialization slightly to ensure DOM is fully ready
      setTimeout(initMediaImporter, 100); // Reduced delay from 1000ms as DOMContentLoaded should suffice
    });

    // Global event listeners
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
      // Add a retry mechanism in case elements are not immediately available
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

    menuContent.innerHTML = ''; // Clear previous content
    setupFileInput();

    // Import button
    const importButton = createUIElement('button', {
      className: 'submenu-item import-media-button',
      textContent: 'IMPORT MEDIA',
      attributes: { 'data-action': 'import-media-action' },
      events: { click: () => state.fileInput.click() }
    });
    menuContent.appendChild(importButton);
    menuContent.appendChild(createDivider());

    // Media library section
    const mediaLibrarySection = createMediaLibrarySection();
    state.dom.mediaLibrarySection = mediaLibrarySection;
    menuContent.appendChild(mediaLibrarySection);
    menuContent.appendChild(createDivider());

    // Quick navigation section
    const quickNavSection = createQuickNavSection();
    menuContent.appendChild(quickNavSection);
    menuContent.appendChild(createDivider());

    // Playlist section
    const playlistSection = createPlaylistSection();
    state.dom.playlistSection = playlistSection;
    menuContent.appendChild(playlistSection);

    // Initialize playback controls (hidden by default)
    state.dom.playbackControls = { style: { display: 'none' } }; // Placeholder, actual controls are part of playlist section
  };

  const setupFileInput = () => {
    // Remove existing file input if it exists to prevent duplicates
    if (state.fileInput && state.fileInput.parentNode) {
      state.fileInput.parentNode.removeChild(state.fileInput);
    }

    state.fileInput = createUIElement('input', {
      type: 'file',
      id: 'media-file-input', // Ensure ID is consistent
      accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','),
      multiple: true,
      style: { display: 'none' }, // Keep it hidden
      events: {
        change: (e) => {
          handleFileSelect(e.target.files);
          e.target.value = ''; // Reset file input to allow selecting the same file again
        }
      }
    });

    // Append to body to ensure it's always available
    document.body.appendChild(state.fileInput);
  };

  // UI Creation Helper Functions
  const createUIElement = (tag, options = {}) => {
    const element = document.createElement(tag);

    // Apply common properties
    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;
    if (options.textContent) element.textContent = options.textContent;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.type) element.type = options.type; // For input elements
    if (options.accept) element.accept = options.accept; // For file input
    if (options.multiple) element.multiple = options.multiple; // For file input

    // Apply styles
    if (options.style) {
      Object.assign(element.style, options.style);
    }

    // Apply attributes
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    // Attach event listeners
    if (options.events) {
      Object.entries(options.events).forEach(([event, handler]) => {
        element.addEventListener(event, handler);
      });
    }

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
    const selectionInfo = createUIElement('div', {
      className: 'selection-info',
      textContent: 'Shift+Click or drag to select multiple'
    });

    const gallery = createUIElement('div', { id: 'media-gallery' });
    setupGalleryDragSelection(gallery); // Setup drag selection for the gallery

    // Empty state message for the media gallery
    const emptyState = createUIElement('div', {
      id: 'media-empty-state',
      textContent: '' // Initial empty state message
    });

    gallery.appendChild(emptyState); // Add empty state to gallery
    section.appendChild(title);
    section.appendChild(selectionInfo);
    section.appendChild(gallery);

    state.dom.mediaGallery = gallery; // Store gallery reference
    return section;
  };

  const setupGalleryDragSelection = (gallery) => {
    let isSelecting = false;
    let galleryRect = null;

    gallery.addEventListener('mousedown', (e) => {
      // Start selection only on primary button click and if target is the gallery itself (not a thumbnail)
      if (e.button !== 0 || e.target !== gallery) return;

      isSelecting = true;
      galleryRect = gallery.getBoundingClientRect();
      state.selection.startPoint = {
        x: e.clientX - galleryRect.left + gallery.scrollLeft, // Account for scroll
        y: e.clientY - galleryRect.top + gallery.scrollTop   // Account for scroll
      };

      // Remove previous selection box if any
      if (state.selection.selectionBoxElement) {
        state.selection.selectionBoxElement.remove();
      }

      // Create new selection box
      state.selection.selectionBoxElement = createUIElement('div', {
        className: 'selection-box',
        style: {
          left: state.selection.startPoint.x - gallery.scrollLeft + 'px', // Adjust for scroll display
          top: state.selection.startPoint.y - gallery.scrollTop + 'px',   // Adjust for scroll display
          width: '0px',
          height: '0px'
        }
      });

      gallery.appendChild(state.selection.selectionBoxElement);

      // Clear previous selection if Shift key is not pressed
      if (!state.selection.shiftKeyActive) {
        clearSelection();
      }

      e.preventDefault(); // Prevent default browser drag behavior
    });

    document.addEventListener('mousemove', (e) => {
      if (!isSelecting || !state.selection.selectionBoxElement || !galleryRect) return;

      // Calculate current mouse position relative to the gallery, including scroll
      const currentX = e.clientX - galleryRect.left + gallery.scrollLeft;
      const currentY = e.clientY - galleryRect.top + gallery.scrollTop;

      // Determine selection box coordinates
      const x1 = Math.min(state.selection.startPoint.x, currentX);
      const y1 = Math.min(state.selection.startPoint.y, currentY);
      const x2 = Math.max(state.selection.startPoint.x, currentX);
      const y2 = Math.max(state.selection.startPoint.y, currentY);

      // Update selection box style, adjusting for current scroll position for display
      state.selection.selectionBoxElement.style.left = x1 - gallery.scrollLeft + 'px';
      state.selection.selectionBoxElement.style.top = y1 - gallery.scrollTop + 'px';
      state.selection.selectionBoxElement.style.width = (x2 - x1) + 'px';
      state.selection.selectionBoxElement.style.height = (y2 - y1) + 'px';

      // Define the selection rectangle in document coordinates
      const selectionRectDoc = {
        left: x1 + galleryRect.left - gallery.scrollLeft,
        top: y1 + galleryRect.top - gallery.scrollTop,
        right: x2 + galleryRect.left - gallery.scrollLeft,
        bottom: y2 + galleryRect.top - gallery.scrollTop
      };

      // Check for intersections with media thumbnails
      gallery.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
        const thumbnailRectDoc = thumbnail.getBoundingClientRect(); // Gets position relative to viewport
        const mediaId = thumbnail.dataset.id;

        // Check for intersection
        const intersects = !(
            thumbnailRectDoc.right < selectionRectDoc.left ||
            thumbnailRectDoc.left > selectionRectDoc.right ||
            thumbnailRectDoc.bottom < selectionRectDoc.top ||
            thumbnailRectDoc.top > selectionRectDoc.bottom
        );

        if (intersects) {
          if (!state.selection.items.has(mediaId)) {
            addToSelection(mediaId); // Add to selection set
            thumbnail.classList.add('selected'); // Visually mark as selected
          }
        } else {
          // If not intersecting and not holding Shift, remove from selection
          if (state.selection.items.has(mediaId) && !state.selection.shiftKeyActive) {
            removeFromSelection(mediaId);
            thumbnail.classList.remove('selected');
          }
        }
      });
    });

    document.addEventListener('mouseup', (e) => {
      if (!isSelecting) return;

      isSelecting = false;
      galleryRect = null; // Clear gallery rectangle

      // Remove selection box
      if (state.selection.selectionBoxElement) {
        state.selection.selectionBoxElement.remove();
        state.selection.selectionBoxElement = null;
      }

      // Update last selected if items are selected
      if (state.selection.items.size > 0) {
        state.selection.lastSelected = Array.from(state.selection.items).pop();
      }
    });
  };

  const createQuickNavSection = () => {
    const section = createUIElement('div', { id: 'quick-nav-section' });

    const effectsButton = createUIElement('button', {
      id: 'effects-quick-nav-button',
      textContent: 'EFFECTS',
      className: 'quick-nav-button btn btn-secondary', // Standard button styling
      events: {
        click: () => {
          // Attempt to open L2 submenu for effects
          if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
            window.WallpaperApp.MenuTools.openL2Submenu('effects-list-submenu');
            applyTemporaryHighlight(state.dom.mediaLibrarySection); // Highlight relevant section
          } else {
            showNotification('Menu function (effects) not available.', 'warning');
          }
        }
      }
    });

    const transitionsButton = createUIElement('button', {
      id: 'transitions-quick-nav-button',
      textContent: 'TRANSITIONS',
      className: 'quick-nav-button btn btn-secondary', // Standard button styling
      events: {
        click: () => {
          // Attempt to open L2 submenu for transitions
          if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
            window.WallpaperApp.MenuTools.openL2Submenu('transitions-list-submenu');
            applyTemporaryHighlight(state.dom.playlistSection); // Highlight relevant section
          } else {
            showNotification('Menu function (transitions) not available.', 'warning');
          }
        }
      }
    });

    section.appendChild(effectsButton);
    section.appendChild(transitionsButton);
    return section;
  };

  const createPlaylistSection = () => {
    const section = createUIElement('div', { id: 'playlist-section' });
    const title = createUIElement('h3', { textContent: 'PLAYLIST' });

    // Playlist container for items
    const playlistContainer = createUIElement('div', {
      id: 'playlist-container',
      events: {
        dragover: handlePlaylistDragOver, // Handle items dragged over
        drop: handlePlaylistDrop,         // Handle dropped items
        dragenter: (e) => { // Visual feedback on drag enter
          e.preventDefault();
          playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)';
        },
        dragleave: (e) => { // Revert visual feedback on drag leave
          e.preventDefault();
          playlistContainer.style.backgroundColor = '';
        }
      }
    });

    // Empty state message for the playlist
    const emptyState = createUIElement('div', {
      id: 'playlist-empty-state',
      textContent: 'Drag media here to create playlist'
    });

    playlistContainer.appendChild(emptyState); // Add empty state to playlist container
    section.appendChild(title);
    section.appendChild(playlistContainer);

    state.dom.playlistContainer = playlistContainer; // Store playlist container reference

    // Container for playlist control buttons
    const controlsContainer = createUIElement('div', {
      id: 'playlist-controls',
      style: { visibility: 'hidden' } // Initially hidden, shown when playlist has items
    });

    state.dom.playlistControlsContainer = controlsContainer;
    createPlaylistControls(controlsContainer); // Populate controls
    section.appendChild(controlsContainer);

    return section;
  };

  const createPlaylistControls = (controlsContainer) => {
    controlsContainer.innerHTML = ''; // Clear existing controls

    // Define playlist control buttons
    const buttons = [
      {
        id: 'playlist-play-button',
        html: '<span style="filter: grayscale(100%);">▶</span> Play All', // Play/Pause icon
        handler: playPlaylist,
        class: 'btn-primary' // Primary action button
      },
      {
        id: 'playlist-shuffle-button',
        html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle', // Shuffle icon
        handler: toggleShuffle,
        class: 'btn-secondary'
      },
      {
        id: 'playlist-clear-button',
        html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', // Clear icon
        handler: clearPlaylist,
        class: 'btn-danger' // Destructive action button
      }
    ];

    // Create and append buttons
    buttons.forEach(btnData => {
      const button = createUIElement('button', {
        id: btnData.id,
        innerHTML: btnData.html,
        className: `btn playlist-button ${btnData.class || 'btn-secondary'}`,
        events: { click: btnData.handler }
      });
      controlsContainer.appendChild(button);
    });
  };

  // Media Management Functions
  const handleFileSelect = async (files) => { // Make async to await processing
    if (!files || files.length === 0) return;

    let validCount = 0;
    let invalidCount = 0;
    const processingPromises = [];

    Array.from(files).forEach(file => {
      if (isFileSupported(file.type)) {
        processingPromises.push(processFile(file).then(() => validCount++));
      } else {
        invalidCount++;
      }
    });

    await Promise.all(processingPromises); // Wait for all files to be processed

    if (validCount > 0) {
      showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}.`, 'success');
    }
    if (invalidCount > 0) {
      showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} not supported.`, 'warning');
    }

    updateMediaGallery();
    updatePlaylistUI();
    saveMediaList();
  };

  const isFileSupported = (type) => {
    return CONSTANTS.SUPPORTED_TYPES.video.includes(type) ||
        CONSTANTS.SUPPORTED_TYPES.image.includes(type);
  };

  const processFile = async (file) => { // Make async
    const id = generateMediaId();
    const url = URL.createObjectURL(file);
    const type = CONSTANTS.SUPPORTED_TYPES.video.includes(file.type) ? 'video' : 'image';

    const mediaItem = {
      id,
      name: file.name,
      type,
      mimeType: file.type,
      size: file.size,
      url, // Store blob URL
      dateAdded: Date.now(),
      thumbnail: null, // Placeholder for thumbnail
      settings: {
        volume: 0, // Default volume to 0 for library items, user can change
        playbackRate: 1,
        originalDuration: null // Will be fetched for videos
      },
      trimSettings: type === 'video' ? { // Default trim settings for videos
        trimEnabled: false,
        startTime: 0,
        endTime: null // Will be set to originalDuration
      } : null
    };

    state.mediaLibrary.push(mediaItem); // Add to library

    // Asynchronously generate thumbnail and get video duration
    try {
      mediaItem.thumbnail = await generateThumbnail(mediaItem, file);
    } catch (err) {
      console.warn(`Error generating thumbnail for ${mediaItem.name}:`, err);
      mediaItem.thumbnail = createFallbackThumbnail(mediaItem.type); // Use a fallback
    }

    if (type === 'video') {
      try {
        mediaItem.settings.originalDuration = await getVideoDuration(mediaItem.url);
        if (mediaItem.trimSettings) {
          mediaItem.trimSettings.endTime = mediaItem.settings.originalDuration;
        }
      } catch (err) {
        console.warn(`Error getting video duration for ${mediaItem.name}:`, err);
        mediaItem.settings.originalDuration = 0; // Default to 0 on error
        if (mediaItem.trimSettings) {
          mediaItem.trimSettings.endTime = 0;
        }
      }
    }
    // No need to call updateMediaGallery or saveMediaList here, will be done after all files in handleFileSelect
  };

  const generateMediaId = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  };

  const getVideoDuration = (videoUrl) => {
    return new Promise((resolve, reject) => { // Added reject
      const video = document.createElement('video');
      video.preload = 'metadata';
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        video.onloadedmetadata = null;
        video.onerror = null;
        video.pause();
        video.removeAttribute('src'); // Essential to release resources
        try { video.load(); } catch(e) { /* ignore */ } // Some browsers might throw error if src is already null
      };

      video.onloadedmetadata = function() {
        const duration = video.duration;
        cleanup();
        if (typeof duration === 'number' && !isNaN(duration) && duration > 0) {
          resolve(duration);
        } else {
          console.warn(`Invalid duration (${duration}) for video: ${videoUrl}. Resolving with 0.`);
          resolve(0); // Resolve with 0 for invalid durations
        }
      };

      video.onerror = function(e) {
        cleanup();
        const errorMsg = `Error loading video metadata for ${videoUrl}`;
        console.warn(errorMsg, e);
        reject(new Error(errorMsg)); // Reject promise on error
      };

      timeoutId = setTimeout(() => {
        const errorMsg = `Timeout loading video metadata for ${videoUrl} after ${CONSTANTS.VIDEO_METADATA_TIMEOUT}ms.`;
        console.warn(errorMsg);
        cleanup();
        reject(new Error(errorMsg)); // Reject promise on timeout
      }, CONSTANTS.VIDEO_METADATA_TIMEOUT);

      try {
        video.src = videoUrl;
      } catch (e) {
        const errorMsg = `Error setting video source for ${videoUrl}`;
        console.warn(errorMsg, e);
        cleanup();
        reject(new Error(errorMsg)); // Reject promise on source setting error
      }
    });
  };

  const generateThumbnail = (mediaItem, file) => {
    return new Promise((resolve, reject) => { // Added reject
      if (mediaItem.type === 'image') {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error(`FileReader error for ${mediaItem.name}`));
        reader.readAsDataURL(file);
      } else if (mediaItem.type === 'video') {
        generateVideoThumbnail(mediaItem.url, mediaItem.name)
            .then(resolve)
            .catch(reject); // Propagate rejection
      } else {
        reject(new Error(`Unsupported type for thumbnail generation: ${mediaItem.type}`));
      }
    });
  };

  const generateVideoThumbnail = (videoUrl, videoName) => {
    return new Promise((resolve, reject) => { // Added reject
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.crossOrigin = "anonymous"; // Add for potential CORS issues with canvas

      let thumbnailGenerated = false;
      let timeoutId = null;

      const cleanupAndResolve = (thumbnailUrl) => {
        if (timeoutId) clearTimeout(timeoutId);
        video.onloadedmetadata = null;
        video.onseeked = null;
        video.onerror = null;
        video.pause();
        video.removeAttribute('src');
        try { video.load(); } catch(e) { /* ignore */ }
        resolve(thumbnailUrl);
      };

      const cleanupAndReject = (errorMsg) => {
        if (timeoutId) clearTimeout(timeoutId);
        video.onloadedmetadata = null;
        video.onseeked = null;
        video.onerror = null;
        video.pause();
        video.removeAttribute('src');
        try { video.load(); } catch(e) { /* ignore */ }
        console.warn(errorMsg);
        reject(new Error(errorMsg));
      };


      const generateFrame = () => {
        if (thumbnailGenerated) return;
        thumbnailGenerated = true;

        try {
          const canvas = document.createElement('canvas');
          canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width;
          canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            cleanupAndReject(`Could not get 2D context for ${videoName}`);
            return;
          }

          ctx.fillStyle = '#1A1A1A'; // Dark background
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const videoAspectRatio = video.videoWidth / video.videoHeight;
            const canvasAspectRatio = canvas.width / canvas.height;
            let drawWidth, drawHeight, offsetX, offsetY;

            if (videoAspectRatio > canvasAspectRatio) { // Video wider than canvas
              drawHeight = canvas.width / videoAspectRatio;
              drawWidth = canvas.width;
              offsetY = (canvas.height - drawHeight) / 2;
              offsetX = 0;
            } else { // Video taller than or same aspect as canvas
              drawWidth = canvas.height * videoAspectRatio;
              drawHeight = canvas.height;
              offsetX = (canvas.width - drawWidth) / 2;
              offsetY = 0;
            }
            ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
          } else {
            console.warn(`Video dimensions are zero for ${videoName}. Drawing placeholder.`);
          }

          drawPlayButton(ctx, canvas.width, canvas.height); // Draw play icon overlay
          cleanupAndResolve(canvas.toDataURL('image/jpeg', 0.7)); // Use JPEG for smaller size
        } catch (err) {
          cleanupAndReject(`Error generating thumbnail canvas for ${videoName}: ${err.message}`);
        }
      };

      video.onloadedmetadata = function() {
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          try {
            video.currentTime = Math.min(1.0, video.duration / 3); // Seek to 1/3 or 1s
          } catch (e) {
            console.warn(`Error seeking video ${videoName}:`, e);
            generateFrame(); // Attempt to generate frame even if seek fails
          }
        } else {
          generateFrame(); // Generate frame if no duration (e.g., live stream, though not typical here)
        }
      };

      video.onseeked = function() {
        generateFrame();
      };

      video.onerror = function(e) {
        cleanupAndReject(`Error loading video for thumbnail: ${videoName}. Error: ${e.message || e.type}`);
      };

      timeoutId = setTimeout(() => {
        if (!thumbnailGenerated) {
          cleanupAndReject(`Thumbnail generation timeout for ${videoName} after ${CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT}ms.`);
        }
      }, CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT);

      try {
        video.src = videoUrl;
      } catch (e) {
        cleanupAndReject(`Error setting video source for thumbnail: ${videoName}. Error: ${e.message}`);
      }
    });
  };

  const createFallbackThumbnail = (type = 'media') => {
    const canvas = document.createElement('canvas');
    canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width;
    canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Transparent pixel

    // Background
    ctx.fillStyle = '#333'; // Dark grey
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text (e.g., "VIDEO" or "IMAGE")
    ctx.fillStyle = '#ccc'; // Light grey text
    ctx.font = `bold ${Math.min(canvas.height / 4, 20)}px Barlow, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let textContent = type.toUpperCase();
    if (type === 'video') {
      drawPlayButton(ctx, canvas.width, canvas.height, '#ccc'); // Draw a play button for videos
    } else {
      ctx.fillText(textContent, canvas.width / 2, canvas.height / 2);
    }


    return canvas.toDataURL('image/png');
  };


  const drawPlayButton = (ctx, width, height, color = 'rgba(255, 255, 255, 0.7)') => {
    ctx.fillStyle = color;
    const centerX = width / 2;
    const centerY = height / 2;
    const triangleSize = Math.min(width, height) * 0.25; // Slightly larger play button

    ctx.beginPath();
    // Triangle points for a play button
    ctx.moveTo(centerX - triangleSize / 2, centerY - triangleSize * 0.866 / 2); // Top-left
    ctx.lineTo(centerX - triangleSize / 2, centerY + triangleSize * 0.866 / 2); // Bottom-left
    ctx.lineTo(centerX + triangleSize * 0.8, centerY); // Right point (make it a bit wider)
    ctx.closePath();
    ctx.fill();
  };

  // UI Update Functions
  const updateMediaGallery = () => {
    const gallery = state.dom.mediaGallery;
    const emptyState = document.getElementById('media-empty-state');

    if (!gallery) {
      console.error("Media gallery DOM element not found, cannot update.");
      return;
    }

    // Toggle empty state visibility
    if (emptyState) {
      emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
      if (state.mediaLibrary.length === 0) {
        emptyState.textContent = '';
      }
    }

    // Clear existing thumbnails (except empty state and selection box)
    Array.from(gallery.children).forEach(child => {
      if (child.id !== 'media-empty-state' && !child.classList.contains('selection-box')) {
        child.remove();
      }
    });

    // Add new media thumbnails
    state.mediaLibrary.forEach(media => {
      gallery.appendChild(createMediaThumbnail(media));
    });

    updateMediaSelectionUI(); // Ensure selection state is reflected

    // Re-apply active highlight if necessary
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'library') {
      updateActiveHighlight(state.activeHighlight.mediaId, 'library');
    }
  };

  const createMediaThumbnail = (media) => {
    const thumbnail = createUIElement('div', {
      className: 'media-thumbnail',
      attributes: { 'data-id': media.id, draggable: 'true' }
    });

    // Active highlight ring (initially hidden)
    const highlightRing = createUIElement('div', { className: 'media-active-highlight-ring' });
    thumbnail.appendChild(highlightRing);

    // Drag start event for adding to playlist
    thumbnail.addEventListener('dragstart', (e) => {
      // If multiple items are selected and this is one of them, drag all selected
      if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'multiple-media',
          ids: Array.from(state.selection.items) // Send IDs of all selected items
        }));
      } else { // Otherwise, drag only this item
        e.dataTransfer.setData('text/plain', media.id);
      }
      e.dataTransfer.effectAllowed = 'copy'; // Indicate a copy operation
      thumbnail.classList.add('dragging'); // Visual feedback for dragging
    });
    thumbnail.addEventListener('dragend', () => thumbnail.classList.remove('dragging'));


    // Image container for thumbnail preview
    const imgContainer = createUIElement('div', {
      className: 'media-thumbnail-img-container',
      style: media.thumbnail ? {
        backgroundImage: `url(${media.thumbnail})`
      } : { // Fallback style if no thumbnail
        backgroundColor: '#333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        color: 'white',
        fontWeight: 'bold'
      }
    });

    if (!media.thumbnail) { // Display type initial if no thumbnail
      imgContainer.textContent = media.type.charAt(0).toUpperCase();
    }
    thumbnail.appendChild(imgContainer);

    // Name label
    const nameLabel = createUIElement('div', {
      className: 'media-thumbnail-name',
      textContent: media.name
    });
    thumbnail.appendChild(nameLabel);

    // Type badge (e.g., VIDEO, IMAGE)
    const badge = createUIElement('div', {
      className: 'media-type-badge',
      textContent: media.type.toUpperCase()
    });
    thumbnail.appendChild(badge);

    // Settings button (cog icon)
    const settingsBtn = createUIElement('button', {
      className: 'media-settings-btn btn btn-icon',
      innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>',
      attributes: { 'aria-label': `Settings for ${media.name}` },
      events: {
        click: (e) => {
          e.stopPropagation(); // Prevent click from bubbling to thumbnail selection
          openMediaSettingsDialog(media);
        }
      }
    });
    thumbnail.appendChild(settingsBtn);

    // Delete button (X icon)
    const deleteBtn = createUIElement('button', {
      className: 'media-delete-btn btn btn-icon btn-danger', // Danger class for styling
      innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': `Delete ${media.name}` },
      events: {
        click: (e) => {
          e.stopPropagation(); // Prevent click from bubbling
          // Confirm deletion if multiple items are selected
          if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
            if (confirm(`Delete ${state.selection.items.size} selected clips? This cannot be undone.`)) {
              Array.from(state.selection.items).forEach(idToDelete => deleteMedia(idToDelete));
              clearSelection(); // Clear selection after deleting multiple
            }
          } else { // Single item deletion
            if (confirm(`Delete "${media.name}"? This cannot be undone.`)) {
              deleteMedia(media.id);
            }
          }
        }
      }
    });
    thumbnail.appendChild(deleteBtn);

    // Tooltip for media name and click handler for selection/playback
    thumbnail.setAttribute('title', media.name); // Use native title for simple tooltip
    thumbnail.addEventListener('click', (e) => {
      handleThumbnailClick(e, media);
    });

    return thumbnail;
  };

  // Selection Management
  const handleThumbnailClick = (e, media) => {
    // Ignore clicks on buttons within the thumbnail
    const settingsBtn = e.currentTarget.querySelector('.media-settings-btn');
    const deleteBtn = e.currentTarget.querySelector('.media-delete-btn');
    if (e.target === settingsBtn || settingsBtn?.contains(e.target) ||
        e.target === deleteBtn || deleteBtn?.contains(e.target)) {
      return;
    }

    if (state.selection.shiftKeyActive && state.selection.lastSelected) {
      // Range selection with Shift key
      selectRange(state.selection.lastSelected, media.id);
    } else if (state.selection.shiftKeyActive) {
      // Add to selection with Shift key (if no previous lastSelected)
      clearSelection(); // Start a new selection if lastSelected is null
      addToSelection(media.id);
      state.selection.lastSelected = media.id;
    } else if (e.ctrlKey || e.metaKey) { // Ctrl/Cmd key for individual toggle
      toggleSelection(media.id);
      state.selection.lastSelected = state.selection.items.has(media.id) ? media.id : null;
    } else {
      // Single click without modifiers
      const wasSelected = state.selection.items.has(media.id);
      const multipleSelected = state.selection.items.size > 1;

      if (wasSelected && !multipleSelected) { // Clicked on an already solely selected item
        selectMedia(media, true); // Play it (loop single)
      } else { // Clicked on a new item or one of many selected
        clearSelection();
        addToSelection(media.id);
        state.selection.lastSelected = media.id;
        selectMedia(media, true); // Play it (loop single)
      }
    }
    updateMediaSelectionUI(); // Update visual selection state
  };

  const clearSelection = () => {
    state.selection.items.clear();
    state.selection.lastSelected = null;
    updateMediaSelectionUI();
  };

  const addToSelection = (mediaId) => {
    state.selection.items.add(mediaId);
    // No UI update here, handled by caller or updateMediaSelectionUI
  };

  const removeFromSelection = (mediaId) => {
    state.selection.items.delete(mediaId);
    // No UI update here
  };

  const toggleSelection = (mediaId) => {
    if (state.selection.items.has(mediaId)) {
      state.selection.items.delete(mediaId);
    } else {
      state.selection.items.add(mediaId);
    }
    // updateMediaSelectionUI will be called by the caller (handleThumbnailClick)
  };

  const selectRange = (startId, endId) => {
    const allThumbnails = Array.from(state.dom.mediaGallery.querySelectorAll('.media-thumbnail'));
    const startIndex = allThumbnails.findIndex(t => t.dataset.id === startId);
    const endIndex = allThumbnails.findIndex(t => t.dataset.id === endId);


    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    // If not holding Ctrl/Meta, clear previous selection before range selecting
    if (!state.selection.shiftKeyActive && !(event?.ctrlKey || event?.metaKey)) {
      // This logic seems to conflict with the expectation that Shift is already active.
      // Assuming Shift is the primary modifier for range selection.
      // If we want Ctrl/Meta + Shift to add a range, that's a different logic.
      // For now, standard Shift range selection implies starting fresh or adding to existing if Ctrl/Meta was also held.
      // Let's assume standard behavior: Shift clears and selects range.
      // To add to selection with shift, one would typically use Ctrl+Click then Shift+Click.
      // The current `handleThumbnailClick` already clears if only Shift is pressed and no lastSelected.
    }


    for (let i = minIndex; i <= maxIndex; i++) {
      const mediaIdInRange = allThumbnails[i].dataset.id;
      if (mediaIdInRange) {
        addToSelection(mediaIdInRange);
      }
    }
    state.selection.lastSelected = endId; // Update last selected to the end of the range
    // updateMediaSelectionUI will be called by the caller
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
    if (existingDialog) existingDialog.remove(); // Remove if already open

    const backdrop = createUIElement('div', {
      id: 'media-settings-dialog-backdrop',
      className: 'media-settings-dialog-backdrop acrylic acrylic-dark'
    });

    const dialog = createUIElement('div', {
      id: 'media-settings-dialog',
      className: 'media-settings-dialog' // Base class for styling
    });

    // Add open class for animation after a short delay
    setTimeout(() => {
      dialog.classList.add('open');
      backdrop.classList.add('open');
    }, 10);

    createDialogContent(dialog, media, backdrop); // Populate dialog

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop); // Append to body

    const firstInput = dialog.querySelector('input, textarea, select');
    if (firstInput) firstInput.focus(); // Focus first interactive element
  };

  const createDialogContent = (dialog, media, backdrop) => {
    // Header with title and close button
    const header = createUIElement('div', { className: 'media-settings-dialog-header' });
    const title = createUIElement('h3', { textContent: `Settings: ${media.name}` });
    const closeBtn = createUIElement('button', {
      className: 'btn btn-icon dialog-close-btn',
      innerHTML: '&times;', // Close icon
      attributes: { 'aria-label': 'Close settings' },
      events: { click: () => closeDialog(dialog, backdrop) }
    });
    header.appendChild(title);
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    // Body for settings content
    const body = createUIElement('div', { className: 'media-settings-dialog-body' });
    const settingsTooltip = createUIElement('div', {
      className: 'settings-tooltip',
      textContent: 'Settings apply to playback from library and playlist.'
    });
    body.appendChild(settingsTooltip);

    // Name input
    const nameGroup = createFormGroup('Clip Name:', 'text', media.name, `media-name-${media.id}`);
    body.appendChild(nameGroup);

    if (media.type === 'video') {
      createVideoSettings(body, media); // Add video-specific settings
    }

    // Quick navigation to Effects/Transitions
    const navButtonsContainer = createUIElement('div', {
      style: { display: 'flex', gap: '10px', marginTop: '20px' }
    });
    const effectsLink = createUIElement('button', {
      textContent: 'EFFECTS', className: 'btn btn-secondary setting-btn', style: { flex: '1' },
      events: { click: () => { closeBtn.click(); document.getElementById('effects-quick-nav-button')?.click(); }}
    });
    const transitionsLink = createUIElement('button', {
      textContent: 'TRANSITIONS', className: 'btn btn-secondary setting-btn', style: { flex: '1' },
      events: { click: () => { closeBtn.click(); document.getElementById('transitions-quick-nav-button')?.click(); }}
    });
    navButtonsContainer.appendChild(effectsLink);
    navButtonsContainer.appendChild(transitionsLink);
    body.appendChild(navButtonsContainer);
    dialog.appendChild(body);

    // Footer with Save and Cancel buttons
    const footer = createUIElement('div', { className: 'media-settings-dialog-footer' });
    const saveBtn = createUIElement('button', {
      className: 'btn btn-primary', textContent: 'Save Changes',
      events: { click: () => saveMediaSettings(media, dialog, backdrop) }
    });
    const cancelBtn = createUIElement('button', {
      className: 'btn btn-secondary', textContent: 'Cancel',
      events: { click: () => closeBtn.click() }
    });
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    dialog.appendChild(footer);
  };

  const createFormGroup = (labelText, inputType, inputValue, inputId, options = {}) => {
    const group = createUIElement('div', { className: 'form-group' });
    const label = createUIElement('label', { htmlFor: inputId, textContent: labelText });
    const input = createUIElement('input', {
      type: inputType,
      id: inputId,
      value: inputValue,
      ...options // Spread additional options like min, max, step
    });
    group.appendChild(label);
    group.appendChild(input);
    return group;
  };

  const createVideoSettings = (body, media) => {
    const trimGroup = createUIElement('div', { className: 'form-group' });
    const trimLabel = createUIElement('label', { textContent: 'Trim Video:' });
    trimGroup.appendChild(trimLabel);

    const videoPreview = createUIElement('video', {
      src: media.url, // Use blob URL
      controls: true,
      muted: !(media.settings?.volume > 0), // Mute if volume is 0
      style: { width: '100%', marginBottom: '10px', backgroundColor: '#000', borderRadius: '4px' }
    });

    let videoDuration = media.settings?.originalDuration || 0;
    // Deep copy trim settings to avoid modifying original object until save
    let currentTrimSettings = JSON.parse(JSON.stringify(media.trimSettings || {
      trimEnabled: false, startTime: 0, endTime: videoDuration
    }));

    // Ensure endTime is initialized correctly if null or invalid
    if (currentTrimSettings.endTime === null || currentTrimSettings.endTime > videoDuration || currentTrimSettings.endTime <=0 && videoDuration > 0) {
      currentTrimSettings.endTime = videoDuration;
    }


    videoPreview.onloadedmetadata = function() {
      const duration = videoPreview.duration;
      if (typeof duration === 'number' && !isNaN(duration) && duration > 0) {
        videoDuration = duration;
        // Update originalDuration in mediaItem if it wasn't set or was 0
        if (!media.settings.originalDuration || media.settings.originalDuration <= 0) {
          media.settings.originalDuration = videoDuration;
        }
        // Correct endTime if it's invalid or null, based on the actual loaded duration
        if (currentTrimSettings.endTime === null || currentTrimSettings.endTime > videoDuration || currentTrimSettings.endTime <= 0) {
          currentTrimSettings.endTime = videoDuration;
        }
      }
      videoPreview.currentTime = currentTrimSettings.startTime || 0;
      updateTrimUI(); // Update UI with loaded values
    };
    trimGroup.appendChild(videoPreview);

    const trimDescription = createUIElement('div', {
      className: 'trim-description',
      textContent: 'Adjust start and end points. Video will loop within the trimmed section during preview.'
    });
    trimGroup.appendChild(trimDescription);

    const trimContainer = createUIElement('div'); // Container for trim controls

    // Start time slider and display
    const startTimeGroup = createTrimControl('Start Point:', `trim-start-${media.id}`, (value) => {
      if (videoDuration <= 0) return;
      const percent = parseFloat(value) / 100;
      currentTrimSettings.startTime = Math.max(0, percent * videoDuration);
      // Ensure start time is not after end time
      if (currentTrimSettings.startTime >= currentTrimSettings.endTime && currentTrimSettings.endTime > 0.1) {
        currentTrimSettings.startTime = Math.max(0, currentTrimSettings.endTime - 0.1);
      } else if (currentTrimSettings.startTime >= currentTrimSettings.endTime) {
        currentTrimSettings.startTime = 0; // fallback if endTime is also 0 or very small
      }
      videoPreview.currentTime = currentTrimSettings.startTime;
      updateTrimUI();
      currentTrimSettings.trimEnabled = true; // Enable trim when slider is used
    });

    // End time slider and display
    const endTimeGroup = createTrimControl('End Point:', `trim-end-${media.id}`, (value) => {
      if (videoDuration <= 0) return;
      const percent = parseFloat(value) / 100;
      currentTrimSettings.endTime = Math.min(videoDuration, percent * videoDuration);
      // Ensure end time is not before start time
      if (currentTrimSettings.endTime <= currentTrimSettings.startTime && currentTrimSettings.startTime < videoDuration - 0.1) {
        currentTrimSettings.endTime = Math.min(videoDuration, currentTrimSettings.startTime + 0.1);
      } else if (currentTrimSettings.endTime <= currentTrimSettings.startTime) {
        currentTrimSettings.endTime = videoDuration; // fallback if startTime is also at the end or very large
      }
      videoPreview.currentTime = currentTrimSettings.endTime;
      updateTrimUI();
      currentTrimSettings.trimEnabled = true; // Enable trim when slider is used
    });

    trimContainer.appendChild(startTimeGroup);
    trimContainer.appendChild(endTimeGroup);

    // Visual trim UI (timeline bar)
    const trimUIContainer = createUIElement('div', {
      style: { position: 'relative', height: '20px', backgroundColor: '#111', borderRadius: '4px', overflow: 'hidden', marginTop: '15px', marginBottom: '15px' }
    });
    const timeline = createUIElement('div', {
      style: { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: '#333' }
    });
    const trimRegion = createUIElement('div', { // Represents the selected trim portion
      style: { position: 'absolute', top: '0', height: '100%', backgroundColor: 'rgba(var(--primary-color-rgb), 0.5)', borderLeft: '2px solid var(--primary-color)', borderRight: '2px solid var(--primary-color)', boxSizing: 'border-box' }
    });
    const timeDisplay = createUIElement('div', { // Displays formatted times
      style: { marginTop: '5px', fontSize: '12px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }
    });

    const updateTrimUI = () => {
      // Fallback if videoDuration is still 0 but preview has a duration
      if (videoDuration <= 0 && videoPreview.duration > 0) {
        videoDuration = videoPreview.duration;
        if (!media.settings.originalDuration || media.settings.originalDuration <= 0) {
          media.settings.originalDuration = videoDuration;
        }
        if (currentTrimSettings.endTime === null || currentTrimSettings.endTime > videoDuration || currentTrimSettings.endTime <= 0) {
          currentTrimSettings.endTime = videoDuration;
        }
      }

      if (videoDuration <= 0) { // If duration still unknown, disable sliders and show message
        const startInput = document.getElementById(`trim-start-${media.id}`);
        const endInput = document.getElementById(`trim-end-${media.id}`);
        if (startInput) { startInput.value = 0; startInput.disabled = true; }
        if (endInput) { endInput.value = 100; endInput.disabled = true; }
        timeDisplay.textContent = 'Waiting for video duration...';
        trimRegion.style.left = '0%';
        trimRegion.style.width = '0%';
        return;
      }

      // Enable sliders if disabled
      const startInput = document.getElementById(`trim-start-${media.id}`);
      const endInput = document.getElementById(`trim-end-${media.id}`);
      if (startInput) startInput.disabled = false;
      if (endInput) endInput.disabled = false;


      // Ensure trim values are valid
      currentTrimSettings.startTime = Math.max(0, Math.min(currentTrimSettings.startTime ?? 0, videoDuration));
      currentTrimSettings.endTime = Math.max(currentTrimSettings.startTime, Math.min(currentTrimSettings.endTime ?? videoDuration, videoDuration));


      const startVal = currentTrimSettings.startTime;
      const endVal = currentTrimSettings.endTime;
      const startPercent = (startVal / videoDuration) * 100;
      const endPercent = (endVal / videoDuration) * 100;

      trimRegion.style.left = `${startPercent}%`;
      trimRegion.style.width = `${Math.max(0, endPercent - startPercent)}%`;
      timeDisplay.textContent = `Start: ${formatTime(startVal)} | End: ${formatTime(endVal)} | Duration: ${formatTime(Math.max(0, endVal - startVal))}`;

      // Update slider positions and value displays
      if (startInput) startInput.value = startPercent;
      if (endInput) endInput.value = endPercent;
      const startDisplay = startTimeGroup.querySelector('span');
      const endDisplay = endTimeGroup.querySelector('span');
      if (startDisplay) startDisplay.textContent = formatTime(startVal);
      if (endDisplay) endDisplay.textContent = formatTime(endVal);
    };

    timeline.addEventListener('click', (e) => { // Allow clicking on timeline to seek
      if (videoDuration <= 0) return;
      const trimRect = trimUIContainer.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - trimRect.left) / trimRect.width));
      videoPreview.currentTime = percent * videoDuration;
    });

    timeline.appendChild(trimRegion);
    trimUIContainer.appendChild(timeline);
    trimContainer.appendChild(trimUIContainer);
    trimContainer.appendChild(timeDisplay);
    trimGroup.appendChild(trimContainer);
    body.appendChild(trimGroup);

    // Store currentTrimSettings on the body element for access in saveMediaSettings
    body.currentTrimSettings = currentTrimSettings;
    body.updateTrimUI = updateTrimUI; // Expose for initial call

    // Volume control
    const volumeGroup = createSliderControl('Volume:', `media-volume-${media.id}`,
        media.settings?.volume ?? 0, 0, 1, 0.01, (value) => {
          videoPreview.volume = parseFloat(value);
          videoPreview.muted = parseFloat(value) === 0;
        }, (value) => `${Math.round(parseFloat(value) * 100)}%`);
    body.appendChild(volumeGroup);

    // Playback speed control
    const rateGroup = createSliderControl('Playback Speed:', `media-rate-${media.id}`,
        media.settings?.playbackRate ?? 1, 0.25, 2, 0.05, (value) => { // Finer step for playback rate
          videoPreview.playbackRate = parseFloat(value);
        }, (value) => `${parseFloat(value).toFixed(2)}x`);
    body.appendChild(rateGroup);

    // Initial UI update for trim
    if (videoDuration > 0) updateTrimUI();
  };

  const createTrimControl = (labelText, inputId, onInput) => {
    const group = createUIElement('div', { className: 'form-group', style: { marginBottom: '15px' } });
    const label = createUIElement('label', { htmlFor: inputId, textContent: labelText });
    const input = createUIElement('input', {
      type: 'range', id: inputId, min: '0', max: '100', step: '0.1', // Fine step for precision
      events: { input: (e) => onInput(e.target.value) }
    });
    const valueDisplay = createUIElement('span', { style: { marginLeft: '10px', minWidth: '50px', display: 'inline-block' } }); // For time display
    group.appendChild(label);
    group.appendChild(input);
    group.appendChild(valueDisplay);
    return group;
  };

  const createSliderControl = (labelText, inputId, defaultValue, min, max, step, onInput, formatValue) => {
    const group = createUIElement('div', { className: 'form-group' });
    const label = createUIElement('label', { htmlFor: inputId, textContent: labelText });
    const inputContainer = createUIElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' }});
    const input = createUIElement('input', {
      type: 'range', id: inputId, min: min.toString(), max: max.toString(), step: step.toString(), value: defaultValue.toString(),
      style: { flexGrow: '1'}, // Make slider take available space
      events: {
        input: (e) => {
          const value = e.target.value;
          valueDisplay.textContent = formatValue(value);
          if (onInput) onInput(value);
        }
      }
    });
    const valueDisplay = createUIElement('span', { textContent: formatValue(defaultValue), style: { minWidth: '40px', textAlign: 'right'} });
    inputContainer.appendChild(input);
    inputContainer.appendChild(valueDisplay);
    group.appendChild(label);
    group.appendChild(inputContainer);
    return group;
  };

  const saveMediaSettings = (media, dialog, backdrop) => {
    media.name = document.getElementById(`media-name-${media.id}`).value.trim() || media.name; // Use existing name if new is empty

    if (media.type === 'video') {
      if (!media.settings) media.settings = {}; // Ensure settings object exists

      media.settings.volume = parseFloat(document.getElementById(`media-volume-${media.id}`).value);
      media.settings.playbackRate = parseFloat(document.getElementById(`media-rate-${media.id}`).value);

      // Retrieve currentTrimSettings from the dialog body
      const body = dialog.querySelector('.media-settings-dialog-body');
      if (body && body.currentTrimSettings) {
        const videoDuration = media.settings.originalDuration || 0;
        // Ensure trim settings are validated against the known duration
        let { startTime, endTime, trimEnabled } = body.currentTrimSettings;

        startTime = Math.max(0, Math.min(startTime ?? 0, videoDuration));
        endTime = Math.max(startTime, Math.min(endTime ?? videoDuration, videoDuration));

        // Determine if trim is effectively active
        const effectivelyTrimmed = (startTime > 0.01) ||
            (videoDuration > 0 && Math.abs(endTime - videoDuration) > 0.01 && endTime < videoDuration);

        media.trimSettings = {
          startTime: startTime,
          endTime: endTime,
          trimEnabled: trimEnabled && effectivelyTrimmed // Only true if sliders were touched AND it results in actual trim
        };
      }
    }

    updateMediaGallery();
    updatePlaylistUI(); // Update playlist if item details (like name or duration from trim) changed
    saveMediaList();
    showNotification('Settings saved!', 'success');
    closeDialog(dialog, backdrop);
  };

  const closeDialog = (dialog, backdrop) => {
    dialog.classList.remove('open');
    backdrop.classList.remove('open');
    // Remove from DOM after animation
    setTimeout(() => {
      backdrop.remove();
      // Release object URLs for video previews if they exist and are not the main media URL
      const videoPreview = dialog.querySelector('video');
      if (videoPreview && videoPreview.src.startsWith('blob:')) {
        // Check if this src is different from the main media.url to avoid revoking it
        // This check is complex as media.url might also be a blob.
        // For simplicity, we assume dialog previews might create their own blobs or use the same.
        // A more robust solution would tag dialog-specific blobs.
        // URL.revokeObjectURL(videoPreview.src); // Be cautious with this.
      }
    }, 300); // Match CSS animation duration
  };


  // Playlist Management
  const handlePlaylistDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
    // Determine drop effect based on data type
    const isReordering = e.dataTransfer.types.includes('application/json') && JSON.parse(e.dataTransfer.getData('application/json') || '{}').type === 'playlist-reorder';
    const isAddingNew = e.dataTransfer.types.includes('text/plain') || (e.dataTransfer.types.includes('application/json') && JSON.parse(e.dataTransfer.getData('application/json') || '{}').type === 'multiple-media');

    if (isReordering) {
      e.dataTransfer.dropEffect = 'move';
    } else if (isAddingNew) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none'; // No drop allowed for other types
    }
  };

  const handlePlaylistDrop = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = ''; // Reset background feedback

    try {
      const jsonDataText = e.dataTransfer.getData('application/json');
      if (jsonDataText) {
        const jsonData = JSON.parse(jsonDataText);
        if (jsonData?.type === 'multiple-media' && Array.isArray(jsonData.ids)) {
          // Handle drop of multiple media items from library
          const targetElement = e.target.closest('.playlist-item');
          let insertAtIndex = state.playlist.items.length; // Default to end
          if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            insertAtIndex = parseInt(targetElement.dataset.index || '0') + (isDroppedOnTopHalf ? 0 : 1);
          }

          // Add items in reverse to maintain original order if dragged together
          jsonData.ids.reverse().forEach(id => addToPlaylist(id, insertAtIndex));
          showNotification(`Added ${jsonData.ids.length} items to playlist.`, 'success');
          return;

        } else if (jsonData?.type === 'playlist-reorder') {
          // Handle reordering within the playlist
          const fromIndex = parseInt(jsonData.index);
          const targetElement = e.target.closest('.playlist-item');
          if (targetElement) {
            let toIndex = parseInt(targetElement.dataset.index);
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            if (!isDroppedOnTopHalf) toIndex++; // Insert after if dropped on bottom half
            if (fromIndex < toIndex) toIndex--; // Adjust if moving item downwards
            reorderPlaylistItem(fromIndex, toIndex);
          } else { // Dropped onto empty area of playlist container
            reorderPlaylistItem(fromIndex, state.playlist.items.length -1); // Move to end
          }
          return;
        }
      }

      // Handle drop of a single media item from library (text/plain)
      const mediaId = e.dataTransfer.getData('text/plain');
      if (mediaId) {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) {
          const targetElement = e.target.closest('.playlist-item');
          let insertAtIndex = state.playlist.items.length; // Default to end
          if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < targetRect.top + targetRect.height / 2;
            insertAtIndex = parseInt(targetElement.dataset.index || '0') + (isDroppedOnTopHalf ? 0 : 1);
          }
          addToPlaylist(mediaId, insertAtIndex);
        }
      }
    } catch (err) {
      console.error('Error in handlePlaylistDrop:', err);
      showNotification('Error adding item to playlist.', 'error');
    }
  };

  const addToPlaylist = (mediaId, insertAtIndex = -1) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) {
      showNotification(`Media with ID ${mediaId} not found in library.`, 'warning');
      return;
    }

    // Prevent adding duplicates if desired (optional, current behavior allows duplicates)
    // if (state.playlist.items.includes(mediaId)) {
    //   showNotification(`${media.name} is already in the playlist.`, 'info');
    //   return;
    // }

    const wasEmpty = state.playlist.items.length === 0;

    if (insertAtIndex === -1 || insertAtIndex >= state.playlist.items.length) {
      state.playlist.items.push(mediaId); // Add to end
    } else {
      state.playlist.items.splice(insertAtIndex, 0, mediaId); // Insert at specific index
      // Adjust current playing index if insertion happens before or at current index
      if (state.playlist.isPlaying && insertAtIndex <= state.playlist.currentIndex) {
        state.playlist.currentIndex++;
      }
    }

    if (wasEmpty && state.playlist.items.length > 0) {
      state.playlist.currentIndex = 0; // Set first item as current if playlist was empty
    }

    updatePlaylistUI();
    saveMediaList();
    showNotification(`Added to playlist: ${media.name}`, 'success');
  };

  const removeFromPlaylist = (index) => {
    if (index < 0 || index >= state.playlist.items.length) return;

    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);

    state.playlist.items.splice(index, 1); // Remove item

    if (state.playlist.isPlaying) {
      if (index === state.playlist.currentIndex) { // If removed item was playing
        if (state.playlist.items.length > 0) {
          // Play next or first item
          state.playlist.currentIndex = Math.min(index, state.playlist.items.length - 1);
          playMediaByIndex(state.playlist.currentIndex);
        } else {
          stopPlaylist(); // Stop if playlist becomes empty
        }
      } else if (index < state.playlist.currentIndex) {
        state.playlist.currentIndex--; // Adjust current index if removed item was before current
      }
    } else { // If not playing, just adjust index if necessary
      if (state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = Math.max(0, state.playlist.items.length - 1);
      } else if (index < state.playlist.currentIndex) {
        state.playlist.currentIndex--;
      }
      if (state.playlist.items.length === 0) {
        state.playlist.currentIndex = -1;
      }
    }

    updatePlaylistUI();
    saveMediaList();

    if (media) {
      showNotification(`Removed from playlist: ${media.name}`, 'info');
    }
  };

  const reorderPlaylistItem = (fromIndex, toIndex) => {
    // Validate indices
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length ||
        toIndex < 0 || toIndex > state.playlist.items.length || // Allow toIndex to be list length for appending
        fromIndex === toIndex) {
      return;
    }

    try {
      const itemToMove = state.playlist.items.splice(fromIndex, 1)[0];
      state.playlist.items.splice(toIndex, 0, itemToMove);

      // Update current playing index if it's affected by the reorder
      if (state.playlist.currentIndex === fromIndex) {
        state.playlist.currentIndex = toIndex;
      } else if (state.playlist.currentIndex > fromIndex && state.playlist.currentIndex <= toIndex) {
        state.playlist.currentIndex--; // Item moved from before current to after/at current
      } else if (state.playlist.currentIndex < fromIndex && state.playlist.currentIndex >= toIndex) {
        state.playlist.currentIndex++; // Item moved from after current to before current
      }

      updatePlaylistUI();
      saveMediaList();
    } catch (e) {
      console.error('Error reordering playlist item:', e);
      showNotification('Error reordering playlist.', 'error');
    }
  };

  const clearPlaylist = () => {
    try {
      if (state.playlist.items.length === 0) {
        showNotification('Playlist is already empty.', 'info');
        return;
      }
      if (!confirm('Are you sure you want to clear the entire playlist?')) {
        return;
      }
      stopPlaylist(); // Stop playback
      state.playlist.items = [];
      state.playlist.currentIndex = -1;
      state.playlist.playedInShuffle.clear(); // Clear shuffle history
      updatePlaylistUI();
      saveMediaList();
      showNotification('Playlist cleared.', 'info');
    } catch (e) {
      console.error('Error in clearPlaylist:', e);
      showNotification('Error clearing playlist.', 'error');
    }
  };

  // Playback Functions
  const selectMedia = (media, loopSingle = false) => {
    stopPlaylist(false); // Stop current playlist playback but don't clear display yet
    clearMediaDisplay(); // Clear any currently displayed media

    const element = createMediaElement(media, !loopSingle, loopSingle); // Create new media element
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      showNotification(`Now playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');
      state.playlist.isPlaying = !loopSingle; // isPlaying is true if it's part of a conceptual "single play" not a formal playlist run

      if (loopSingle) {
        state.playlist.currentIndex = -1; // Not part of formal playlist sequence
        updateActiveHighlight(media.id, 'library'); // Highlight in library
      } else {
        updateActiveHighlight(null); // No highlight if not looping single from library
      }
      updatePlaylistUI(); // Reflect changes in UI
    } else {
      showNotification(`Could not play ${media.name}. File might be corrupted or unsupported.`, 'error');
    }
  };

  const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
    let element;
    if (!media || !media.type || !media.url) { // Check for URL
      console.error("Cannot create media element: media item or URL is invalid.", media);
      return null;
    }

    // Determine if trim settings should be used
    const useTrim = media.type === 'video' && media.trimSettings?.trimEnabled &&
        typeof media.trimSettings.startTime === 'number' &&
        typeof media.trimSettings.endTime === 'number' &&
        media.trimSettings.endTime > media.trimSettings.startTime;

    const trimSettings = media.trimSettings || {};
    const startTime = useTrim ? trimSettings.startTime : 0;
    const endTime = useTrim ? trimSettings.endTime : (media.settings?.originalDuration || Infinity);


    if (media.type === 'image') {
      element = createUIElement('img', {
        src: media.url,
        alt: media.name, // Accessibility
        style: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' }
      });

      if (isPlaylistContext) { // If part of playlist, set timer for next image
        clearPlaybackTimers();
        state.playlist.playbackTimer = setTimeout(() => {
          if (state.playlist.isPlaying) playNextItem();
        }, CONSTANTS.IMAGE_DISPLAY_DURATION);
      }
    } else if (media.type === 'video') {
      element = document.createElement('video');
      element.src = media.url;
      element.autoplay = true;
      element.loop = loopOverride; // Loop if specified (e.g., single library play)
      // Set volume and muted status based on settings or context
      element.muted = (media.settings?.volume === 0) || (media.settings?.volume === undefined && !isPlaylistContext);
      element.volume = media.settings?.volume ?? (isPlaylistContext ? 0.5 : 0); // Default 0.5 for playlist, 0 for library
      element.playbackRate = media.settings?.playbackRate ?? 1;
      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });

      element.addEventListener('error', function(e) {
        console.error(`Error loading video: ${media.name}`, e.target.error);
        showNotification(`Error playing ${media.name}: ${e.target.error?.message || 'Unknown error'}`, 'error');
        if (isPlaylistContext && state.playlist.isPlaying) {
          setTimeout(() => playNextItem(), 100); // Try next item after a short delay
        }
      });

      if (useTrim) {
        element.addEventListener('loadedmetadata', function() {
          if (typeof this.duration === 'number' && !isNaN(this.duration)) {
            // Ensure startTime is within bounds
            this.currentTime = Math.max(0, Math.min(startTime, this.duration - 0.1)); // -0.1 to avoid issues at the very end
          }
        });

        element.addEventListener('timeupdate', function() {
          // If current time is before intended start, seek to start (handles looping within trim)
          if (this.currentTime < (startTime - 0.05) && !this.seeking) { // Check !this.seeking
            this.currentTime = startTime;
          }
          // If current time reaches or exceeds end time, handle next action
          if (this.currentTime >= endTime - 0.05 ) { // -0.05 for buffer
            if (isPlaylistContext && state.playlist.isPlaying && !loopOverride) {
              playNextItem();
            } else if (loopOverride) { // If looping single (from library or explicit loop)
              this.currentTime = startTime; // Loop back to start of trim
              this.play().catch(e => console.warn("Autoplay prevented on trim loop:", media.name, e));
            } else {
              this.pause(); // Pause if not playlist context and not looping
            }
          }
        });
      }

      // Standard 'ended' event for non-trimmed videos or when trim is not used
      if (isPlaylistContext && !loopOverride && !useTrim) {
        element.addEventListener('ended', () => {
          if (state.playlist.isPlaying) playNextItem();
        });
      }
    }

    return element;
  };

  const playPlaylist = () => {
    if (state.playlist.items.length === 0) {
      showNotification('Playlist is empty. Add some media!', 'info');
      return;
    }

    const playAllButton = document.getElementById('playlist-play-button');

    if (state.playlist.isPlaying) { // If already playing, this button acts as Pause
      pausePlaylist();
      return;
    }

    // Start or resume playback
    clearPlaybackTimers();
    state.playlist.advancingInProgress = false; // Reset advancing flag
    state.playlist.isPlaying = true;

    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear(); // Reset shuffle history for a new shuffled play-through
      // Pick a random starting point if current index is invalid or not set for shuffle
      if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length);
      }
      // Add current to playedInShuffle if starting fresh shuffle play
      const currentMediaId = state.playlist.items[state.playlist.currentIndex];
      if(currentMediaId) state.playlist.playedInShuffle.add(currentMediaId);

    } else { // Not shuffling
      if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = 0; // Default to first item if index is invalid
      }
    }

    clearMediaDisplay(); // Prepare for new media
    playMediaByIndex(state.playlist.currentIndex);
    updatePlaylistUI(); // Update button states etc.
  };

  const pausePlaylist = () => {
    state.playlist.isPlaying = false;
    clearPlaybackTimers(); // Stop image timers

    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement && !videoElement.paused) {
      videoElement.pause();
    }

    updatePlaylistUI(); // Update button to "Play All"
    showNotification("Playlist paused.", "info");
  };

  const playMediaByIndex = (index) => {
    if (index < 0 || index >= state.playlist.items.length) {
      if (state.playlist.items.length > 0) { // If index is out of bounds but playlist not empty
        index = 0; // Wrap around or default to first item
        state.playlist.currentIndex = 0;
      } else {
        stopPlaylist(); // Stop if playlist is actually empty
        return;
      }
    }

    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);

    if (!media) { // If media item not found (e.g., deleted from library but not playlist)
      showNotification(`Media "${mediaId}" not found. Skipping.`, 'warning');
      if (state.playlist.isPlaying) {
        state.playlist.items.splice(index, 1); // Remove missing item from playlist
        if (index <= state.playlist.currentIndex) state.playlist.currentIndex--;
        if (state.playlist.items.length === 0) {
          stopPlaylist(); return;
        }
        // Try to play the next item, adjusting index
        const nextIndexToTry = Math.max(0, Math.min(index, state.playlist.items.length - 1));
        playNextItem(nextIndexToTry); // Pass adjusted index
      }
      return;
    }

    state.playlist.currentIndex = index;
    state.playlist.isPlaying = true; // Ensure playing state is true
    clearMediaDisplay();

    const element = createMediaElement(media, true); // true for isPlaylistContext
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      // For videos, ensure play is initiated (autoplay might be blocked)
      if (element.tagName.toLowerCase() === 'video') {
        element.load(); // Good practice to call load() before play() if src changed
        element.play().catch(e => {
          console.warn("Autoplay prevented by browser for:", media.name, e);
          showNotification(`Playback for ${media.name} might require user interaction.`, "info");
          // Consider showing a play button overlay or similar UX for blocked autoplay
        });
      }
      updateActiveHighlight(media.id, 'playlist'); // Highlight in playlist
      if (state.playlist.shuffle) {
        state.playlist.playedInShuffle.add(mediaId); // Track played items in shuffle mode
      }
    } else if (state.playlist.isPlaying) { // If element creation failed but still in play mode
      playNextItem(); // Attempt to play the next one
    }
    updatePlaylistUI(); // Update UI elements
  };

  const playNextItem = (startIndex = -1) => { // startIndex can be used to force a specific start after an error
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) {
      stopPlaylist();
      return;
    }

    // Prevent rapid/multiple calls to advance
    if (state.playlist.advancingInProgress) return;
    state.playlist.advancingInProgress = true;

    clearPlaybackTimers(); // Clear any image timers

    let nextIndex;

    if (state.playlist.shuffle) {
      // If all items have been played in shuffle, clear history (or stop/loop based on preference)
      if (state.playlist.playedInShuffle.size >= state.playlist.items.length) {
        state.playlist.playedInShuffle.clear(); // Reset for a new shuffle cycle
        // Optionally, could stop here or notify user "Shuffle cycle complete"
      }

      const availableItems = state.playlist.items.filter(id => !state.playlist.playedInShuffle.has(id));
      if (availableItems.length === 0) { // All items played, reset shuffle
        state.playlist.playedInShuffle.clear();
        // Pick any random item to restart, ensuring it's added to playedInShuffle
        nextIndex = Math.floor(Math.random() * state.playlist.items.length);
      } else {
        // Pick a random item from the available (unplayed) ones
        const randomAvailableId = availableItems[Math.floor(Math.random() * availableItems.length)];
        nextIndex = state.playlist.items.indexOf(randomAvailableId);
      }
    } else { // Sequential playback
      nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
    }

    // Override with startIndex if provided (e.g., after skipping a bad file)
    if (startIndex !== -1 && startIndex >= 0 && startIndex < state.playlist.items.length) {
      nextIndex = startIndex;
    }

    state.playlist.currentIndex = nextIndex;
    playMediaByIndex(nextIndex);

    // Release advancing lock after a short delay to allow current media to start
    setTimeout(() => { state.playlist.advancingInProgress = false; }, 200); // Increased delay slightly
  };

  const clearPlaybackTimers = () => {
    if (state.playlist.playbackTimer) {
      clearTimeout(state.playlist.playbackTimer);
      state.playlist.playbackTimer = null;
    }
  };

  const toggleShuffle = () => {
    state.playlist.shuffle = !state.playlist.shuffle;

    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear(); // Clear history when shuffle is turned on
      // If playing, add current item to history so it's not immediately replayed
      if (state.playlist.isPlaying && state.playlist.items.length > 0 && state.playlist.currentIndex >= 0) {
        const currentMediaId = state.playlist.items[state.playlist.currentIndex];
        if (currentMediaId) state.playlist.playedInShuffle.add(currentMediaId);
      }
    }
    updatePlaylistUI(); // Update shuffle button state
    saveMediaList(); // Persist shuffle state
    showNotification(state.playlist.shuffle ? 'Shuffle mode: On' : 'Shuffle mode: Off', 'info');
  };

  const stopPlaylist = (resetIndexAndDisplay = true) => {
    state.playlist.isPlaying = false;
    clearPlaybackTimers();

    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) videoElement.pause(); // Pause any playing video

    if (resetIndexAndDisplay) {
      state.playlist.currentIndex = -1; // Reset index
      clearMediaDisplay(); // Clear the media view
      updateActiveHighlight(null); // Remove any active highlights
    }

    state.playlist.playedInShuffle.clear(); // Clear shuffle history
    updatePlaylistUI(); // Update UI (e.g., play button to "Play All")
  };

  const clearMediaDisplay = () => {
    try {
      clearPlaybackTimers(); // Stop any image timers
      // Iterate and remove children, ensuring video/audio elements are handled
      while (state.dom.mediaContainer.firstChild) {
        const el = state.dom.mediaContainer.firstChild;
        if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) {
          el.pause();
          el.removeAttribute('src'); // Important to release file handles
          if (typeof el.load === 'function') {
            try { el.load(); } catch(e) { /* ignore errors on load after src removal */ }
          }
          // Consider revoking object URLs if they were created specifically for this element
          // if (el.src.startsWith('blob:') && el.isTempBlob) URL.revokeObjectURL(el.src);
        }
        state.dom.mediaContainer.removeChild(el);
      }
    } catch (e) {
      console.error("Error clearing media display:", e);
      // Fallback: forcefully clear innerHTML if specific removal fails
      if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = '';
    }
  };

  const deleteMedia = (id) => {
    const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id);
    if (indexInLibrary === -1) return; // Not found

    const mediaToDelete = state.mediaLibrary[indexInLibrary];

    // Revoke Object URL to free up resources
    if (mediaToDelete.url && mediaToDelete.url.startsWith('blob:')) {
      URL.revokeObjectURL(mediaToDelete.url);
    }
    // Also revoke thumbnail if it's a blob URL (e.g., for videos)
    if (mediaToDelete.thumbnail && mediaToDelete.thumbnail.startsWith('blob:')) {
      URL.revokeObjectURL(mediaToDelete.thumbnail);
    }

    state.mediaLibrary.splice(indexInLibrary, 1); // Remove from library

    let wasPlayingDeletedItem = false;
    let deletedItemOriginalPlaylistIndex = -1;

    // Remove all instances from playlist
    for (let i = state.playlist.items.length - 1; i >= 0; i--) {
      if (state.playlist.items[i] === id) {
        if (state.playlist.isPlaying && i === state.playlist.currentIndex) {
          wasPlayingDeletedItem = true;
          deletedItemOriginalPlaylistIndex = i; // Store the index before splicing
        }
        state.playlist.items.splice(i, 1);
        // Adjust current index if an item before it was removed
        if (i < state.playlist.currentIndex) {
          state.playlist.currentIndex--;
        }
      }
    }

    // Handle playback if the deleted item was playing
    if (wasPlayingDeletedItem) {
      if (state.playlist.items.length > 0) {
        // Try to play the item that is now at the deleted item's original index,
        // or the last item if the original index is now out of bounds.
        const nextIndexToPlay = Math.min(deletedItemOriginalPlaylistIndex, state.playlist.items.length - 1);
        state.playlist.currentIndex = nextIndexToPlay; // Set current index before playing
        playMediaByIndex(nextIndexToPlay);
      } else {
        stopPlaylist(); // Playlist is now empty
      }
    } else if (state.playlist.currentIndex >= state.playlist.items.length && state.playlist.items.length > 0) {
      // If current index is out of bounds (e.g. last item was deleted but wasn't playing), adjust
      state.playlist.currentIndex = state.playlist.items.length - 1;
    } else if (state.playlist.items.length === 0) {
      state.playlist.currentIndex = -1; // Playlist became empty
      stopPlaylist();
    }


    // Clear media display if it's showing the deleted item from a library play
    const currentMediaElement = state.dom.mediaContainer.querySelector('img, video');
    if (currentMediaElement && currentMediaElement.src === mediaToDelete.url) {
      clearMediaDisplay();
      updateActiveHighlight(null); // Clear highlight as the active item is gone
    }

    // If library is empty, also clear playlist and stop
    if (state.mediaLibrary.length === 0) {
      clearPlaylist(); // This will also call stopPlaylist
    } else {
      updatePlaylistUI(); // Update playlist UI regardless
    }

    updateMediaGallery();
    saveMediaList();
    showNotification(`Removed: ${mediaToDelete.name}`, 'info');
    clearSelection(); // Clear selection as deleted items are no longer selectable
  };

  // UI Update Functions (Playlist, Active Highlight)
  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer;
    const emptyState = document.getElementById('playlist-empty-state');
    const controlsContainer = state.dom.playlistControlsContainer;

    if (!playlistContainer || !controlsContainer) {
      console.error("Playlist UI elements not found, cannot update.");
      return;
    }

    // Clear existing playlist items (but not the empty state message itself)
    Array.from(playlistContainer.querySelectorAll('.playlist-item')).forEach(child => child.remove());

    if (state.playlist.items.length === 0) {
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'Drag media here or from library to create a playlist.';
      }
      controlsContainer.style.visibility = 'hidden'; // Hide controls
    } else {
      if (emptyState) emptyState.style.display = 'none'; // Hide empty state
      controlsContainer.style.visibility = 'visible'; // Show controls

      // Add playlist items to UI
      state.playlist.items.forEach((mediaId, index) => {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) {
          playlistContainer.appendChild(createPlaylistItem(media, index));
        } else {
          // Handle case where mediaId in playlist doesn't exist in library (e.g. data inconsistency)
          console.warn(`Media with ID ${mediaId} found in playlist but not in library. Removing from playlist.`);
          // This should ideally not happen if data is consistent. Consider removing it here.
          // state.playlist.items.splice(index, 1); // Be careful with modifying array while iterating
        }
      });
    }

    // Update control button states (Shuffle, Play/Pause)
    const shuffleButton = document.getElementById('playlist-shuffle-button');
    if (shuffleButton) {
      shuffleButton.classList.toggle('active', state.playlist.shuffle);
      shuffleButton.innerHTML = state.playlist.shuffle
          ? '<span style="filter: grayscale(0%); color: var(--primary-color);">🔀</span> Shuffle On' // Visual cue for active
          : '<span style="filter: grayscale(100%);">🔀</span> Shuffle Off';
    }

    const playButton = document.getElementById('playlist-play-button');
    if (playButton) {
      playButton.innerHTML = state.playlist.isPlaying
          ? '<span style="filter: grayscale(100%);">⏸</span> Pause'
          : '<span style="filter: grayscale(100%);">▶</span> Play All';
    }

    // Re-apply active highlight if necessary for playlist items
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'playlist') {
      updateActiveHighlight(state.activeHighlight.mediaId, 'playlist');
    }
  };

  const createPlaylistItem = (media, index) => {
    const item = createUIElement('div', {
      className: 'playlist-item',
      attributes: { 'data-id': media.id, 'data-index': index.toString(), draggable: 'true' }
    });

    // Add 'current' class if this item is the currently playing/selected one in playlist
    if (index === state.playlist.currentIndex) {
      item.classList.add('current');
    }

    // Highlight ring (initially hidden, shown by updateActiveHighlight)
    const highlightRing = createUIElement('div', { className: 'media-active-highlight-ring' });
    item.appendChild(highlightRing);

    // Drag handlers for reordering
    item.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'playlist-reorder', id: media.id, index: index
      }));
      e.dataTransfer.effectAllowed = 'move';
      this.classList.add('dragging'); // Visual feedback
    });
    item.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      // Clear any drag-over visual cues from other items
      document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom')
          .forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
    });

    // Drag over handlers for visual feedback on potential drop location
    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move'; // Indicate a move operation is possible
      const rect = this.getBoundingClientRect();
      const isOverTopHalf = e.clientY < rect.top + rect.height / 2;
      // Remove previous indicators before adding new one
      document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom')
          .forEach(i => { if (i !== this) i.classList.remove('drag-over-top', 'drag-over-bottom'); });
      this.classList.toggle('drag-over-top', isOverTopHalf);
      this.classList.toggle('drag-over-bottom', !isOverTopHalf);
    });
    item.addEventListener('dragleave', function() {
      this.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    // Drop handler for reordering
    item.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation(); // Prevent event from bubbling to parent playlist container
      this.classList.remove('drag-over-top', 'drag-over-bottom');

      try {
        const dataText = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        if (!dataText) return;

        let droppedData;
        try { droppedData = JSON.parse(dataText); } catch (err) {
          // If parsing fails, assume it's a single media ID from library
          const droppedMediaId = dataText;
          if (state.mediaLibrary.find(m => m.id === droppedMediaId)) {
            const targetIndexDrop = parseInt(this.dataset.index || '0');
            const rect = this.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
            const insertAtIndex = isDroppedOnTopHalf ? targetIndexDrop : targetIndexDrop + 1;
            addToPlaylist(droppedMediaId, insertAtIndex);
          }
          return;
        }

        if (droppedData?.type === 'playlist-reorder') {
          const fromIndex = parseInt(droppedData.index);
          let toIndexDrop = parseInt(this.dataset.index || '0');
          const rect = this.getBoundingClientRect();
          const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;

          if (!isDroppedOnTopHalf) toIndexDrop++; // If dropped on bottom half, insert after
          if (fromIndex < toIndexDrop) toIndexDrop--; // Adjust if moving downwards past original spot

          reorderPlaylistItem(fromIndex, toIndexDrop);

        } else if (droppedData?.type === 'multiple-media' && Array.isArray(droppedData.ids)) {
          const targetIndexDrop = parseInt(this.dataset.index || '0');
          const rect = this.getBoundingClientRect();
          const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
          let insertAtIndex = isDroppedOnTopHalf ? targetIndexDrop : targetIndexDrop + 1;

          droppedData.ids.reverse().forEach(id => addToPlaylist(id, insertAtIndex));
          showNotification(`Added ${droppedData.ids.length} items to playlist.`, 'success');
        }
      } catch (err) {
        console.error('Error during playlist item drop handling:', err);
        showNotification('Error processing dropped item.', 'error');
      }
    });

    // Thumbnail image
    const thumbnailDiv = createUIElement('div', {
      className: 'playlist-item-thumbnail',
      style: media.thumbnail ? { backgroundImage: `url(${media.thumbnail})` } : { backgroundColor: '#333' }
    });
    if (!media.thumbnail) thumbnailDiv.textContent = media.type.charAt(0).toUpperCase(); // Fallback text
    item.appendChild(thumbnailDiv);

    // Trim indicator for videos
    if (media.type === 'video' && media.trimSettings?.trimEnabled) {
      const originalDuration = media.settings.originalDuration;
      const isEffectivelyTrimmed = (media.trimSettings.startTime || 0) > 0.01 ||
          (typeof originalDuration === 'number' && originalDuration > 0 &&
              typeof media.trimSettings.endTime === 'number' &&
              Math.abs(media.trimSettings.endTime - originalDuration) > 0.01 &&
              media.trimSettings.endTime < originalDuration);
      if (isEffectivelyTrimmed) {
        const trimIndicator = createUIElement('div', {
          className: 'playlist-item-trim-indicator',
          innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">✂️</span>', // Scissor emoji
          title: `Trimmed: ${formatTime(media.trimSettings.startTime)} - ${formatTime(media.trimSettings.endTime)}`
        });
        thumbnailDiv.appendChild(trimIndicator); // Append to thumbnail
      }
    }

    // Info container (name, details)
    const infoContainer = createUIElement('div', { className: 'playlist-item-info' });
    const nameEl = createUIElement('div', { className: 'playlist-item-name', textContent: media.name });
    infoContainer.appendChild(nameEl);

    // Details (type, size, duration if trimmed)
    const detailsEl = createUIElement('div', { className: 'playlist-item-details' });
    let detailsText = `${media.type.charAt(0).toUpperCase() + media.type.slice(1)} · ${formatFileSize(media.size)}`;
    if (media.type === 'video' && media.trimSettings?.trimEnabled) {
      const duration = (media.trimSettings.endTime ?? 0) - (media.trimSettings.startTime ?? 0);
      if (duration > 0) detailsText += ` · Trimmed (${formatTime(duration)})`;
    } else if (media.type === 'video' && media.settings?.originalDuration) {
      detailsText += ` · ${formatTime(media.settings.originalDuration)}`;
    }
    detailsEl.textContent = detailsText;
    infoContainer.appendChild(detailsEl);
    item.appendChild(infoContainer);

    // Delete button for removing from playlist
    const deleteBtn = createUIElement('button', {
      className: 'btn btn-icon btn-danger playlist-item-delete',
      innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': `Remove ${media.name} from playlist` },
      events: { click: (e) => { e.stopPropagation(); removeFromPlaylist(index); }}
    });
    item.appendChild(deleteBtn);

    // Click handler for playing the item
    item.addEventListener('click', function(e) {
      if (e.target === deleteBtn || deleteBtn.contains(e.target)) return; // Ignore clicks on delete button

      if (state.playlist.isPlaying && state.playlist.currentIndex === index) {
        pausePlaylist(); // Pause if clicking the currently playing item
      } else {
        state.playlist.currentIndex = index; // Set as current
        playPlaylist(); // Start/resume playlist from this item
        updateActiveHighlight(media.id, 'playlist');
      }
    });

    // Playing indicator if this item is current and playlist is active
    if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
      const playingIndicator = createUIElement('div', {
        className: 'playlist-item-playing-indicator',
        innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>' // Play icon
      });
      thumbnailDiv.appendChild(playingIndicator); // Append to thumbnail
    }
    return item;
  };


  const updateActiveHighlight = (mediaId, sourceType) => {
    removeAllActiveHighlights(); // Clear previous highlights

    if (!mediaId) { // If no mediaId, clear current highlight state
      state.activeHighlight.mediaId = null;
      state.activeHighlight.sourceType = null;
      return;
    }

    state.activeHighlight.mediaId = mediaId;
    state.activeHighlight.sourceType = sourceType;

    const selector = sourceType === 'library'
        ? `.media-thumbnail[data-id="${mediaId}"]`
        : `.playlist-item[data-id="${mediaId}"]`; // Assumes playlist items also have data-id

    const container = sourceType === 'library'
        ? state.dom.mediaGallery
        : state.dom.playlistContainer;

    const element = container?.querySelector(selector);
    if (element) {
      element.classList.add('playing-from-here'); // Add class for highlight effect
      // Scroll into view if needed
      // element.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Can be disruptive, use with care
    }
  };

  const removeAllActiveHighlights = () => {
    document.querySelectorAll('.media-thumbnail.playing-from-here, .playlist-item.playing-from-here')
        .forEach(el => el.classList.remove('playing-from-here'));
    // Do not clear state.activeHighlight here, updateActiveHighlight will manage it.
  };

  // Storage Functions
  const saveMediaList = () => {
    try {
      // Map media library for storage, excluding blob URLs for thumbnail and main URL
      // We only store metadata; files need to be re-imported by path or similar mechanism in a real app.
      // For this browser-based version, we are re-creating blob URLs on load, so we don't save them.
      const mediaForStorage = state.mediaLibrary.map(media => {
        const { url, thumbnail, ...mediaMeta } = media; // Exclude URL and thumbnail from direct storage
        return {
          ...mediaMeta, // id, name, type, mimeType, size, dateAdded, settings, trimSettings
          // We are not storing actual file paths or data here, just metadata.
          // On load, user would need to re-select files for URLs to be regenerated.
          // This is a limitation of browser security and blob URL persistence.
        };
      });

      const storageData = {
        media: mediaForStorage, // Store only metadata
        playlist: {
          items: state.playlist.items, // Store IDs for playlist items
          shuffle: state.playlist.shuffle
        }
      };
      localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(storageData));
    } catch (e) {
      console.error('Failed to save media list:', e);
      showNotification('Error saving media library. Storage might be full.', 'error');
    }
  };

  const loadSavedMedia = () => {
    try {
      const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEY);
      if (!savedData) {
        // Check for and notify about old data if present
        const oldSavedData = localStorage.getItem(CONSTANTS.STORAGE_KEY_OLD);
        if (oldSavedData) {
          try {
            const oldParsedData = JSON.parse(oldSavedData);
            if (oldParsedData.media?.length > 0) {
              showNotification(
                  `Old library data found (${oldParsedData.media.length} items). Please re-import files for full functionality as old data cannot be automatically migrated.`,
                  'warning', 10000 // Longer duration for this important notice
              );
            }
            localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD); // Remove old key after checking
          } catch (oldParseError) {
            console.warn("Error parsing old saved data, removing it:", oldParseError);
            localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
          }
        }
        updateMediaGallery(); // Ensure gallery shows empty state if nothing loaded
        updatePlaylistUI();
        return;
      }

      const parsedData = JSON.parse(savedData);

      // IMPORTANT: Since we don't store blob URLs, the loaded media items will not have valid `url` or `thumbnail` properties.
      // The user will need to re-import the actual files. This version of the app simulates this by loading metadata only.
      // A real application would store file paths or use a persistent storage mechanism.
      if (parsedData.media && Array.isArray(parsedData.media)) {
        // state.mediaLibrary = parsedData.media; // This would load metadata but no playable URLs
        if (parsedData.media.length > 0) {
          showNotification(
              `Loaded metadata for ${parsedData.media.length} media entries. Please re-import the actual files to make them playable.`,
              'info', 7000 // Longer duration
          );
        }
      }

      if (parsedData.playlist) {
        // state.playlist.items = parsedData.playlist.items || []; // Restore playlist item IDs
        state.playlist.shuffle = parsedData.playlist.shuffle || false;
        // Filter playlist items to ensure they correspond to (meta)loaded media.
        // state.playlist.items = state.playlist.items.filter(itemId => state.mediaLibrary.some(m => m.id === itemId));
      }

      // Since files are not reloaded, clear the library and playlist to reflect they need re-importing.
      // This is a design choice for this browser-only demo.
      state.mediaLibrary = [];
      state.playlist.items = [];


      updateMediaGallery(); // Update UI based on (empty) loaded data
      updatePlaylistUI();

    } catch (e) {
      console.error('Failed to load or parse saved media data:', e);
      showNotification('Error loading saved media library. Data might be corrupted.', 'error');
      localStorage.removeItem(CONSTANTS.STORAGE_KEY); // Clear corrupted data
      // Also clear old key if it somehow caused an issue here
      localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
      updateMediaGallery();
      updatePlaylistUI();
    }
  };


  // Utility Functions
  const formatFileSize = (bytes) => {
    if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; // Added TB
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const showNotification = (message, type = 'info', duration = 3000) => { // Added duration parameter
    if (typeof WallpaperApp !== 'undefined' && typeof WallpaperApp.UI?.showNotification === 'function') {
      WallpaperApp.UI.showNotification(message, type, duration); // Pass duration
    } else {
      // Fallback console log if UI function not available
      console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`);
    }
  };

  const applyTemporaryHighlight = (element) => {
    if (!element) return;
    element.classList.add('pulse-highlight-effect');
    // Remove class after animation duration (defined in CSS)
    setTimeout(() => {
      element.classList.remove('pulse-highlight-effect');
    }, 1400); // Should match CSS animation duration for .pulse-highlight-effect
  };

  // Public API
  return {
    init,
    getCurrentPlaylist: () => JSON.parse(JSON.stringify(state.playlist)), // Return a copy
    getMediaLibrary: () => JSON.parse(JSON.stringify(state.mediaLibrary)), // Return a copy
    openMediaSettings: (mediaId) => { // Expose function to open settings externally
      const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (media) openMediaSettingsDialog(media);
      else showNotification(`Media item with ID ${mediaId} not found.`, 'warning');
    },
    // For debugging or advanced integration:
    _getState: () => state // Expose internal state for debugging (use with caution)
  };
})();

// Initialize the module when the script loads
MediaModule.init();

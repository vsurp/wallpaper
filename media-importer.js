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
    STORAGE_KEY_OLD: 'flStudioWallpaper_media_v2'
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
      setTimeout(initMediaImporter, 1000);
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
      console.error('Required DOM elements not found for MediaModule');
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

  // UI Creation Helper Functions
  const createUIElement = (tag, options = {}) => {
    const element = document.createElement(tag);

    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;
    if (options.textContent) element.textContent = options.textContent;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.type) element.type = options.type;
    if (options.accept) element.accept = options.accept;
    if (options.multiple) element.multiple = options.multiple;

    if (options.style) {
      Object.assign(element.style, options.style);
    }

    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

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
    setupGalleryDragSelection(gallery);

    const emptyState = createUIElement('div', {
      id: 'media-empty-state',
      textContent: ''
    });

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
        x: e.clientX - galleryRect.left,
        y: e.clientY - galleryRect.top
      };

      // Create selection box
      if (state.selection.selectionBoxElement) {
        state.selection.selectionBoxElement.remove();
      }

      state.selection.selectionBoxElement = createUIElement('div', {
        className: 'selection-box',
        style: {
          left: state.selection.startPoint.x + gallery.scrollLeft + 'px',
          top: state.selection.startPoint.y + gallery.scrollTop + 'px',
          width: '0px',
          height: '0px'
        }
      });

      gallery.appendChild(state.selection.selectionBoxElement);

      if (!state.selection.shiftKeyActive) {
        clearSelection();
      }

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isSelecting || !state.selection.selectionBoxElement || !galleryRect) return;

      const currentX = e.clientX - galleryRect.left;
      const currentY = e.clientY - galleryRect.top;

      const x1 = Math.min(state.selection.startPoint.x, currentX);
      const y1 = Math.min(state.selection.startPoint.y, currentY);
      const x2 = Math.max(state.selection.startPoint.x, currentX);
      const y2 = Math.max(state.selection.startPoint.y, currentY);

      // Update selection box
      state.selection.selectionBoxElement.style.left = x1 + gallery.scrollLeft + 'px';
      state.selection.selectionBoxElement.style.top = y1 + gallery.scrollTop + 'px';
      state.selection.selectionBoxElement.style.width = (x2 - x1) + 'px';
      state.selection.selectionBoxElement.style.height = (y2 - y1) + 'px';

      // Check for intersections
      const selectionRect = {
        left: x1 + galleryRect.left,
        top: y1 + galleryRect.top,
        right: x2 + galleryRect.left,
        bottom: y2 + galleryRect.top
      };

      gallery.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
        const thumbnailRect = thumbnail.getBoundingClientRect();
        const mediaId = thumbnail.dataset.id;

        const intersects = !(
            thumbnailRect.right < selectionRect.left ||
            thumbnailRect.left > selectionRect.right ||
            thumbnailRect.bottom < selectionRect.top ||
            thumbnailRect.top > selectionRect.bottom
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

    document.addEventListener('mouseup', (e) => {
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
      id: 'effects-quick-nav-button',
      textContent: 'EFFECTS',
      className: 'quick-nav-button btn btn-secondary',
      events: {
        click: () => {
          if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
            window.WallpaperApp.MenuTools.openL2Submenu('effects-list-submenu');
            applyTemporaryHighlight(state.dom.mediaLibrarySection);
          } else {
            showNotification('Menu function not available.', 'warning');
          }
        }
      }
    });

    const transitionsButton = createUIElement('button', {
      id: 'transitions-quick-nav-button',
      textContent: 'TRANSITIONS',
      className: 'quick-nav-button btn btn-secondary',
      events: {
        click: () => {
          if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
            window.WallpaperApp.MenuTools.openL2Submenu('transitions-list-submenu');
            applyTemporaryHighlight(state.dom.playlistSection);
          } else {
            showNotification('Menu function not available.', 'warning');
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

    const playlistContainer = createUIElement('div', {
      id: 'playlist-container',
      events: {
        dragover: handlePlaylistDragOver,
        drop: handlePlaylistDrop,
        dragenter: (e) => {
          e.preventDefault();
          playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)';
        },
        dragleave: (e) => {
          e.preventDefault();
          playlistContainer.style.backgroundColor = '';
        }
      }
    });

    const emptyState = createUIElement('div', {
      id: 'playlist-empty-state',
      textContent: 'Drag media here to create playlist'
    });

    playlistContainer.appendChild(emptyState);
    section.appendChild(title);
    section.appendChild(playlistContainer);

    state.dom.playlistContainer = playlistContainer;

    const controlsContainer = createUIElement('div', {
      id: 'playlist-controls',
      style: { visibility: 'hidden' }
    });

    state.dom.playlistControlsContainer = controlsContainer;
    createPlaylistControls(controlsContainer);
    section.appendChild(controlsContainer);

    return section;
  };

  const createPlaylistControls = (controlsContainer) => {
    controlsContainer.innerHTML = '';

    const buttons = [
      {
        id: 'playlist-play-button',
        html: '<span style="filter: grayscale(100%);">▶</span> Play All',
        handler: playPlaylist,
        class: 'btn-primary'
      },
      {
        id: 'playlist-shuffle-button',
        html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle',
        handler: toggleShuffle,
        class: 'btn-secondary'
      },
      {
        id: 'playlist-clear-button',
        html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist',
        handler: clearPlaylist,
        class: 'btn-danger'
      }
    ];

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
  const handleFileSelect = (files) => {
    if (!files || files.length === 0) return;

    let validCount = 0;
    let invalidCount = 0;

    Array.from(files).forEach(file => {
      if (isFileSupported(file.type)) {
        processFile(file);
        validCount++;
      } else {
        invalidCount++;
      }
    });

    if (validCount > 0) {
      showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}`, 'success');
    }

    if (invalidCount > 0) {
      showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} not supported`, 'warning');
    }

    updateMediaGallery();
    updatePlaylistUI();
    saveMediaList();
  };

  const isFileSupported = (type) => {
    return CONSTANTS.SUPPORTED_TYPES.video.includes(type) ||
        CONSTANTS.SUPPORTED_TYPES.image.includes(type);
  };

  const processFile = (file) => {
    const id = generateMediaId();
    const url = URL.createObjectURL(file);
    const type = CONSTANTS.SUPPORTED_TYPES.video.includes(file.type) ? 'video' : 'image';

    const mediaItem = {
      id,
      name: file.name,
      type,
      mimeType: file.type,
      size: file.size,
      url,
      dateAdded: Date.now(),
      thumbnail: null,
      settings: {
        volume: 0,
        playbackRate: 1,
        originalDuration: null
      },
      trimSettings: type === 'video' ? {
        trimEnabled: false,
        startTime: 0,
        endTime: null
      } : null
    };

    // Add to library immediately
    state.mediaLibrary.push(mediaItem);

    // Generate thumbnail asynchronously
    generateThumbnail(mediaItem, file).then(thumbnail => {
      mediaItem.thumbnail = thumbnail;
      updateMediaGallery();
    }).catch(err => {
      console.warn("Error generating thumbnail:", err);
      mediaItem.thumbnail = createFallbackThumbnail();
      updateMediaGallery();
    });

    // Get video duration asynchronously if it's a video
    if (type === 'video') {
      getVideoDuration(mediaItem.url).then(duration => {
        mediaItem.settings.originalDuration = duration;
        if (mediaItem.trimSettings && duration > 0) {
          mediaItem.trimSettings.endTime = duration;
        } else if (mediaItem.trimSettings) {
          mediaItem.trimSettings.endTime = 0;
        }
        updateMediaGallery();
        saveMediaList();
      }).catch(err => {
        console.warn("Error getting video duration:", err);
        mediaItem.settings.originalDuration = 0;
        if (mediaItem.trimSettings) {
          mediaItem.trimSettings.endTime = 0;
        }
        updateMediaGallery();
        saveMediaList();
      });
    } else {
      updateMediaGallery();
      saveMediaList();
    }
  };

  const generateMediaId = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  };

  const getVideoDuration = (videoUrl) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      const cleanup = () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
      };

      video.onloadedmetadata = function() {
        const duration = video.duration;
        if (typeof duration === 'number' && !isNaN(duration) && duration > 0) {
          resolve(duration);
        } else {
          console.warn(`Invalid duration for video: ${duration}`);
          resolve(0);
        }
        cleanup();
      };

      video.onerror = function(e) {
        console.warn("Error loading video metadata - falling back to default duration");
        resolve(0);
        cleanup();
      };

      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        console.warn("Timeout loading video metadata");
        resolve(0);
        cleanup();
      }, 5000);

      // Set video source
      try {
        video.src = videoUrl;
      } catch (e) {
        console.warn("Error setting video source:", e);
        resolve(0);
        clearTimeout(timeoutId);
        cleanup();
      }
    });
  };

  const generateThumbnail = (mediaItem, file) => {
    return new Promise(resolve => {
      if (mediaItem.type === 'image') {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      } else if (mediaItem.type === 'video') {
        generateVideoThumbnail(mediaItem.url, mediaItem.name).then(resolve);
      }
    });
  };

  const generateVideoThumbnail = (videoUrl, videoName) => {
    return new Promise(resolve => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;

      let thumbnailGenerated = false;

      const generateThumbnailFromVideo = () => {
        if (thumbnailGenerated) return;
        thumbnailGenerated = true;

        try {
          const canvas = document.createElement('canvas');
          canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width;
          canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
          const ctx = canvas.getContext('2d');

          // Fill background first
          ctx.fillStyle = '#1A1A1A';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Check if video has valid dimensions
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const videoAspectRatio = video.videoWidth / video.videoHeight;
            const canvasAspectRatio = canvas.width / canvas.height;

            let drawWidth = canvas.width;
            let drawHeight = canvas.height;
            let offsetX = 0;
            let offsetY = 0;

            if (videoAspectRatio > canvasAspectRatio) {
              drawHeight = canvas.width / videoAspectRatio;
              offsetY = (canvas.height - drawHeight) / 2;
            } else {
              drawWidth = canvas.height * videoAspectRatio;
              offsetX = (canvas.width - drawWidth) / 2;
            }

            try {
              ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
            } catch (drawError) {
              console.warn("Error drawing video frame:", drawError);
            }
          }

          // Draw play button overlay
          drawPlayButton(ctx, canvas.width, canvas.height);

          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.6);

          // Clean up only the temporary video element
          video.pause();
          video.removeAttribute('src');
          video.load();

          resolve(thumbnailUrl);
        } catch (err) {
          console.warn("Error generating thumbnail canvas:", err);
          resolve(createFallbackThumbnail());
        }
      };

      // Set up event handlers
      video.onloadedmetadata = function() {
        if (video.duration && !isNaN(video.duration) && video.duration > 0) {
          // Seek to a frame
          try {
            video.currentTime = Math.min(1.0, video.duration / 3);
          } catch (e) {
            generateThumbnailFromVideo();
          }
        } else {
          generateThumbnailFromVideo();
        }
      };

      video.onseeked = function() {
        generateThumbnailFromVideo();
      };

      video.onerror = function(e) {
        console.warn("Error loading video for thumbnail:", videoName);
        resolve(createFallbackThumbnail());
      };

      // Timeout fallback
      const timeoutId = setTimeout(() => {
        if (!thumbnailGenerated) {
          console.warn("Thumbnail generation timeout for:", videoName);
          generateThumbnailFromVideo();
        }
      }, 5000);

      // Set video source
      try {
        video.src = videoUrl;
      } catch (e) {
        console.warn("Error setting video source:", e);
        resolve(createFallbackThumbnail());
      }
    });
  };

  const drawPlayButton = (ctx, width, height) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const centerX = width / 2;
    const centerY = height / 2;
    const triangleSize = Math.min(width, height) * 0.2;

    ctx.beginPath();
    ctx.moveTo(centerX - triangleSize / 2, centerY - triangleSize * 0.866 / 2);
    ctx.lineTo(centerX - triangleSize / 2, centerY + triangleSize * 0.866 / 2);
    ctx.lineTo(centerX + triangleSize / 2, centerY);
    ctx.closePath();
    ctx.fill();
  };

  // UI Update Functions
  const updateMediaGallery = () => {
    const gallery = state.dom.mediaGallery;
    const emptyState = document.getElementById('media-empty-state');

    if (!gallery) return;

    if (emptyState) {
      emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
    }

    // Clear existing content except empty state
    Array.from(gallery.children).forEach(child => {
      if (child.id !== 'media-empty-state') {
        child.remove();
      }
    });

    // Add media thumbnails
    state.mediaLibrary.forEach(media => {
      gallery.appendChild(createMediaThumbnail(media));
    });

    updateMediaSelectionUI();

    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'library') {
      updateActiveHighlight(state.activeHighlight.mediaId, 'library');
    }
  };

  const createMediaThumbnail = (media) => {
    const thumbnail = createUIElement('div', {
      className: 'media-thumbnail',
      attributes: { 'data-id': media.id, draggable: 'true' }
    });

    // Add highlight ring
    const highlightRing = createUIElement('div', {
      className: 'media-active-highlight-ring'
    });
    thumbnail.appendChild(highlightRing);

    // Setup drag handlers
    thumbnail.addEventListener('dragstart', (e) => {
      if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'multiple-media',
          ids: Array.from(state.selection.items)
        }));
      } else {
        e.dataTransfer.setData('text/plain', media.id);
      }
      e.dataTransfer.effectAllowed = 'copy';
    });

    // Image container
    const imgContainer = createUIElement('div', {
      className: 'media-thumbnail-img-container',
      style: media.thumbnail ? {
        backgroundImage: `url(${media.thumbnail})`
      } : {
        backgroundColor: '#333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        color: 'white'
      }
    });

    if (!media.thumbnail) {
      imgContainer.textContent = media.type.charAt(0).toUpperCase();
    }

    thumbnail.appendChild(imgContainer);

    // Name label
    const nameLabel = createUIElement('div', {
      className: 'media-thumbnail-name',
      textContent: media.name
    });
    thumbnail.appendChild(nameLabel);

    // Type badge
    const badge = createUIElement('div', {
      className: 'media-type-badge',
      textContent: media.type.toUpperCase()
    });
    thumbnail.appendChild(badge);

    // Settings button
    const settingsBtn = createUIElement('button', {
      className: 'media-settings-btn btn btn-icon',
      innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17-.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>',
      attributes: { 'aria-label': 'Clip settings' },
      events: {
        click: (e) => {
          e.stopPropagation();
          openMediaSettingsDialog(media);
        }
      }
    });
    thumbnail.appendChild(settingsBtn);

    // Delete button
    const deleteBtn = createUIElement('button', {
      className: 'media-delete-btn btn btn-icon btn-danger',
      innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': 'Delete clip' },
      events: {
        click: (e) => {
          e.stopPropagation();
          if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
            if (confirm(`Delete ${state.selection.items.size} selected clips?`)) {
              Array.from(state.selection.items).forEach(id => deleteMedia(id));
            }
          } else {
            deleteMedia(media.id);
          }
        }
      }
    });
    thumbnail.appendChild(deleteBtn);

    // Tooltip and click handler
    thumbnail.setAttribute('data-tooltip', media.name);
    thumbnail.addEventListener('click', (e) => {
      handleThumbnailClick(e, media);
    });

    return thumbnail;
  };

  // Selection Management
  const handleThumbnailClick = (e, media) => {
    const settingsBtn = e.currentTarget.querySelector('.media-settings-btn');
    const deleteBtn = e.currentTarget.querySelector('.media-delete-btn');

    if (e.target === settingsBtn || settingsBtn.contains(e.target) ||
        e.target === deleteBtn || deleteBtn.contains(e.target)) {
      return;
    }

    if (state.selection.shiftKeyActive && state.selection.lastSelected) {
      selectRange(state.selection.lastSelected, media.id);
    } else if (state.selection.shiftKeyActive) {
      clearSelection();
      addToSelection(media.id);
      state.selection.lastSelected = media.id;
      updateMediaSelectionUI();
    } else if (state.selection.items.size > 0 &&
        state.selection.items.has(media.id) &&
        !state.selection.shiftKeyActive) {
      clearSelection();
      addToSelection(media.id);
      state.selection.lastSelected = media.id;
      updateMediaSelectionUI();
      selectMedia(media, true);
    } else {
      clearSelection();
      addToSelection(media.id);
      state.selection.lastSelected = media.id;
      updateMediaSelectionUI();
      selectMedia(media, true);
    }
  };

  const clearSelection = () => {
    state.selection.items.clear();
    state.selection.lastSelected = null;
    updateMediaSelectionUI();
  };

  const addToSelection = (mediaId) => {
    state.selection.items.add(mediaId);
  };

  const removeFromSelection = (mediaId) => {
    state.selection.items.delete(mediaId);
  };

  const toggleSelection = (mediaId) => {
    if (state.selection.items.has(mediaId)) {
      state.selection.items.delete(mediaId);
    } else {
      state.selection.items.add(mediaId);
    }
    updateMediaSelectionUI();
  };

  const selectRange = (startId, endId) => {
    const startIndex = state.mediaLibrary.findIndex(m => m.id === startId);
    const endIndex = state.mediaLibrary.findIndex(m => m.id === endId);

    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    for (let i = minIndex; i <= maxIndex; i++) {
      addToSelection(state.mediaLibrary[i].id);
    }

    updateMediaSelectionUI();
  };

  const updateMediaSelectionUI = () => {
    state.dom.mediaGallery.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
      thumbnail.classList.toggle('selected', state.selection.items.has(thumbnail.dataset.id));
    });
  };

  // Media Settings Dialog
  const openMediaSettingsDialog = (media) => {
    // Remove existing dialog if any
    const existingDialog = document.getElementById('media-settings-dialog-backdrop');
    if (existingDialog) {
      existingDialog.remove();
    }

    const backdrop = createUIElement('div', {
      id: 'media-settings-dialog-backdrop',
      className: 'media-settings-dialog-backdrop acrylic acrylic-dark'
    });

    const dialog = createUIElement('div', {
      id: 'media-settings-dialog',
      className: 'media-settings-dialog'
    });

    // Show animation
    setTimeout(() => {
      dialog.classList.add('open');
      backdrop.classList.add('open');
    }, 10);

    // Create dialog content
    createDialogContent(dialog, media, backdrop);

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Focus first input
    const firstInput = dialog.querySelector('input');
    if (firstInput) firstInput.focus();
  };

  const createDialogContent = (dialog, media, backdrop) => {
    // Header
    const header = createUIElement('div', {
      className: 'media-settings-dialog-header'
    });

    const title = createUIElement('h3', {
      textContent: `Settings: ${media.name}`
    });

    const closeBtn = createUIElement('button', {
      className: 'btn btn-icon dialog-close-btn',
      innerHTML: '&times;',
      attributes: { 'aria-label': 'Close settings' },
      events: {
        click: () => closeDialog(dialog, backdrop)
      }
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    // Body
    const body = createUIElement('div', {
      className: 'media-settings-dialog-body'
    });

    // Settings tooltip
    const settingsTooltip = createUIElement('div', {
      className: 'settings-tooltip',
      textContent: 'Settings apply to playback from library and playlist'
    });
    body.appendChild(settingsTooltip);

    // Name input
    const nameGroup = createFormGroup('Clip Name:', 'text', media.name, `media-name-${media.id}`);
    body.appendChild(nameGroup);

    // Video-specific settings
    if (media.type === 'video') {
      createVideoSettings(body, media);
    }

    // Navigation buttons
    const navButtonsContainer = createUIElement('div', {
      style: {
        display: 'flex',
        gap: '10px',
        marginTop: '20px'
      }
    });

    const effectsLink = createUIElement('button', {
      textContent: 'EFFECTS',
      className: 'btn btn-secondary setting-btn',
      style: { flex: '1' },
      events: {
        click: () => {
          closeBtn.click();
          document.getElementById('effects-quick-nav-button')?.click();
        }
      }
    });

    const transitionsLink = createUIElement('button', {
      textContent: 'TRANSITIONS',
      className: 'btn btn-secondary setting-btn',
      style: { flex: '1' },
      events: {
        click: () => {
          closeBtn.click();
          document.getElementById('transitions-quick-nav-button')?.click();
        }
      }
    });

    navButtonsContainer.appendChild(effectsLink);
    navButtonsContainer.appendChild(transitionsLink);
    body.appendChild(navButtonsContainer);

    dialog.appendChild(body);

    // Footer
    const footer = createUIElement('div', {
      className: 'media-settings-dialog-footer'
    });

    const saveBtn = createUIElement('button', {
      className: 'btn btn-primary',
      textContent: 'Save Changes',
      events: {
        click: () => saveMediaSettings(media, dialog, backdrop)
      }
    });

    const cancelBtn = createUIElement('button', {
      className: 'btn btn-secondary',
      textContent: 'Cancel',
      events: {
        click: () => closeBtn.click()
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    dialog.appendChild(footer);
  };

  const createFormGroup = (labelText, inputType, inputValue, inputId) => {
    const group = createUIElement('div', { className: 'form-group' });

    const label = createUIElement('label', {
      htmlFor: inputId,
      textContent: labelText
    });

    const input = createUIElement('input', {
      type: inputType,
      id: inputId,
      value: inputValue
    });

    group.appendChild(label);
    group.appendChild(input);

    return group;
  };

  const createVideoSettings = (body, media) => {
    // Video preview and trim settings
    const trimGroup = createUIElement('div', { className: 'form-group' });
    const trimLabel = createUIElement('label', { textContent: 'Trim Video:' });
    trimGroup.appendChild(trimLabel);

    // Video preview
    const videoPreview = createUIElement('video', {
      src: media.url,
      controls: true,
      muted: !(media.settings?.volume > 0),
      style: {
        width: '100%',
        marginBottom: '10px',
        backgroundColor: '#000',
        borderRadius: '4px'
      }
    });

    let videoDuration = media.settings?.originalDuration || 0;
    let currentTrimSettings = JSON.parse(JSON.stringify(media.trimSettings || {
      trimEnabled: false,
      startTime: 0,
      endTime: videoDuration
    }));

    videoPreview.onloadedmetadata = function() {
      const duration = videoPreview.duration;
      if (typeof duration === 'number' && !isNaN(duration) && duration > 0) {
        videoDuration = duration;
        if (!media.settings.originalDuration || media.settings.originalDuration <= 0) {
          media.settings.originalDuration = videoDuration;
        }
        if (currentTrimSettings.endTime === null ||
            currentTrimSettings.endTime > videoDuration ||
            currentTrimSettings.endTime <= 0) {
          currentTrimSettings.endTime = videoDuration;
        }
      }
      videoPreview.currentTime = currentTrimSettings.startTime || 0;
      updateTrimUI();
    };

    trimGroup.appendChild(videoPreview);

    // Trim controls
    const trimDescription = createUIElement('div', {
      className: 'trim-description',
      textContent: 'Adjust start and end points using sliders:'
    });
    trimGroup.appendChild(trimDescription);

    const trimContainer = createUIElement('div');

    // Start time control
    const startTimeGroup = createTrimControl('Start Point:', `trim-start-${media.id}`, (value) => {
      if (videoDuration <= 0) return;
      const percent = parseFloat(value) / 100;
      currentTrimSettings.startTime = percent * videoDuration;
      if (currentTrimSettings.startTime >= currentTrimSettings.endTime) {
        currentTrimSettings.startTime = Math.max(0, currentTrimSettings.endTime - 0.1);
      }
      videoPreview.currentTime = currentTrimSettings.startTime;
      updateTrimUI();
      currentTrimSettings.trimEnabled = true;
    });

    // End time control
    const endTimeGroup = createTrimControl('End Point:', `trim-end-${media.id}`, (value) => {
      if (videoDuration <= 0) return;
      const percent = parseFloat(value) / 100;
      currentTrimSettings.endTime = percent * videoDuration;
      if (currentTrimSettings.endTime <= currentTrimSettings.startTime) {
        currentTrimSettings.endTime = Math.min(videoDuration, currentTrimSettings.startTime + 0.1);
      }
      videoPreview.currentTime = currentTrimSettings.endTime;
      updateTrimUI();
      currentTrimSettings.trimEnabled = true;
    });

    trimContainer.appendChild(startTimeGroup);
    trimContainer.appendChild(endTimeGroup);

    // Trim visualization
    const trimUIContainer = createUIElement('div', {
      style: {
        position: 'relative',
        height: '20px',
        backgroundColor: '#111',
        borderRadius: '4px',
        overflow: 'hidden',
        marginTop: '15px',
        marginBottom: '15px'
      }
    });

    const timeline = createUIElement('div', {
      style: {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: '#333'
      }
    });

    const trimRegion = createUIElement('div', {
      style: {
        position: 'absolute',
        top: '0',
        height: '100%',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.5)',
        borderLeft: '2px solid var(--primary-color)',
        borderRight: '2px solid var(--primary-color)',
        boxSizing: 'border-box'
      }
    });

    const timeDisplay = createUIElement('div', {
      style: {
        marginTop: '5px',
        fontSize: '12px',
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.7)'
      }
    });

    const updateTrimUI = () => {
      if (videoDuration <= 0 && videoPreview.duration > 0) {
        videoDuration = videoPreview.duration;
      }

      if (videoDuration <= 0) {
        const startInput = document.getElementById(`trim-start-${media.id}`);
        const endInput = document.getElementById(`trim-end-${media.id}`);
        if (startInput) startInput.value = 0;
        if (endInput) endInput.value = 100;
        timeDisplay.textContent = 'Waiting for video duration...';
        return;
      }

      const startVal = currentTrimSettings.startTime || 0;
      const endVal = currentTrimSettings.endTime || videoDuration;
      const startPercent = (startVal / videoDuration) * 100;
      const endPercent = (endVal / videoDuration) * 100;

      trimRegion.style.left = startPercent + '%';
      trimRegion.style.width = Math.max(0, endPercent - startPercent) + '%';

      timeDisplay.textContent = `Start: ${formatTime(startVal)} | End: ${formatTime(endVal)} | Duration: ${formatTime(Math.max(0, endVal - startVal))}`;

      const startInput = document.getElementById(`trim-start-${media.id}`);
      const endInput = document.getElementById(`trim-end-${media.id}`);
      const startDisplay = startTimeGroup.querySelector('span');
      const endDisplay = endTimeGroup.querySelector('span');

      if (startInput) startInput.value = startPercent;
      if (endInput) endInput.value = endPercent;
      if (startDisplay) startDisplay.textContent = formatTime(startVal);
      if (endDisplay) endDisplay.textContent = formatTime(endVal);
    };

    timeline.addEventListener('click', (e) => {
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

    // Add reference to updateTrimUI for event handlers
    body.updateTrimUI = updateTrimUI;

    // Volume control
    const volumeGroup = createSliderControl('Volume:', `media-volume-${media.id}`,
        media.settings?.volume ?? 0, 0, 1, 0.01, (value) => {
          videoPreview.volume = parseFloat(value);
          videoPreview.muted = parseFloat(value) === 0;
        }, (value) => `${Math.round(value * 100)}%`);
    body.appendChild(volumeGroup);

    // Playback speed control
    const rateGroup = createSliderControl('Playback Speed:', `media-rate-${media.id}`,
        media.settings?.playbackRate ?? 1, 0.25, 2, 0.25, (value) => {
          videoPreview.playbackRate = parseFloat(value);
        }, (value) => `${value}x`);
    body.appendChild(rateGroup);

    // Initial UI update
    if (videoDuration > 0) {
      updateTrimUI();
    }
  };

  const createTrimControl = (labelText, inputId, onInput) => {
    const group = createUIElement('div', {
      className: 'form-group',
      style: { marginBottom: '15px' }
    });

    const label = createUIElement('label', {
      htmlFor: inputId,
      textContent: labelText
    });

    const input = createUIElement('input', {
      type: 'range',
      id: inputId,
      min: '0',
      max: '100',
      step: '0.1',
      events: { input: (e) => onInput(e.target.value) }
    });

    const valueDisplay = createUIElement('span', {
      style: { marginLeft: '10px' }
    });

    group.appendChild(label);
    group.appendChild(input);
    group.appendChild(valueDisplay);

    return group;
  };

  const createSliderControl = (labelText, inputId, defaultValue, min, max, step, onInput, formatValue) => {
    const group = createUIElement('div', { className: 'form-group' });

    const label = createUIElement('label', {
      htmlFor: inputId,
      textContent: labelText
    });

    const input = createUIElement('input', {
      type: 'range',
      id: inputId,
      min: min.toString(),
      max: max.toString(),
      step: step.toString(),
      value: defaultValue.toString(),
      events: {
        input: (e) => {
          const value = e.target.value;
          valueDisplay.textContent = formatValue(value);
          if (onInput) onInput(value);
        }
      }
    });

    const valueDisplay = createUIElement('span', {
      textContent: formatValue(defaultValue)
    });

    group.appendChild(label);
    group.appendChild(input);
    group.appendChild(valueDisplay);

    return group;
  };

  const saveMediaSettings = (media, dialog, backdrop) => {
    // Get updated values
    media.name = document.getElementById(`media-name-${media.id}`).value;

    if (media.type === 'video') {
      if (!media.settings) media.settings = {};

      media.settings.volume = parseFloat(document.getElementById(`media-volume-${media.id}`).value);
      media.settings.playbackRate = parseFloat(document.getElementById(`media-rate-${media.id}`).value);

      // Get trim settings from the closure
      const body = dialog.querySelector('.media-settings-dialog-body');
      if (body.updateTrimUI) {
        // This is a bit of a hack, but we need to access the currentTrimSettings
        // In a real refactor, this would be handled differently
        const startInput = document.getElementById(`trim-start-${media.id}`);
        const endInput = document.getElementById(`trim-end-${media.id}`);

        if (startInput && endInput && media.trimSettings) {
          const videoDuration = media.settings.originalDuration || 0;
          const startPercent = parseFloat(startInput.value) / 100;
          const endPercent = parseFloat(endInput.value) / 100;

          media.trimSettings.startTime = startPercent * videoDuration;
          media.trimSettings.endTime = endPercent * videoDuration;

          // Check if actually trimmed
          const effectivelyTrimmed = (media.trimSettings.startTime > 0.01) ||
              (videoDuration &&
                  Math.abs(media.trimSettings.endTime - videoDuration) > 0.01 &&
                  media.trimSettings.endTime < videoDuration);

          media.trimSettings.trimEnabled = effectivelyTrimmed;
        }
      }
    }

    updateMediaGallery();
    updatePlaylistUI();
    saveMediaList();
    showNotification('Settings saved!', 'success');
    closeDialog(dialog, backdrop);
  };

  const closeDialog = (dialog, backdrop) => {
    dialog.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(() => backdrop.remove(), 300);
  };

  // Playlist Management
  const handlePlaylistDragOver = (e) => {
    e.preventDefault();
    const isReordering = e.dataTransfer.types.includes('application/json');
    const isAddingNew = e.dataTransfer.types.includes('text/plain');

    if (isReordering) {
      e.dataTransfer.dropEffect = 'move';
    } else if (isAddingNew) {
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
        if (jsonData?.type === 'multiple-media') {
          const { ids } = jsonData;
          if (Array.isArray(ids) && ids.length > 0) {
            ids.forEach(id => addToPlaylist(id, state.playlist.items.length));
            showNotification(`Added ${ids.length} items to playlist`, 'success');
          }
          return;
        } else if (jsonData?.type === 'playlist-reorder') {
          const fromIndex = parseInt(jsonData.index);
          if (!isNaN(fromIndex) && fromIndex >= 0 && fromIndex < state.playlist.items.length) {
            reorderPlaylistItem(fromIndex, state.playlist.items.length - 1);
          }
          return;
        }
      }

      const mediaId = e.dataTransfer.getData('text/plain');
      if (mediaId) {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) {
          addToPlaylist(mediaId, state.playlist.items.length);
        }
      }
    } catch (err) {
      console.error('Error in handlePlaylistDrop:', err);
    }
  };

  const addToPlaylist = (mediaId, insertAtIndex = -1) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) return;

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

    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);

    state.playlist.items.splice(index, 1);

    if (state.playlist.isPlaying) {
      if (index === state.playlist.currentIndex) {
        if (state.playlist.items.length > 0) {
          if (state.playlist.currentIndex >= state.playlist.items.length) {
            state.playlist.currentIndex = 0;
          }
          playMediaByIndex(state.playlist.currentIndex);
        } else {
          stopPlaylist();
        }
      } else if (index < state.playlist.currentIndex) {
        state.playlist.currentIndex--;
      }
    } else {
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
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length ||
        toIndex < 0 || toIndex > state.playlist.items.length ||
        fromIndex === toIndex) {
      return;
    }

    try {
      const itemToMove = state.playlist.items.splice(fromIndex, 1)[0];
      state.playlist.items.splice(toIndex, 0, itemToMove);

      // Update current index if needed
      if (state.playlist.currentIndex === fromIndex) {
        state.playlist.currentIndex = toIndex;
      } else if (state.playlist.currentIndex > fromIndex && state.playlist.currentIndex <= toIndex) {
        state.playlist.currentIndex--;
      } else if (state.playlist.currentIndex < fromIndex && state.playlist.currentIndex >= toIndex) {
        state.playlist.currentIndex++;
      }

      updatePlaylistUI();
      saveMediaList();
    } catch (e) {
      console.error('Error reordering playlist item:', e);
    }
  };

  const clearPlaylist = () => {
    try {
      stopPlaylist();
      state.playlist.items = [];
      state.playlist.currentIndex = -1;
      state.playlist.playedInShuffle.clear();
      updatePlaylistUI();
      saveMediaList();
      showNotification('Playlist cleared', 'info');
    } catch (e) {
      console.error('Error in clearPlaylist:', e);
    }
  };

  // Playback Functions
  const selectMedia = (media, loopSingle = false) => {
    stopPlaylist(false);
    clearMediaDisplay();

    const element = createMediaElement(media, !loopSingle, loopSingle);
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      showNotification(`Now playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');
      state.playlist.isPlaying = !loopSingle;

      if (loopSingle) {
        state.playlist.currentIndex = -1;
        updateActiveHighlight(media.id, 'library');
      } else {
        updateActiveHighlight(null);
      }

      updatePlaylistUI();
    }
  };

  const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
    let element;
    if (!media || !media.type) return null;

    const useTrim = media.type === 'video' && media.trimSettings?.trimEnabled;
    const trimSettings = media.trimSettings || {};
    const startTime = trimSettings.startTime || 0;
    const endTime = trimSettings.endTime;

    if (media.type === 'image') {
      element = createUIElement('img', {
        src: media.url,
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
          if (state.playlist.isPlaying) {
            playNextItem();
          }
        }, CONSTANTS.IMAGE_DISPLAY_DURATION);
      }
    } else if (media.type === 'video') {
      element = document.createElement('video');
      element.src = media.url;
      element.autoplay = true;
      element.loop = loopOverride;
      element.muted = (media.settings?.volume === 0) || (media.settings?.volume === undefined && !isPlaylistContext);
      element.volume = media.settings?.volume ?? (isPlaylistContext ? 0.5 : 0);
      element.playbackRate = media.settings?.playbackRate ?? 1;
      Object.assign(element.style, {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        top: '0',
        left: '0'
      });

      element.addEventListener('error', function(e) {
        console.error(`Error loading video: ${media.name}`, e);
        if (isPlaylistContext && state.playlist.isPlaying) {
          setTimeout(() => playNextItem(), 100);
        }
      });

      if (useTrim) {
        element.addEventListener('loadedmetadata', function() {
          if (typeof this.duration === 'number' && !isNaN(this.duration)) {
            this.currentTime = Math.max(0, Math.min(startTime, this.duration));
          }
        });

        element.addEventListener('timeupdate', function() {
          if (this.currentTime < (startTime - 0.1)) {
            this.currentTime = startTime;
          }

          if (typeof endTime === 'number' && this.currentTime >= endTime) {
            if (isPlaylistContext && state.playlist.isPlaying && !loopOverride) {
              playNextItem();
            } else if (loopOverride) {
              this.currentTime = startTime;
              this.play().catch(e => console.warn("Autoplay prevented on loop:", media.name, e));
            } else {
              this.pause();
            }
          }
        });
      }

      if (isPlaylistContext && !loopOverride && !useTrim) {
        element.addEventListener('ended', () => {
          if (state.playlist.isPlaying) {
            playNextItem();
          }
        });
      }
    }

    return element;
  };

  const playPlaylist = () => {
    if (state.playlist.items.length === 0) {
      showNotification('Playlist is empty.', 'info');
      return;
    }

    const playAllButton = document.getElementById('playlist-play-button');

    // Toggle pause if already playing
    if (state.playlist.isPlaying && playAllButton && playAllButton.innerHTML.includes('Pause')) {
      pausePlaylist();
      return;
    }

    clearPlaybackTimers();
    state.playlist.advancingInProgress = false;
    state.playlist.isPlaying = true;

    if (state.playlist.shuffle) {
      state.playlist.playedInShuffle.clear();
      state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length);
    } else {
      if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = 0;
      }
    }

    clearMediaDisplay();
    playMediaByIndex(state.playlist.currentIndex);
    updatePlaylistUI();
  };

  const pausePlaylist = () => {
    state.playlist.isPlaying = false;
    clearPlaybackTimers();

    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) {
      videoElement.pause();
    }

    updatePlaylistUI();
    showNotification("Playlist paused", "info");
  };

  const playMediaByIndex = (index) => {
    if (index < 0 || index >= state.playlist.items.length) {
      if (state.playlist.items.length > 0) {
        index = 0;
        state.playlist.currentIndex = 0;
      } else {
        stopPlaylist();
        return;
      }
    }

    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);

    if (!media) {
      if (state.playlist.isPlaying) {
        state.playlist.items.splice(index, 1);
        if (index <= state.playlist.currentIndex) {
          state.playlist.currentIndex--;
        }
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

    const element = createMediaElement(media, true);
    if (element) {
      state.dom.mediaContainer.appendChild(element);

      if (element.tagName.toLowerCase() === 'video' && typeof element.load === 'function') {
        element.load();
        element.play().catch(e => console.warn("Autoplay prevented:", media.name, e));
      }

      updateActiveHighlight(media.id, 'playlist');

      if (state.playlist.shuffle) {
        state.playlist.playedInShuffle.add(mediaId);
      }
    } else if (state.playlist.isPlaying) {
      playNextItem();
    }

    updatePlaylistUI();
  };

  const playNextItem = (startIndex = -1) => {
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) {
      stopPlaylist();
      return;
    }

    if (state.playlist.advancingInProgress) return;

    state.playlist.advancingInProgress = true;
    clearPlaybackTimers();

    let nextIndex;

    if (state.playlist.shuffle) {
      if (state.playlist.playedInShuffle.size >= state.playlist.items.length) {
        state.playlist.playedInShuffle.clear();
      }

      const availableItems = state.playlist.items.filter(id => !state.playlist.playedInShuffle.has(id));
      if (availableItems.length === 0) {
        state.playlist.playedInShuffle.clear();
        nextIndex = Math.floor(Math.random() * state.playlist.items.length);
      } else {
        const randomAvailableId = availableItems[Math.floor(Math.random() * availableItems.length)];
        nextIndex = state.playlist.items.indexOf(randomAvailableId);
      }
    } else {
      nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
    }

    if (startIndex !== -1 && startIndex >= 0 && startIndex < state.playlist.items.length) {
      nextIndex = startIndex;
    }

    state.playlist.currentIndex = nextIndex;
    playMediaByIndex(nextIndex);

    setTimeout(() => {
      state.playlist.advancingInProgress = false;
    }, 100);
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
      state.playlist.playedInShuffle.clear();
      if (state.playlist.isPlaying &&
          state.playlist.items.length > 0 &&
          state.playlist.currentIndex >= 0) {
        const currentMediaId = state.playlist.items[state.playlist.currentIndex];
        if (currentMediaId) {
          state.playlist.playedInShuffle.add(currentMediaId);
        }
      }
    }

    updatePlaylistUI();
    showNotification(state.playlist.shuffle ? 'Shuffle mode: On' : 'Shuffle mode: Off', 'info');
  };

  const stopPlaylist = (resetIndexAndDisplay = true) => {
    state.playlist.isPlaying = false;
    clearPlaybackTimers();

    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) {
      videoElement.pause();
    }

    if (resetIndexAndDisplay) {
      state.playlist.currentIndex = -1;
      clearMediaDisplay();
    }

    state.playlist.playedInShuffle.clear();
    updatePlaylistUI();
  };

  const clearMediaDisplay = () => {
    try {
      clearPlaybackTimers();
      while (state.dom.mediaContainer.firstChild) {
        const el = state.dom.mediaContainer.firstChild;
        if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) {
          el.pause();
          el.removeAttribute('src');
          if (typeof el.load === 'function') {
            el.load();
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

  const deleteMedia = (id) => {
    const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id);
    if (indexInLibrary === -1) return;

    const mediaToDelete = state.mediaLibrary[indexInLibrary];
    URL.revokeObjectURL(mediaToDelete.url);
    state.mediaLibrary.splice(indexInLibrary, 1);

    let wasPlayingDeletedItem = false;
    let deletedItemCurrentIndex = -1;

    // Remove from playlist
    for (let i = state.playlist.items.length - 1; i >= 0; i--) {
      if (state.playlist.items[i] === id) {
        if (state.playlist.isPlaying && i === state.playlist.currentIndex) {
          wasPlayingDeletedItem = true;
          deletedItemCurrentIndex = i;
        }
        state.playlist.items.splice(i, 1);
        if (i < state.playlist.currentIndex) {
          state.playlist.currentIndex--;
        }
      }
    }

    // Handle playlist if item was playing
    if (wasPlayingDeletedItem) {
      if (state.playlist.items.length > 0) {
        const nextIndexToPlay = Math.min(deletedItemCurrentIndex, state.playlist.items.length - 1);
        playMediaByIndex(nextIndexToPlay);
      } else {
        stopPlaylist();
      }
    } else if (state.playlist.currentIndex >= state.playlist.items.length && state.playlist.items.length > 0) {
      state.playlist.currentIndex = state.playlist.items.length - 1;
    }

    // Clear media display if it's showing the deleted item
    const currentMediaElement = state.dom.mediaContainer.querySelector('img, video');
    if (currentMediaElement && currentMediaElement.src === mediaToDelete.url) {
      clearMediaDisplay();
    }

    if (state.mediaLibrary.length === 0) {
      clearPlaylist();
    } else {
      updatePlaylistUI();
    }

    updateMediaGallery();
    saveMediaList();
    showNotification(`Removed: ${mediaToDelete.name}`, 'info');
  };

  // UI Update Functions
  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer;
    const emptyState = document.getElementById('playlist-empty-state');
    const controlsContainer = state.dom.playlistControlsContainer;

    if (!playlistContainer || !controlsContainer) return;

    // Clear existing playlist items
    Array.from(playlistContainer.querySelectorAll('.playlist-item')).forEach(child => child.remove());

    if (state.playlist.items.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      controlsContainer.style.visibility = 'hidden';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      controlsContainer.style.visibility = 'visible';

      // Add playlist items
      state.playlist.items.forEach((mediaId, index) => {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) {
          playlistContainer.appendChild(createPlaylistItem(media, index));
        }
      });
    }

    // Update control buttons
    const shuffleButton = document.getElementById('playlist-shuffle-button');
    if (shuffleButton) {
      shuffleButton.classList.toggle('active', state.playlist.shuffle);
    }

    const playButton = document.getElementById('playlist-play-button');
    if (playButton) {
      playButton.innerHTML = state.playlist.isPlaying
          ? '<span style="filter: grayscale(100%);">⏸</span> Pause'
          : '<span style="filter: grayscale(100%);">▶</span> Play All';
    }

    // Update active highlight
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'playlist') {
      updateActiveHighlight(state.activeHighlight.mediaId, 'playlist');
    }
  };

  const createPlaylistItem = (media, index) => {
    const item = createUIElement('div', {
      className: 'playlist-item',
      attributes: {
        'data-id': media.id,
        'data-index': index.toString(),
        draggable: 'true'
      }
    });

    if (index === state.playlist.currentIndex) {
      item.classList.add('current');
    }

    // Add highlight ring
    const highlightRing = createUIElement('div', {
      className: 'media-active-highlight-ring'
    });
    item.appendChild(highlightRing);

    // Setup drag handlers
    item.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'playlist-reorder',
        id: media.id,
        index: index
      }));
      e.dataTransfer.effectAllowed = 'move';
      this.classList.add('dragging');
    });

    item.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom')
          .forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));
    });

    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const rect = this.getBoundingClientRect();
      const isOverTopHalf = e.clientY < rect.top + rect.height / 2;

      document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom')
          .forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom'));

      if (isOverTopHalf) {
        this.classList.add('drag-over-top');
      } else {
        this.classList.add('drag-over-bottom');
      }
    });

    item.addEventListener('dragleave', function() {
      this.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    item.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.remove('drag-over-top', 'drag-over-bottom');

      try {
        const dataText = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        if (!dataText) return;

        let droppedData;
        try {
          droppedData = JSON.parse(dataText);
        } catch (err) {
          // Handle as plain text (media ID)
          const mediaId = dataText;
          const targetIndex = parseInt(this.dataset.index);
          const rect = this.getBoundingClientRect();
          const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
          const insertAtIndex = isDroppedOnTopHalf ? targetIndex : targetIndex + 1;
          addToPlaylist(mediaId, insertAtIndex);
          return;
        }

        if (droppedData?.type === 'playlist-reorder') {
          const fromIndex = parseInt(droppedData.index);
          let toIndex = parseInt(this.dataset.index);

          if (fromIndex === toIndex) return;

          const rect = this.getBoundingClientRect();
          const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;

          if (isDroppedOnTopHalf) {
            reorderPlaylistItem(fromIndex, toIndex);
          } else {
            reorderPlaylistItem(fromIndex, toIndex + 1);
          }
        } else if (droppedData?.type === 'multiple-media') {
          const { ids } = droppedData;
          if (Array.isArray(ids) && ids.length > 0) {
            const targetIndex = parseInt(this.dataset.index);
            const rect = this.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
            let insertAtIndex = isDroppedOnTopHalf ? targetIndex : targetIndex + 1;

            ids.reverse().forEach((id) => {
              addToPlaylist(id, insertAtIndex);
            });

            showNotification(`Added ${ids.length} items to playlist`, 'success');
          }
        }
      } catch (err) {
        console.error('Error during playlist drop handling:', err);
      }
    });

    // Thumbnail
    const thumbnail = createUIElement('div', {
      className: 'playlist-item-thumbnail',
      style: media.thumbnail ? {
        backgroundImage: `url(${media.thumbnail})`
      } : {
        backgroundColor: '#333'
      }
    });

    if (!media.thumbnail) {
      thumbnail.textContent = media.type.charAt(0).toUpperCase();
    }

    // Trim indicator
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
          innerHTML: '<span style="filter: grayscale(100%);">✂️</span>'
        });
        thumbnail.appendChild(trimIndicator);
      }
    }

    // Info container
    const infoContainer = createUIElement('div', {
      className: 'playlist-item-info'
    });

    const nameEl = createUIElement('div', {
      className: 'playlist-item-name',
      textContent: media.name
    });
    infoContainer.appendChild(nameEl);

    // Details
    const detailsEl = createUIElement('div', {
      className: 'playlist-item-details'
    });

    let detailsText = `${media.type} · ${formatFileSize(media.size)}`;

    if (media.type === 'video' && media.trimSettings?.trimEnabled) {
      const trimSettings = media.trimSettings;
      const originalDuration = media.settings.originalDuration;
      const isEffectivelyTrimmed = (trimSettings.startTime || 0) > 0.01 ||
          (typeof originalDuration === 'number' && originalDuration > 0 &&
              typeof trimSettings.endTime === 'number' &&
              Math.abs(trimSettings.endTime - originalDuration) > 0.01 &&
              trimSettings.endTime < originalDuration);

      if (isEffectivelyTrimmed) {
        detailsText += ` · Trimmed`;
        if (typeof trimSettings.startTime === 'number' && typeof trimSettings.endTime === 'number') {
          const duration = trimSettings.endTime - trimSettings.startTime;
          if (duration > 0) {
            detailsText += ` (${formatTime(duration)})`;
          }
        }
      }
    }

    detailsEl.textContent = detailsText;
    infoContainer.appendChild(detailsEl);

    // Delete button
    const deleteBtn = createUIElement('button', {
      className: 'btn btn-icon btn-danger playlist-item-delete',
      innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      attributes: { 'aria-label': 'Remove from playlist' },
      events: {
        click: function(e) {
          e.stopPropagation();
          removeFromPlaylist(index);
        }
      }
    });

    // Click handler
    item.addEventListener('click', function(e) {
      if (e.target === deleteBtn || deleteBtn.contains(e.target)) {
        return;
      }

      // Toggle play/pause if clicking current item
      if (state.playlist.isPlaying && state.playlist.currentIndex === index) {
        pausePlaylist();
        return;
      }

      state.playlist.currentIndex = index;
      playPlaylist();
      updateActiveHighlight(media.id, 'playlist');
    });

    // Assemble item
    item.appendChild(thumbnail);
    item.appendChild(infoContainer);
    item.appendChild(deleteBtn);

    // Add playing indicator if current
    if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
      const playingIndicator = createUIElement('div', {
        className: 'playlist-item-playing-indicator',
        innerHTML: '<span style="filter: grayscale(100%);">▶</span>'
      });
      thumbnail.appendChild(playingIndicator);
    }

    return item;
  };

  // Active highlight management
  const updateActiveHighlight = (mediaId, sourceType) => {
    removeAllActiveHighlights();

    if (!mediaId) return;

    state.activeHighlight.mediaId = mediaId;
    state.activeHighlight.sourceType = sourceType;

    const selector = sourceType === 'library'
        ? `.media-thumbnail[data-id="${mediaId}"]`
        : `.playlist-item[data-id="${mediaId}"]`;

    const container = sourceType === 'library'
        ? state.dom.mediaGallery
        : state.dom.playlistContainer;

    const element = container?.querySelector(selector);
    if (element) {
      element.classList.add('playing-from-here');
    }
  };

  const removeAllActiveHighlights = () => {
    document.querySelectorAll('.media-thumbnail.playing-from-here, .playlist-item.playing-from-here')
        .forEach(el => el.classList.remove('playing-from-here'));

    state.activeHighlight.mediaId = null;
    state.activeHighlight.sourceType = null;
  };

  // Storage Functions
  const saveMediaList = () => {
    try {
      const mediaForStorage = state.mediaLibrary.map(media => {
        const { url, thumbnail, ...mediaMeta } = media;
        return {
          ...mediaMeta,
          id: media.id,
          name: media.name,
          type: media.type,
          mimeType: media.mimeType,
          size: media.size,
          dateAdded: media.dateAdded,
          settings: media.settings,
          trimSettings: media.trimSettings
        };
      });

      const storageData = {
        media: mediaForStorage,
        playlist: {
          items: state.playlist.items,
          shuffle: state.playlist.shuffle
        }
      };

      localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(storageData));
    } catch (e) {
      console.error('Failed to save media list:', e);
      showNotification('Error saving media library.', 'error');
    }
  };

  const loadSavedMedia = () => {
    try {
      const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEY);
      if (!savedData) {
        // Check for old version data
        const oldSavedData = localStorage.getItem(CONSTANTS.STORAGE_KEY_OLD);
        if (oldSavedData) {
          const oldParsedData = JSON.parse(oldSavedData);
          if (oldParsedData.media?.length > 0) {
            showNotification(
                `Old library data found (${oldParsedData.media.length} items). Please re-import files for full functionality.`,
                'info'
            );
          }
        }
        return;
      }

      const parsedData = JSON.parse(savedData);
      if (parsedData.media && Array.isArray(parsedData.media)) {
        if (parsedData.media.length > 0) {
          showNotification(
              `Found ${parsedData.media.length} media entries in saved library. Please re-import the actual files if you wish to use them.`,
              'info'
          );
        }
      }

      if (parsedData.playlist) {
        state.playlist.shuffle = parsedData.playlist.shuffle || false;
      }

      updateMediaGallery();
      updatePlaylistUI();
    } catch (e) {
      console.error('Failed to load media data:', e);
      localStorage.removeItem(CONSTANTS.STORAGE_KEY);
      localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
    }
  };

  // Utility Functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const showNotification = (message, type) => {
    if (typeof WallpaperApp !== 'undefined' && WallpaperApp.UI?.showNotification === 'function') {
      WallpaperApp.UI.showNotification(message, type);
    } else {
      console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`);
    }
  };

  const applyTemporaryHighlight = (element) => {
    if (!element) return;

    element.classList.add('pulse-highlight-effect');
    setTimeout(() => {
      element.classList.remove('pulse-highlight-effect');
    }, 1400);
  };

  // Public API
  return {
    init,
    getCurrentPlaylist: () => state.playlist,
    getMediaLibrary: () => state.mediaLibrary,
    openMediaSettings: (mediaId) => {
      const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (media) openMediaSettingsDialog(media);
    }
  };
})();

// Initialize the module
MediaModule.init();
/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Version 0.5.1 - Refactored for improved stability and bug fixes
 *
 * Key improvements:
 * - Fixed multi-item drag & drop functionality
 * - Improved code organization and separation of concerns
 * - Enhanced error handling and stability
 * - Reduced coupling between modules
 * - Better state management
 */

const MediaModule = (() => {
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

  // Application state - Centralized state management
  const state = {
    // Media library and playlist data
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

    // DOM element references
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

    // Selection and interaction state
    selection: {
      active: false,
      startPoint: null,
      items: new Set(),
      shiftKeyActive: false,
      lastSelected: null,
      selectionBoxElement: null
    },

    // Active highlighting and contextual editing
    activeHighlight: {
      mediaId: null,
      sourceType: null
    },

    // File input and active media references
    fileInput: null,
    activeVideoElement: null,

    // Contextual editing state
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

  // Utility Functions - Pure functions for common operations
  const Utils = {
    // Generate unique media ID
    generateId: () => `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,

    // Check if file type is supported
    isFileSupported: (type) =>
        CONSTANTS.SUPPORTED_TYPES.video.includes(type) || CONSTANTS.SUPPORTED_TYPES.image.includes(type),

    // Format file size for display
    formatFileSize: (bytes) => {
      if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    // Show notification with fallback
    showNotification: (message, type = 'info', duration) => {
      try {
        if (typeof WallpaperApp !== 'undefined' && typeof WallpaperApp.UI?.showNotification === 'function') {
          const notificationDuration = duration ||
              (typeof WallpaperApp.config?.notificationDuration === 'number' ? WallpaperApp.config.notificationDuration : 3000);
          WallpaperApp.UI.showNotification(message, type, notificationDuration);
        } else {
          console.log(`[${(type?.toUpperCase() || 'INFO')}] ${message}`);
        }
      } catch (error) {
        console.error('[Utils.showNotification] Error showing notification:', error);
        console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`);
      }
    },

    // Create DOM element with options
    createElement: (tag, options = {}) => {
      try {
        const element = document.createElement(tag);
        if (options.className) element.className = options.className;
        if (options.id) element.id = options.id;
        if (options.textContent) element.textContent = options.textContent;
        if (options.innerHTML) element.innerHTML = options.innerHTML;
        if (options.type) element.type = options.type;
        if (options.accept) element.accept = options.accept;
        if (options.multiple) element.multiple = options.multiple;
        if (options.style) Object.assign(element.style, options.style);
        if (options.attributes) {
          Object.entries(options.attributes).forEach(([key, value]) =>
              element.setAttribute(key, value));
        }
        if (options.events) {
          Object.entries(options.events).forEach(([event, handler]) =>
              element.addEventListener(event, handler));
        }
        return element;
      } catch (error) {
        console.error('[Utils.createElement] Error creating element:', error);
        return document.createElement('div'); // Fallback
      }
    },

    // Create divider element
    createDivider: () => Utils.createElement('hr', { className: 'divider' }),

    // Debounce function for performance
    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  };

  // DOM Management - Functions for DOM manipulation and UI creation
  const DOMManager = {
    // Initialize DOM references
    initializeDOMReferences() {
      try {
        state.dom.mainMenu = document.getElementById('main-menu');
        state.dom.contextMenuContainer = document.getElementById('context-menu-container');
        state.dom.inlinePanelContainer = document.getElementById('inline-panel-container');
        state.dom.mediaContainer = document.getElementById('media-container');
        state.dom.perClipTransitionsList = document.getElementById('per-clip-transitions-list');

        if (!state.dom.mediaContainer) {
          console.error("[DOMManager] CRITICAL - #media-container for playback not found.");
        }

        return true;
      } catch (error) {
        console.error("[DOMManager.initializeDOMReferences] Error:", error);
        return false;
      }
    },

    // Setup media import UI
    setupMediaImportUI(menuContent) {
      try {
        menuContent.innerHTML = '';

        // Setup file input
        this.setupFileInput();

        // Create import button
        const importButton = Utils.createElement('button', {
          className: 'submenu-item import-media-button',
          textContent: 'IMPORT MEDIA',
          attributes: { 'data-action': 'import-media-action', 'data-tooltip': 'Click to import media files' },
        });
        menuContent.appendChild(importButton);
        menuContent.appendChild(Utils.createDivider());

        // Create media library section
        const mediaLibrarySection = this.createMediaLibrarySection();
        state.dom.mediaLibrarySection = mediaLibrarySection;
        menuContent.appendChild(mediaLibrarySection);
        menuContent.appendChild(Utils.createDivider());

        // Create playlist section
        const playlistSection = this.createPlaylistSection();
        state.dom.playlistSection = playlistSection;
        menuContent.appendChild(playlistSection);

        return true;
      } catch (error) {
        console.error("[DOMManager.setupMediaImportUI] Error:", error);
        return false;
      }
    },

    // Setup file input element
    setupFileInput() {
      try {
        // Remove existing file input if present
        if (state.fileInput && state.fileInput.parentNode) {
          state.fileInput.parentNode.removeChild(state.fileInput);
        }

        state.fileInput = Utils.createElement('input', {
          type: 'file',
          id: 'media-file-input',
          accept: [...CONSTANTS.SUPPORTED_TYPES.video, ...CONSTANTS.SUPPORTED_TYPES.image].join(','),
          multiple: true,
          style: { display: 'none' },
          events: {
            change: (e) => {
              FileHandler.handleFileSelect(e.target.files);
              e.target.value = ''; // Clear input for re-selection
            }
          }
        });

        document.body.appendChild(state.fileInput);
      } catch (error) {
        console.error("[DOMManager.setupFileInput] Error:", error);
      }
    },

    // Create media library section
    createMediaLibrarySection() {
      const section = Utils.createElement('div', { id: 'media-library-section' });
      const title = Utils.createElement('h3', { textContent: 'MEDIA LIBRARY' });
      const selectionInfo = Utils.createElement('div', {
        className: 'selection-info',
        textContent: 'Shift+Click or drag to select. Right-click for options.'
      });

      const gallery = Utils.createElement('div', { id: 'media-gallery' });
      SelectionManager.setupGalleryDragSelection(gallery);

      state.dom.mediaEmptyState = Utils.createElement('div', {
        id: 'media-empty-state',
        textContent: 'Import media to get started.'
      });
      gallery.appendChild(state.dom.mediaEmptyState);

      section.appendChild(title);
      section.appendChild(selectionInfo);
      section.appendChild(gallery);
      state.dom.mediaGallery = gallery;

      return section;
    },

    // Create playlist section
    createPlaylistSection() {
      const section = Utils.createElement('div', { id: 'playlist-section' });
      const title = Utils.createElement('h3', { textContent: 'PLAYLIST' });

      const playlistContainer = Utils.createElement('div', { id: 'playlist-container' });

      // Setup drag and drop handlers
      playlistContainer.addEventListener('dragover', DragDropHandler.handlePlaylistDragOver);
      playlistContainer.addEventListener('drop', DragDropHandler.handlePlaylistDrop);
      playlistContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)';
      });
      playlistContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        // Only remove highlight if we're leaving the container entirely
        const rect = playlistContainer.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom) {
          playlistContainer.style.backgroundColor = '';
        }
      });

      state.dom.playlistEmptyState = Utils.createElement('div', {
        id: 'playlist-empty-state',
        textContent: 'Drag media here to create a playlist.'
      });
      playlistContainer.appendChild(state.dom.playlistEmptyState);

      section.appendChild(title);
      section.appendChild(playlistContainer);
      state.dom.playlistContainer = playlistContainer;

      // Create playlist controls
      const controlsContainer = Utils.createElement('div', {
        id: 'playlist-controls',
        style: { visibility: 'hidden' }
      });
      state.dom.playlistControlsContainer = controlsContainer;
      this.createPlaylistControls(controlsContainer);
      section.appendChild(controlsContainer);

      return section;
    },

    // Create playlist control buttons
    createPlaylistControls(controlsContainer) {
      controlsContainer.innerHTML = '';

      const buttons = [
        { id: 'playlist-play-button', html: '<span style="filter: grayscale(100%);">▶</span> Play All', class: 'btn-primary' },
        { id: 'playlist-shuffle-button', html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle', class: 'btn-secondary' },
        { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', class: 'btn-danger' }
      ];

      buttons.forEach(btnData => {
        const button = Utils.createElement('button', {
          id: btnData.id,
          innerHTML: btnData.html,
          className: `btn playlist-button ${btnData.class || 'btn-secondary'}`
        });
        controlsContainer.appendChild(button);
      });
    }
  };

  // File Handler - Handles file processing and media management
  const FileHandler = {
    // Handle file selection from input
    async handleFileSelect(files) {
      console.log(`[FileHandler] Processing ${files?.length || 0} file(s).`);

      if (!files || files.length === 0) {
        console.log("[FileHandler] No files to process.");
        return;
      }

      let validCount = 0;
      let invalidCount = 0;
      const processingPromises = [];

      Array.from(files).forEach(file => {
        console.log(`[FileHandler] Checking file "${file.name}" (type: ${file.type})`);

        if (Utils.isFileSupported(file.type)) {
          console.log(`[FileHandler] File "${file.name}" is supported. Adding to processing queue.`);
          processingPromises.push(
              this.processFile(file)
                  .then(() => {
                    validCount++;
                    console.log(`[FileHandler] Successfully processed "${file.name}". Valid count: ${validCount}`);
                  })
                  .catch(err => {
                    invalidCount++;
                    console.error(`[FileHandler] Error processing file "${file.name}":`, err);
                  })
          );
        } else {
          invalidCount++;
          console.warn(`[FileHandler] File "${file.name}" (type: ${file.type}) is not supported. Invalid count: ${invalidCount}`);
        }
      });

      console.log(`[FileHandler] Awaiting ${processingPromises.length} processing promises.`);

      try {
        await Promise.all(processingPromises);
        console.log("[FileHandler] All file processing promises settled.");
      } catch (error) {
        console.error("[FileHandler] Error during Promise.all execution:", error);
      }

      // Show results
      if (validCount > 0) {
        Utils.showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}.`, 'success');
      }
      if (invalidCount > 0) {
        Utils.showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} unsupported or failed.`, 'warning');
      }

      // Update UI and save
      MediaLibraryManager.updateUI();
      PlaylistManager.updateUI();
      StorageManager.saveData();
    },

    // Process individual file
    async processFile(file) {
      console.log(`[FileHandler] Starting processing for "${file.name}" (size: ${file.size}, type: ${file.type})`);

      try {
        const id = Utils.generateId();
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
          settings: { effects: [] }
        };

        state.mediaLibrary.push(mediaItem);
        console.log(`[FileHandler] Added "${file.name}" to mediaLibrary (ID: ${id}). Generating thumbnail.`);

        try {
          mediaItem.thumbnail = await this.generateThumbnail(mediaItem, file);
          console.log(`[FileHandler] Thumbnail generated successfully for "${file.name}".`);
        } catch (err) {
          console.warn(`[FileHandler] Error generating thumbnail for "${mediaItem.name}":`, err.message || err);
          mediaItem.thumbnail = this.createFallbackThumbnail(mediaItem.type);
          console.log(`[FileHandler] Fallback thumbnail used for "${file.name}".`);
        }
      } catch (error) {
        console.error(`[FileHandler] Error processing file "${file.name}":`, error);
        throw error;
      }
    },

    // Generate thumbnail for media item
    generateThumbnail(mediaItem, file) {
      return new Promise((resolve, reject) => {
        console.log(`[FileHandler] Starting thumbnail generation for "${mediaItem.name}", type: ${mediaItem.type}`);

        if (mediaItem.type === 'image') {
          const reader = new FileReader();
          reader.onload = e => {
            console.log(`[FileHandler] Image FileReader success for "${mediaItem.name}"`);
            resolve(e.target.result);
          };
          reader.onerror = (err) => {
            console.error(`[FileHandler] Image FileReader error for ${mediaItem.name}:`, err);
            reject(new Error(`FileReader error for ${mediaItem.name}`));
          };
          reader.readAsDataURL(file);
        } else if (mediaItem.type === 'video') {
          this.generateVideoThumbnail(mediaItem.url, mediaItem.name)
              .then(resolve)
              .catch(reject);
        } else {
          console.error(`[FileHandler] Unsupported type for thumbnail: ${mediaItem.type}`);
          reject(new Error(`Unsupported type for thumbnail generation: ${mediaItem.type}`));
        }
      });
    },

    // Generate video thumbnail
    generateVideoThumbnail(videoUrl, videoName) {
      return new Promise((resolve, reject) => {
        console.log(`[FileHandler] Starting video thumbnail generation for "${videoName}"`);

        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.crossOrigin = "anonymous";

        let thumbnailGenerated = false;
        let timeoutId = null;

        const cleanupAndResolve = (thumbnailUrl) => {
          if (timeoutId) clearTimeout(timeoutId);
          this.cleanupVideoElement(video);
          console.log(`[FileHandler] Successfully generated video thumbnail for "${videoName}"`);
          resolve(thumbnailUrl);
        };

        const cleanupAndReject = (errorMsg, errorObj = null) => {
          if (timeoutId) clearTimeout(timeoutId);
          this.cleanupVideoElement(video);
          console.warn(`[FileHandler] Failed video thumbnail for "${videoName}". Reason: ${errorMsg}`, errorObj || '');
          reject(new Error(errorMsg));
        };

        const generateFrame = () => {
          if (thumbnailGenerated) return;
          thumbnailGenerated = true;

          console.log(`[FileHandler] Generating frame for "${videoName}". Video readyState: ${video.readyState}, W: ${video.videoWidth}, H: ${video.videoHeight}`);

          try {
            const canvas = document.createElement('canvas');
            canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width;
            canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              cleanupAndReject(`Canvas 2D context not available for "${videoName}"`);
              return;
            }

            // Fill background
            ctx.fillStyle = '#1A1A1A';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw video frame if available
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              const videoAspectRatio = video.videoWidth / video.videoHeight;
              const canvasAspectRatio = canvas.width / canvas.height;
              let drawWidth, drawHeight, offsetX, offsetY;

              if (videoAspectRatio > canvasAspectRatio) {
                drawWidth = canvas.width;
                drawHeight = canvas.width / videoAspectRatio;
                offsetX = 0;
                offsetY = (canvas.height - drawHeight) / 2;
              } else {
                drawHeight = canvas.height;
                drawWidth = canvas.height * videoAspectRatio;
                offsetY = 0;
                offsetX = (canvas.width - drawWidth) / 2;
              }

              ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
              console.log(`[FileHandler] Drew video frame to canvas for "${videoName}"`);
            } else {
              console.warn(`[FileHandler] Video dimensions are zero for "${videoName}". Drawing placeholder text.`);
              ctx.fillStyle = '#555';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#ccc';
              ctx.font = "bold 12px Barlow, sans-serif";
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('No Preview', canvas.width / 2, canvas.height / 2);
            }

            this.drawPlayButton(ctx, canvas.width, canvas.height);
            cleanupAndResolve(canvas.toDataURL('image/jpeg', 0.7));
          } catch (err) {
            cleanupAndReject(`Canvas thumbnail generation error for "${videoName}"`, err);
          }
        };

        // Event handlers
        video.onloadedmetadata = function() {
          console.log(`[FileHandler] Video metadata loaded for "${videoName}". Duration: ${video.duration}`);
          if (video.duration && !isNaN(video.duration) && video.duration > 0) {
            try {
              video.currentTime = Math.min(1.0, video.duration / 3);
              console.log(`[FileHandler] Seeked to ${video.currentTime} for "${videoName}"`);
            } catch (e) {
              console.warn(`[FileHandler] Error seeking video for "${videoName}":`, e);
              generateFrame();
            }
          } else {
            console.warn(`[FileHandler] No valid duration for "${videoName}"`);
            generateFrame();
          }
        };

        video.onseeked = () => {
          console.log(`[FileHandler] Video seeked for "${videoName}" at time ${video.currentTime}.`);
          generateFrame();
        };

        video.onerror = (e) => {
          const errorDetail = e.target?.error ?
              `Code: ${e.target.error.code}, Message: ${e.target.error.message}` :
              (e.message || e.type || 'Unknown video error');
          cleanupAndReject(`Video element error for thumbnail generation of "${videoName}"`, errorDetail);
        };

        // Timeout handler
        timeoutId = setTimeout(() => {
          if (!thumbnailGenerated) {
            cleanupAndReject(`Thumbnail generation timed out for "${videoName}" after ${CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT}ms`);
          }
        }, CONSTANTS.VIDEO_THUMBNAIL_TIMEOUT);

        try {
          video.src = videoUrl;
          console.log(`[FileHandler] Set video src for "${videoName}"`);
        } catch (e) {
          cleanupAndReject(`Error setting video src for thumbnail: "${videoName}"`, e);
        }
      });
    },

    // Cleanup video element
    cleanupVideoElement(video) {
      try {
        video.onloadedmetadata = null;
        video.onseeked = null;
        video.onerror = null;
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (e) {
        // Ignore cleanup errors
      }
    },

    // Create fallback thumbnail
    createFallbackThumbnail(type = 'media') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = CONSTANTS.THUMBNAIL_DIMENSIONS.width;
        canvas.height = CONSTANTS.THUMBNAIL_DIMENSIONS.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ccc';
        ctx.font = `bold ${Math.min(canvas.height / 4, 20)}px Barlow, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (type === 'video') {
          this.drawPlayButton(ctx, canvas.width, canvas.height, '#ccc');
        } else {
          ctx.fillText(type.toUpperCase(), canvas.width / 2, canvas.height / 2);
        }

        return canvas.toDataURL('image/png');
      } catch (error) {
        console.error('[FileHandler.createFallbackThumbnail] Error:', error);
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }
    },

    // Draw play button on canvas
    drawPlayButton(ctx, width, height, color = 'rgba(255, 255, 255, 0.7)') {
      try {
        ctx.fillStyle = color;
        const cX = width / 2;
        const cY = height / 2;
        const tS = Math.min(width, height) * 0.25;

        ctx.beginPath();
        ctx.moveTo(cX - tS / 2, cY - tS * 0.866 / 2);
        ctx.lineTo(cX - tS / 2, cY + tS * 0.866 / 2);
        ctx.lineTo(cX + tS * 0.8, cY);
        ctx.closePath();
        ctx.fill();
      } catch (error) {
        console.error('[FileHandler.drawPlayButton] Error:', error);
      }
    }
  };

  // Drag and Drop Handler - Improved handling for multiple items
  const DragDropHandler = {
    // Handle drag over playlist
    handlePlaylistDragOver(e) {
      e.preventDefault();

      try {
        if (e.dataTransfer.types.includes('application/json')) {
          e.dataTransfer.dropEffect = 'move';
        } else if (e.dataTransfer.types.includes('text/plain')) {
          e.dataTransfer.dropEffect = 'copy';
        } else {
          e.dataTransfer.dropEffect = 'none';
        }
      } catch (error) {
        console.error('[DragDropHandler.handlePlaylistDragOver] Error:', error);
        e.dataTransfer.dropEffect = 'none';
      }
    },

    // Enhanced playlist drop handler - FIXED MULTI-ITEM BUG
    handlePlaylistDrop(e) {
      e.preventDefault();
      e.currentTarget.style.backgroundColor = '';

      try {
        console.log('[DragDropHandler] Processing playlist drop event');

        // Get drop position information
        const insertPosition = DragDropHandler.calculateInsertPosition(e);
        console.log(`[DragDropHandler] Calculated insert position: ${insertPosition}`);

        // Try to get data from dataTransfer
        let dataProcessed = false;

        // First, try JSON data
        try {
          const jsonDataText = e.dataTransfer.getData('application/json');
          if (jsonDataText && jsonDataText.trim()) {
            console.log('[DragDropHandler] Found JSON data:', jsonDataText);
            const jsonData = JSON.parse(jsonDataText);

            if (jsonData?.type === 'multiple-media' && Array.isArray(jsonData.ids) && jsonData.ids.length > 0) {
              console.log(`[DragDropHandler] Processing multiple media items: ${jsonData.ids.length} items`);
              dataProcessed = true;

              // Process multiple items
              DragDropHandler.processMultipleMediaDrop(jsonData.ids, insertPosition);
              return;
            } else if (jsonData?.type === 'playlist-reorder') {
              console.log('[DragDropHandler] Processing playlist reorder');
              dataProcessed = true;

              // Handle playlist reordering
              const fromIdx = parseInt(jsonData.index);
              const toIdx = insertPosition;

              if (!isNaN(fromIdx) && !isNaN(toIdx) && fromIdx !== toIdx) {
                console.log(`[DragDropHandler] Reordering from ${fromIdx} to ${toIdx}`);
                PlaylistManager.reorderItem(fromIdx, toIdx);
              }
              return;
            }
          }
        } catch (jsonError) {
          console.log('[DragDropHandler] No valid JSON data found:', jsonError.message);
        }

        // If no JSON data processed, try plain text (single item)
        if (!dataProcessed) {
          try {
            const mediaId = e.dataTransfer.getData('text/plain');
            if (mediaId && mediaId.trim()) {
              console.log('[DragDropHandler] Found plain text data (single item):', mediaId);
              const media = state.mediaLibrary.find(m => m.id === mediaId);

              if (media) {
                console.log(`[DragDropHandler] Adding single item "${media.name}" at position ${insertPosition}`);
                PlaylistManager.addItem(mediaId, insertPosition);
              } else {
                console.warn(`[DragDropHandler] Media ID "${mediaId}" not found in library`);
                Utils.showNotification('Dragged media not found.', 'error');
              }
            }
          } catch (textError) {
            console.log('[DragDropHandler] No valid text data found:', textError.message);
          }
        }

      } catch (error) {
        console.error('[DragDropHandler.handlePlaylistDrop] Critical error:', error);
        Utils.showNotification('Error adding to playlist.', 'error');
      }
    },

    // Process multiple media items drop
    processMultipleMediaDrop(mediaIds, insertPosition) {
      try {
        // Validate all media items exist
        const validItems = [];
        const invalidIds = [];

        mediaIds.forEach(id => {
          const media = state.mediaLibrary.find(m => m.id === id);
          if (media) {
            validItems.push({ id, media });
          } else {
            invalidIds.push(id);
          }
        });

        if (invalidIds.length > 0) {
          console.warn(`[DragDropHandler] Invalid media IDs found:`, invalidIds);
        }

        if (validItems.length === 0) {
          Utils.showNotification('No valid media items found to add.', 'warning');
          return;
        }

        console.log(`[DragDropHandler] Adding ${validItems.length} valid items to playlist`);

        // Add items maintaining their original order
        let currentInsertPos = insertPosition;
        validItems.forEach((item, index) => {
          console.log(`[DragDropHandler] Adding item ${index + 1}/${validItems.length}: "${item.media.name}" at position ${currentInsertPos}`);

          // Add item without showing individual notifications
          const prevItems = [...state.playlist.items];
          if (currentInsertPos === -1 || currentInsertPos >= state.playlist.items.length) {
            state.playlist.items.push(item.id);
          } else {
            state.playlist.items.splice(currentInsertPos, 0, item.id);
          }

          // Update current index if necessary
          if (state.playlist.isPlaying && currentInsertPos <= state.playlist.currentIndex) {
            state.playlist.currentIndex++;
          }

          // Update transitions
          PlaylistManager.updateTransitionsAfterInsert(currentInsertPos);

          // Increment position for next item
          if (currentInsertPos !== -1) {
            currentInsertPos++;
          }
        });

        // Update UI once for all items
        PlaylistManager.updateUI();
        StorageManager.saveData();

        // Show single notification for all items
        Utils.showNotification(
            `Added ${validItems.length} item${validItems.length !== 1 ? 's' : ''} to playlist.`,
            'success'
        );

      } catch (error) {
        console.error('[DragDropHandler.processMultipleMediaDrop] Error:', error);
        Utils.showNotification('Error adding items to playlist.', 'error');
      }
    },

    // Calculate insertion position for dropped items
    calculateInsertPosition(e) {
      try {
        const container = state.dom.playlistContainer;
        if (!container) return state.playlist.items.length;

        // Check if we're dropping on a playlist item or transition zone
        const targetEl = e.target.closest('.playlist-item, .playlist-transition-zone');

        if (!targetEl) {
          // Dropped on empty space - add to end
          return state.playlist.items.length;
        }

        const isItem = targetEl.classList.contains('playlist-item');
        const targetIdx = parseInt(targetEl.dataset.index || '0', 10);

        if (isItem) {
          // Dropped on an item - check if top or bottom half
          const rect = targetEl.getBoundingClientRect();
          const dropY = e.clientY;
          const isTopHalf = dropY < rect.top + rect.height / 2;

          return isTopHalf ? targetIdx : targetIdx + 1;
        } else {
          // Dropped on a transition zone
          return targetIdx;
        }

      } catch (error) {
        console.error('[DragDropHandler.calculateInsertPosition] Error:', error);
        return state.playlist.items.length;
      }
    }
  };

  // Selection Manager - Handles media selection and drag selection
  const SelectionManager = {
    // Setup drag selection for gallery
    setupGalleryDragSelection(gallery) {
      let isSelecting = false;
      let galleryRect = null;

      gallery.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target !== gallery) return;

        try {
          ContextualManager.hideContextMenu();
          ContextualManager.hideInlinePanel();

          isSelecting = true;
          galleryRect = gallery.getBoundingClientRect();

          state.selection.startPoint = {
            x: e.clientX - galleryRect.left + gallery.scrollLeft,
            y: e.clientY - galleryRect.top + gallery.scrollTop
          };

          if (state.selection.selectionBoxElement) {
            state.selection.selectionBoxElement.remove();
          }

          state.selection.selectionBoxElement = Utils.createElement('div', {
            className: 'selection-box',
            style: {
              left: (state.selection.startPoint.x - gallery.scrollLeft) + 'px',
              top: (state.selection.startPoint.y - gallery.scrollTop) + 'px',
              width: '0px',
              height: '0px'
            }
          });

          gallery.appendChild(state.selection.selectionBoxElement);

          if (!state.selection.shiftKeyActive) {
            this.clearSelection();
          }

          e.preventDefault();
        } catch (error) {
          console.error('[SelectionManager.setupGalleryDragSelection] mousedown error:', error);
        }
      });

      document.addEventListener('mousemove', (e) => {
        if (!isSelecting || !state.selection.selectionBoxElement || !galleryRect) return;

        try {
          const currentX = e.clientX - galleryRect.left + gallery.scrollLeft;
          const currentY = e.clientY - galleryRect.top + gallery.scrollTop;

          const x1 = Math.min(state.selection.startPoint.x, currentX);
          const y1 = Math.min(state.selection.startPoint.y, currentY);
          const x2 = Math.max(state.selection.startPoint.x, currentX);
          const y2 = Math.max(state.selection.startPoint.y, currentY);

          state.selection.selectionBoxElement.style.left = (x1 - gallery.scrollLeft) + 'px';
          state.selection.selectionBoxElement.style.top = (y1 - gallery.scrollTop) + 'px';
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

            const intersects = !(thumbnailRectDoc.right < selectionRectDoc.left ||
                thumbnailRectDoc.left > selectionRectDoc.right ||
                thumbnailRectDoc.bottom < selectionRectDoc.top ||
                thumbnailRectDoc.top > selectionRectDoc.bottom);

            if (intersects) {
              if (!state.selection.items.has(mediaId)) {
                this.addToSelection(mediaId);
                thumbnail.classList.add('selected');
              }
            } else {
              if (state.selection.items.has(mediaId) && !state.selection.shiftKeyActive) {
                this.removeFromSelection(mediaId);
                thumbnail.classList.remove('selected');
              }
            }
          });
        } catch (error) {
          console.error('[SelectionManager.setupGalleryDragSelection] mousemove error:', error);
        }
      });

      document.addEventListener('mouseup', () => {
        if (!isSelecting) return;

        try {
          isSelecting = false;
          galleryRect = null;

          if (state.selection.selectionBoxElement) {
            state.selection.selectionBoxElement.remove();
            state.selection.selectionBoxElement = null;
          }

          if (state.selection.items.size > 0) {
            state.selection.lastSelected = Array.from(state.selection.items).pop();
          }
        } catch (error) {
          console.error('[SelectionManager.setupGalleryDragSelection] mouseup error:', error);
        }
      });
    },

    // Selection management methods
    clearSelection() {
      state.selection.items.clear();
      state.selection.lastSelected = null;
      this.updateSelectionUI();
    },

    addToSelection(mediaId) {
      state.selection.items.add(mediaId);
    },

    removeFromSelection(mediaId) {
      state.selection.items.delete(mediaId);
    },

    toggleSelection(mediaId) {
      if (state.selection.items.has(mediaId)) {
        state.selection.items.delete(mediaId);
      } else {
        state.selection.items.add(mediaId);
      }
    },

    selectRange(startId, endId) {
      if (!state.dom.mediaGallery) return;

      const allThumbs = Array.from(state.dom.mediaGallery.querySelectorAll('.media-thumbnail'));
      const startIdx = allThumbs.findIndex(t => t.dataset.id === startId);
      const endIdx = allThumbs.findIndex(t => t.dataset.id === endId);

      if (startIdx === -1 || endIdx === -1) return;

      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);

      for (let i = minIdx; i <= maxIdx; i++) {
        const idInRange = allThumbs[i].dataset.id;
        if (idInRange) this.addToSelection(idInRange);
      }

      state.selection.lastSelected = endId;
    },

    updateSelectionUI() {
      if (!state.dom.mediaGallery) return;

      state.dom.mediaGallery.querySelectorAll('.media-thumbnail').forEach(thumb => {
        thumb.classList.toggle('selected', state.selection.items.has(thumb.dataset.id));
      });
    },

    // Handle thumbnail click with enhanced selection logic
    handleThumbnailClick(e, media, thumbnailElement) {
      try {
        if (state.selection.shiftKeyActive && state.selection.lastSelected) {
          this.selectRange(state.selection.lastSelected, media.id);
        } else if (state.selection.shiftKeyActive) {
          this.clearSelection();
          this.addToSelection(media.id);
          state.selection.lastSelected = media.id;
        } else if (e.ctrlKey || e.metaKey) {
          this.toggleSelection(media.id);
          state.selection.lastSelected = state.selection.items.has(media.id) ? media.id : null;
        } else {
          const wasSelected = state.selection.items.has(media.id);
          const multipleSelected = state.selection.items.size > 1;

          if (wasSelected && !multipleSelected) {
            MediaPlayer.selectMedia(media, true);
          } else {
            this.clearSelection();
            this.addToSelection(media.id);
            state.selection.lastSelected = media.id;
            MediaPlayer.selectMedia(media, true);
          }
        }

        this.updateSelectionUI();
      } catch (error) {
        console.error('[SelectionManager.handleThumbnailClick] Error:', error);
      }
    }
  };

  // Media Library Manager - Handles media library operations
  const MediaLibraryManager = {
    // Update media gallery UI
    updateUI() {
      try {
        const gallery = state.dom.mediaGallery;
        const emptyState = state.dom.mediaEmptyState;

        if (!gallery || !emptyState) {
          console.error("Media gallery/empty state DOM not found for update.");
          return;
        }

        emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';

        const fragment = document.createDocumentFragment();
        state.mediaLibrary.forEach(media => {
          fragment.appendChild(this.createThumbnail(media));
        });

        // Remove old thumbnails (keep empty state and selection box)
        Array.from(gallery.children).forEach(child => {
          if (child !== emptyState && !child.classList.contains('selection-box')) {
            gallery.removeChild(child);
          }
        });

        gallery.appendChild(fragment);
        SelectionManager.updateSelectionUI();

        if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'library') {
          HighlightManager.updateActiveHighlight(state.activeHighlight.mediaId, 'library');
        }
      } catch (error) {
        console.error('[MediaLibraryManager.updateUI] Error:', error);
      }
    },

    // Create media thumbnail element
    createThumbnail(media) {
      try {
        const thumbnail = Utils.createElement('div', {
          className: 'media-thumbnail',
          attributes: {
            'data-id': media.id,
            'draggable': 'true',
            'data-tooltip': `${media.name} (${media.type})`
          }
        });

        // Setup drag handlers - FIXED FOR MULTI-ITEM SUPPORT
        thumbnail.addEventListener('dragstart', (e) => {
          try {
            // Check if this item is part of a multi-selection
            if (state.selection.items.size > 1 && state.selection.items.has(media.id)) {
              // Multiple items selected - use JSON format with all selected IDs
              const selectedIds = Array.from(state.selection.items);
              const dragData = {
                type: 'multiple-media',
                ids: selectedIds
              };

              e.dataTransfer.setData('application/json', JSON.stringify(dragData));
              console.log('[MediaLibraryManager] Dragging multiple items:', selectedIds.length);

              // Add visual feedback for all selected items
              state.dom.mediaGallery.querySelectorAll('.media-thumbnail.selected').forEach(thumb => {
                thumb.classList.add('dragging');
              });
            } else {
              // Single item - use plain text for backward compatibility
              e.dataTransfer.setData('text/plain', media.id);
              console.log('[MediaLibraryManager] Dragging single item:', media.id);
              thumbnail.classList.add('dragging');
            }

            e.dataTransfer.effectAllowed = 'copy';
          } catch (error) {
            console.error('[MediaLibraryManager] dragstart error:', error);
          }
        });

        thumbnail.addEventListener('dragend', () => {
          // Remove dragging class from all thumbnails
          state.dom.mediaGallery.querySelectorAll('.media-thumbnail.dragging').forEach(thumb => {
            thumb.classList.remove('dragging');
          });
        });

        // Image container
        const imgContainer = Utils.createElement('div', {
          className: 'media-thumbnail-img-container',
          style: media.thumbnail ?
              { backgroundImage: `url(${media.thumbnail})` } :
              { backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white', fontWeight: 'bold' }
        });

        if (!media.thumbnail) {
          imgContainer.textContent = media.type.charAt(0).toUpperCase();
        }

        thumbnail.appendChild(imgContainer);

        // Effects indicator
        if (media.settings?.effects?.length > 0) {
          const fxIndicator = Utils.createElement('div', {
            className: 'media-thumbnail-fx-indicator',
            textContent: 'FX'
          });
          thumbnail.appendChild(fxIndicator);
        }

        // Name label
        const nameLabel = Utils.createElement('div', {
          className: 'media-thumbnail-name',
          textContent: media.name
        });
        thumbnail.appendChild(nameLabel);

        // Type badge
        const badge = Utils.createElement('div', {
          className: 'media-type-badge',
          textContent: media.type.toUpperCase()
        });
        thumbnail.appendChild(badge);

        // Delete button
        const deleteBtn = Utils.createElement('button', {
          className: 'media-delete-btn btn btn-icon btn-danger',
          innerHTML: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
          attributes: { 'aria-label': `Delete ${media.name}` }
        });
        thumbnail.appendChild(deleteBtn);

        return thumbnail;
      } catch (error) {
        console.error('[MediaLibraryManager.createThumbnail] Error:', error);
        return Utils.createElement('div', { className: 'media-thumbnail error' });
      }
    },

    // Delete media item
    deleteMedia(id, suppressNotification = false) {
      try {
        const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id);
        if (indexInLibrary === -1) return;

        const mediaToDelete = state.mediaLibrary[indexInLibrary];

        // Revoke object URLs
        if (mediaToDelete.url && mediaToDelete.url.startsWith('blob:')) {
          URL.revokeObjectURL(mediaToDelete.url);
        }
        if (mediaToDelete.thumbnail && mediaToDelete.thumbnail.startsWith('blob:')) {
          URL.revokeObjectURL(mediaToDelete.thumbnail);
        }

        // Remove from library
        state.mediaLibrary.splice(indexInLibrary, 1);

        // Update playlist
        PlaylistManager.removeMediaFromPlaylist(id);

        // Update UI
        if (state.mediaLibrary.length === 0) {
          PlaylistManager.clearPlaylist(true);
        } else {
          PlaylistManager.updateUI();
        }

        this.updateUI();
        StorageManager.saveData();

        if (!suppressNotification) {
          Utils.showNotification(`Deleted: ${mediaToDelete.name}`, 'info');
        }

        SelectionManager.clearSelection();
      } catch (error) {
        console.error('[MediaLibraryManager.deleteMedia] Error:', error);
      }
    },

    // Handle media deletion (single or multiple)
    handleMediaDelete(media) {
      try {
        const mediaId = media.id;

        if (state.selection.items.has(mediaId) && state.selection.items.size > 1) {
          const itemsToDelete = Array.from(state.selection.items);
          itemsToDelete.forEach(id => this.deleteMedia(id, true));
          SelectionManager.clearSelection();
          Utils.showNotification(`${itemsToDelete.length} items deleted.`, 'info');
        } else {
          this.deleteMedia(mediaId);
        }
      } catch (error) {
        console.error('[MediaLibraryManager.handleMediaDelete] Error:', error);
      }
    }
  };

  // Playlist Manager - Enhanced playlist operations
  const PlaylistManager = {
    // Add item to playlist
    addItem(mediaId, insertAtIndex = -1) {
      try {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (!media) {
          Utils.showNotification(`Media ${mediaId} not found.`, 'warning');
          return;
        }

        const wasEmpty = state.playlist.items.length === 0;

        if (insertAtIndex === -1 || insertAtIndex >= state.playlist.items.length) {
          state.playlist.items.push(mediaId);
        } else {
          state.playlist.items.splice(insertAtIndex, 0, mediaId);

          // Update current index if necessary
          if (state.playlist.isPlaying && insertAtIndex <= state.playlist.currentIndex) {
            state.playlist.currentIndex++;
          }

          // Update transitions
          this.updateTransitionsAfterInsert(insertAtIndex);
        }

        if (wasEmpty && state.playlist.items.length > 0) {
          state.playlist.currentIndex = 0;
        }

        this.updateUI();
        StorageManager.saveData();
        Utils.showNotification(`Added to playlist: ${media.name}`, 'success');
      } catch (error) {
        console.error('[PlaylistManager.addItem] Error:', error);
      }
    },

    // Remove item from playlist
    removeItem(index) {
      try {
        if (index < 0 || index >= state.playlist.items.length) return;

        state.playlist.items.splice(index, 1);

        // Update transitions
        this.updateTransitionsAfterRemoval(index);

        // Handle current playing item
        if (state.playlist.isPlaying) {
          if (index === state.playlist.currentIndex) {
            if (state.playlist.items.length > 0) {
              state.playlist.currentIndex = Math.min(index, state.playlist.items.length - 1);
              MediaPlayer.playByIndex(state.playlist.currentIndex);
            } else {
              MediaPlayer.stopPlaylist();
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

        this.updateUI();
        StorageManager.saveData();
      } catch (error) {
        console.error('[PlaylistManager.removeItem] Error:', error);
      }
    },

    // Reorder playlist item
    reorderItem(fromIndex, toIndex) {
      try {
        // Validate indices
        if (fromIndex < 0 || fromIndex >= state.playlist.items.length ||
            toIndex < 0 || toIndex > state.playlist.items.length ||
            fromIndex === toIndex) {
          return;
        }

        // Adjust toIndex for the removal of the item
        const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;

        // Move the item
        const [itemToMove] = state.playlist.items.splice(fromIndex, 1);
        state.playlist.items.splice(adjustedToIndex, 0, itemToMove);

        // Update current index
        if (state.playlist.currentIndex === fromIndex) {
          state.playlist.currentIndex = adjustedToIndex;
        } else if (fromIndex < state.playlist.currentIndex && adjustedToIndex >= state.playlist.currentIndex) {
          state.playlist.currentIndex--;
        } else if (fromIndex > state.playlist.currentIndex && adjustedToIndex <= state.playlist.currentIndex) {
          state.playlist.currentIndex++;
        }

        this.updateUI();
        StorageManager.saveData();
      } catch (error) {
        console.error('[PlaylistManager.reorderItem] Error:', error);
      }
    },

    // Remove media from playlist when deleted from library
    removeMediaFromPlaylist(mediaId) {
      try {
        let wasPlayingDeletedItem = false;
        const newPlaylistItems = [];
        const newTransitions = {};
        let oldCurrentIndex = state.playlist.currentIndex;
        let newCurrentIndex = -1;

        for (let i = 0; i < state.playlist.items.length; i++) {
          const currentItemId = state.playlist.items[i];
          if (currentItemId === mediaId) {
            if (state.playlist.isPlaying && i === oldCurrentIndex) {
              wasPlayingDeletedItem = true;
            }
          } else {
            const newItemNewIndex = newPlaylistItems.length;
            newPlaylistItems.push(currentItemId);
            if (state.playlist.transitions[i]) {
              newTransitions[newItemNewIndex] = state.playlist.transitions[i];
            }
            if (i === oldCurrentIndex) {
              newCurrentIndex = newItemNewIndex;
            }
          }
        }

        state.playlist.items = newPlaylistItems;
        state.playlist.transitions = newTransitions;

        if (wasPlayingDeletedItem) {
          if (state.playlist.items.length > 0) {
            state.playlist.currentIndex = Math.min(oldCurrentIndex, state.playlist.items.length - 1);
            MediaPlayer.playByIndex(state.playlist.currentIndex);
          } else {
            MediaPlayer.stopPlaylist();
            state.playlist.currentIndex = -1;
          }
        } else {
          state.playlist.currentIndex = newCurrentIndex;
          if (state.playlist.items.length === 0) {
            state.playlist.currentIndex = -1;
            MediaPlayer.stopPlaylist();
          } else if (state.playlist.currentIndex === -1 && oldCurrentIndex >= state.playlist.items.length) {
            state.playlist.currentIndex = state.playlist.items.length - 1;
          }
        }
      } catch (error) {
        console.error('[PlaylistManager.removeMediaFromPlaylist] Error:', error);
      }
    },

    // Update transitions after item insertion
    updateTransitionsAfterInsert(insertIndex) {
      try {
        const newTransitions = {};
        Object.keys(state.playlist.transitions).sort((a, b) => parseInt(b) - parseInt(a)).forEach(keyStr => {
          const oldKey = parseInt(keyStr);
          const transData = state.playlist.transitions[oldKey];
          if (oldKey >= insertIndex) {
            newTransitions[oldKey + 1] = transData;
          } else {
            newTransitions[oldKey] = transData;
          }
        });
        state.playlist.transitions = newTransitions;
      } catch (error) {
        console.error('[PlaylistManager.updateTransitionsAfterInsert] Error:', error);
      }
    },

    // Update transitions after item removal
    updateTransitionsAfterRemoval(index) {
      try {
        const newTransitions = {};
        for (const key in state.playlist.transitions) {
          const oldKey = parseInt(key);
          if (oldKey === index) continue;
          if (oldKey > index) {
            newTransitions[oldKey - 1] = state.playlist.transitions[key];
          } else {
            newTransitions[oldKey] = state.playlist.transitions[key];
          }
        }
        state.playlist.transitions = newTransitions;
      } catch (error) {
        console.error('[PlaylistManager.updateTransitionsAfterRemoval] Error:', error);
      }
    },

    // Clear playlist
    clearPlaylist(suppressConfirmation = false) {
      try {
        if (!suppressConfirmation && state.playlist.items.length === 0) {
          Utils.showNotification('Playlist is already empty.', 'info');
          return;
        }

        if (!suppressConfirmation) {
          if (typeof WallpaperApp !== 'undefined' && WallpaperApp.UI?.showModal) {
            WallpaperApp.UI.showModal({
              id: 'confirm-clear-playlist-modal',
              title: 'Confirm Clear Playlist',
              content: 'Are you sure you want to clear the entire playlist? This action cannot be undone.',
              footerButtons: [
                { text: 'Clear', classes: 'btn-danger', onClick: () => { this.clearPlaylist(true); return true; } },
                { text: 'Cancel', classes: 'btn-secondary', onClick: () => true }
              ]
            });
          } else if (confirm('Are you sure you want to clear the entire playlist?')) {
            this.clearPlaylist(true);
          }
          return;
        }

        MediaPlayer.stopPlaylist();
        state.playlist.items = [];
        state.playlist.transitions = {};
        state.playlist.currentIndex = -1;
        state.playlist.playedInShuffle.clear();

        this.updateUI();
        StorageManager.saveData();
        Utils.showNotification('Playlist cleared.', 'info');
      } catch (error) {
        console.error('[PlaylistManager.clearPlaylist] Error:', error);
      }
    },

    // Toggle shuffle mode
    toggleShuffle() {
      try {
        state.playlist.shuffle = !state.playlist.shuffle;

        if (state.playlist.shuffle) {
          state.playlist.playedInShuffle.clear();
          if (state.playlist.isPlaying && state.playlist.items.length > 0 && state.playlist.currentIndex >= 0) {
            const currentMediaId = state.playlist.items[state.playlist.currentIndex];
            if (currentMediaId) state.playlist.playedInShuffle.add(currentMediaId);
          }
        }

        this.updateUI();
        StorageManager.saveData();
        Utils.showNotification(state.playlist.shuffle ? 'Shuffle: On' : 'Shuffle: Off', 'info');
      } catch (error) {
        console.error('[PlaylistManager.toggleShuffle] Error:', error);
      }
    },

    // Update playlist UI
    updateUI() {
      try {
        const playlistCont = state.dom.playlistContainer;
        const emptySt = state.dom.playlistEmptyState;
        const controlsCont = state.dom.playlistControlsContainer;

        if (!playlistCont || !emptySt || !controlsCont) {
          console.error("Playlist UI elements missing for update.");
          return;
        }

        const fragment = document.createDocumentFragment();

        if (state.playlist.items.length === 0) {
          emptySt.style.display = 'block';
          controlsCont.style.visibility = 'hidden';
        } else {
          emptySt.style.display = 'none';
          controlsCont.style.visibility = 'visible';

          // Add transition zone before first item
          fragment.appendChild(this.createTransitionZone(0));

          // Add playlist items with transition zones
          state.playlist.items.forEach((mediaId, index) => {
            const media = state.mediaLibrary.find(m => m.id === mediaId);
            if (media) {
              fragment.appendChild(this.createPlaylistItem(media, index));
            }
            if (index < state.playlist.items.length - 1) {
              fragment.appendChild(this.createTransitionZone(index + 1));
            }
          });
        }

        // Remove old playlist items and transition zones
        Array.from(playlistCont.querySelectorAll('.playlist-item, .playlist-transition-zone')).forEach(child => child.remove());
        playlistCont.appendChild(fragment);

        // Update control buttons
        this.updateControlButtons();

        // Update active highlight
        if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'playlist') {
          HighlightManager.updateActiveHighlight(state.activeHighlight.mediaId, 'playlist');
        }
      } catch (error) {
        console.error('[PlaylistManager.updateUI] Error:', error);
      }
    },

    // Create playlist item element
    createPlaylistItem(media, index) {
      try {
        const item = Utils.createElement('div', {
          className: 'playlist-item',
          attributes: { 'data-id': media.id, 'data-index': index.toString(), draggable: 'true' }
        });

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
        });

        // Thumbnail
        const thumbDiv = Utils.createElement('div', {
          className: 'playlist-item-thumbnail',
          style: media.thumbnail ?
              { backgroundImage: `url(${media.thumbnail})` } :
              { backgroundColor: '#333' }
        });

        if (!media.thumbnail) {
          thumbDiv.textContent = media.type.charAt(0).toUpperCase();
        }
        item.appendChild(thumbDiv);

        // Info container
        const infoCont = Utils.createElement('div', { className: 'playlist-item-info' });
        const nameEl = Utils.createElement('div', { className: 'playlist-item-name', textContent: media.name });
        const detailsEl = Utils.createElement('div', {
          className: 'playlist-item-details',
          textContent: `${media.type.charAt(0).toUpperCase() + media.type.slice(1)} · ${Utils.formatFileSize(media.size)}`
        });
        infoCont.appendChild(nameEl);
        infoCont.appendChild(detailsEl);
        item.appendChild(infoCont);

        // Controls wrapper
        const controlsWrap = Utils.createElement('div', { className: 'playlist-item-controls-wrap' });

        // Set transition button
        const setTransitionButton = Utils.createElement('button', {
          className: 'btn btn-icon playlist-item-set-transition-btn',
          innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V6h2v12H4zm4 0V6h8v12H8zm10 0V6h2v12h-2z"></path></svg>',
          attributes: { 'aria-label': `Set transition after ${media.name}`, title: 'Set Outro Transition' }
        });
        controlsWrap.appendChild(setTransitionButton);

        // Delete button
        const deleteBtn = Utils.createElement('button', {
          className: 'btn btn-icon btn-danger playlist-item-delete',
          innerHTML: '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
          attributes: { 'aria-label': `Remove ${media.name} from playlist` }
        });
        controlsWrap.appendChild(deleteBtn);
        item.appendChild(controlsWrap);

        // Add playing indicator if current
        if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
          item.classList.add('current');
          const playingInd = Utils.createElement('div', {
            className: 'playlist-item-playing-indicator',
            innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>'
          });
          thumbDiv.appendChild(playingInd);
        }

        // Update transition button if transition exists
        const outroTransitionData = state.playlist.transitions[index];
        if (outroTransitionData) {
          const transInfo = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === outroTransitionData.transitionId);
          setTransitionButton.innerHTML = `<span style="font-size: 0.7em; color: var(--primary-color);">${transInfo ? transInfo.name.substring(0,1).toUpperCase() : 'T'}</span>`;
          setTransitionButton.title = `Transition After: ${transInfo ? transInfo.name : 'Custom'}`;
          setTransitionButton.classList.add('has-transition');
        }

        return item;
      } catch (error) {
        console.error('[PlaylistManager.createPlaylistItem] Error:', error);
        return Utils.createElement('div', { className: 'playlist-item error' });
      }
    },

    // Create transition zone element
    createTransitionZone(index) {
      try {
        const zone = Utils.createElement('div', {
          className: 'playlist-transition-zone professional-style',
          attributes: { 'data-index': index.toString(), title: 'Click to add or edit transition' }
        });

        const transitionData = state.playlist.transitions[index];
        if (transitionData) {
          const transInfo = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionData.transitionId);
          const transDisplay = Utils.createElement('div', {
            className: 'transition-display active professional-display',
            innerHTML: `<span class="transition-icon-active">${transInfo?.name.substring(0,1).toUpperCase() || 'T'}</span><span class="transition-name-active">${transInfo?.name || 'Transition'}</span><span class="transition-duration-active">${transitionData.params.duration || 'N/A'}ms</span>`
          });
          zone.appendChild(transDisplay);
        } else {
          const addBtn = Utils.createElement('div', {
            className: 'transition-add-placeholder professional-add',
            innerHTML: '<svg class="transition-add-icon-svg" viewBox="0 0 20 20" width="18" height="18" fill="currentColor" style="display: block; margin: auto; opacity: 0.7;"><rect x="1" y="5" width="11" height="7" rx="1" ry="1" fill-opacity="0.6"/><rect x="7" y="8" width="11" height="7" rx="1" ry="1" fill-opacity="0.6"/><rect x="8" y="6.5" width="2" height="6" fill="rgba(255,255,255,0.9)"/><rect x="6" y="8.5" width="6" height="2" fill="rgba(255,255,255,0.9)"/></svg>'
          });
          zone.appendChild(addBtn);
        }

        zone.addEventListener('click', (e) => {
          e.stopPropagation();
          ContextualManager.showInlinePanel(e, index, 'transition', zone);
        });

        return zone;
      } catch (error) {
        console.error('[PlaylistManager.createTransitionZone] Error:', error);
        return Utils.createElement('div', { className: 'playlist-transition-zone error' });
      }
    },

    // Update control buttons state
    updateControlButtons() {
      try {
        const shuffleBtn = document.getElementById('playlist-shuffle-button');
        if (shuffleBtn) {
          shuffleBtn.classList.toggle('active', state.playlist.shuffle);
          shuffleBtn.innerHTML = state.playlist.shuffle ?
              '<span style="filter: grayscale(0%); color: var(--primary-color);">🔀</span> Shuffle On' :
              '<span style="filter: grayscale(100%);">🔀</span> Shuffle Off';
        }

        const playBtn = document.getElementById('playlist-play-button');
        if (playBtn) {
          playBtn.innerHTML = state.playlist.isPlaying ?
              '<span style="filter: grayscale(100%);">⏸</span> Pause' :
              '<span style="filter: grayscale(100%);">▶</span> Play All';
        }
      } catch (error) {
        console.error('[PlaylistManager.updateControlButtons] Error:', error);
      }
    }
  };

  // Storage Manager - Handle data persistence
  const StorageManager = {
    // Save media data to localStorage
    saveData() {
      try {
        const mediaForStorage = state.mediaLibrary.map(media => {
          const { url, thumbnail, ...mediaMeta } = media;
          return {
            ...mediaMeta,
            originalUrlExists: !!url,
            originalThumbnailExists: !!thumbnail,
            settings: media.settings || { effects: [] }
          };
        });

        const storageData = {
          media: mediaForStorage,
          playlist: {
            items: state.playlist.items,
            shuffle: state.playlist.shuffle,
            transitions: state.playlist.transitions || {}
          }
        };

        localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(storageData));
      } catch (e) {
        console.error('Failed to save media list:', e);
        Utils.showNotification('Error saving library.', 'error');
      }
    },

    // Load saved media data
    loadData() {
      try {
        const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);

        if (!saved) {
          // Check for old data
          const oldSaved = localStorage.getItem(CONSTANTS.STORAGE_KEY_OLD);
          if (oldSaved) {
            try {
              const oldParsed = JSON.parse(oldSaved);
              if (oldParsed.media?.length > 0) {
                Utils.showNotification("Found old library data. Re-import files.", 'warning', 10000);
              }
              localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
            } catch (oldErr) {
              console.warn("Error parsing old data, removing:", oldErr);
              localStorage.removeItem(CONSTANTS.STORAGE_KEY_OLD);
            }
          }

          MediaLibraryManager.updateUI();
          PlaylistManager.updateUI();
          return;
        }

        const parsed = JSON.parse(saved);

        if (parsed.media?.length > 0) {
          Utils.showNotification(`Loaded metadata for ${parsed.media.length} entries. Re-import files.`, 'info', 7000);
        }

        // Restore media library with fallback thumbnails
        state.mediaLibrary = (parsed.media || []).map(media => ({
          ...media,
          url: null,
          thumbnail: FileHandler.createFallbackThumbnail(media.type),
          settings: media.settings || { effects: [] }
        }));

        // Restore playlist
        state.playlist.items = parsed.playlist?.items || [];
        state.playlist.shuffle = parsed.playlist?.shuffle || false;
        state.playlist.transitions = parsed.playlist?.transitions || {};

        MediaLibraryManager.updateUI();
        PlaylistManager.updateUI();
      } catch (e) {
        console.error('Failed to load media:', e);
        localStorage.removeItem(CONSTANTS.STORAGE_KEY);
        MediaLibraryManager.updateUI();
        PlaylistManager.updateUI();
        Utils.showNotification('Error loading saved media.', 'error');
      }
    }
  };

  // Media Player - Handle playback functionality
  const MediaPlayer = {
    // Select and play media
    selectMedia(media, loopSingle = false) {
      try {
        this.stopPlaylist(false);
        this.clearDisplay();

        const element = this.createMediaElement(media, !loopSingle, loopSingle);
        if (element) {
          state.dom.mediaContainer.appendChild(element);
          Utils.showNotification(`Playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');

          state.playlist.isPlaying = !loopSingle;

          if (loopSingle) {
            state.playlist.currentIndex = -1;
            HighlightManager.updateActiveHighlight(media.id, 'library');
          } else {
            const playlistIdx = state.playlist.items.indexOf(media.id);
            if (playlistIdx !== -1) {
              state.playlist.currentIndex = playlistIdx;
              HighlightManager.updateActiveHighlight(media.id, 'playlist');
            } else {
              state.playlist.currentIndex = -1;
              HighlightManager.updateActiveHighlight(media.id, 'library');
            }
          }

          PlaylistManager.updateUI();
        } else {
          Utils.showNotification(`Cannot play ${media.name}.`, 'error');
        }
      } catch (error) {
        console.error('[MediaPlayer.selectMedia] Error:', error);
      }
    },

    // Create media element for playback
    createMediaElement(media, isPlaylistContext = false, loopOverride = false) {
      try {
        let element;
        if (!media || !media.type || !media.url) {
          console.error("Invalid media data for element creation.", media);
          return null;
        }

        state.activeVideoElement = null;

        if (media.type === 'image') {
          element = Utils.createElement('img', {
            attributes: { src: media.url, alt: media.name },
            style: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' }
          });

          if (isPlaylistContext) {
            this.clearPlaybackTimers();
            state.playlist.playbackTimer = setTimeout(() => {
              if (state.playlist.isPlaying) this.playNextItem();
            }, CONSTANTS.IMAGE_DISPLAY_DURATION);
          }
        } else if (media.type === 'video') {
          element = document.createElement('video');
          element.src = media.url;
          element.autoplay = true;
          element.loop = loopOverride;
          element.muted = true;
          element.dataset.mediaId = media.id;
          Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });

          element.addEventListener('error', function(e) {
            console.error(`Error loading video: ${media.name}`, e.target.error);
            if (isPlaylistContext && state.playlist.isPlaying) {
              setTimeout(() => MediaPlayer.playNextItem(), 100);
            }
          });

          if (isPlaylistContext && !loopOverride) {
            element.addEventListener('ended', () => {
              if (state.playlist.isPlaying) MediaPlayer.playNextItem();
            });
          }

          state.activeVideoElement = element;
        }

        // Apply effects
        if (media.settings?.effects?.length > 0 && element) {
          this.applyEffectsToElement(element, media.settings.effects);
        } else if (element) {
          element.style.filter = 'none';
        }

        return element;
      } catch (error) {
        console.error('[MediaPlayer.createMediaElement] Error:', error);
        return null;
      }
    },

    // Apply effects to media element
    applyEffectsToElement(element, effects) {
      try {
        let filterString = "";

        effects.forEach(eff => {
          const pVal = eff.params?.intensity !== undefined ? eff.params.intensity :
              (eff.params?.level !== undefined ? eff.params.level : null);
          const intensity = pVal !== null ? parseFloat(pVal) : 100;

          if (eff.effectId === 'blur' && !isNaN(intensity)) {
            filterString += `blur(${intensity/10}px) `;
          }
          if (eff.effectId === 'grayscale' && !isNaN(intensity)) {
            filterString += `grayscale(${intensity}%) `;
          }
          if (eff.effectId === 'sepia' && !isNaN(intensity)) {
            filterString += `sepia(${intensity}%) `;
          }
          if (eff.effectId === 'brightness' && !isNaN(intensity)) {
            filterString += `brightness(${intensity}%) `;
          }
        });

        element.style.filter = filterString.trim() || 'none';
      } catch (error) {
        console.error('[MediaPlayer.applyEffectsToElement] Error:', error);
      }
    },

    // Play playlist
    playPlaylist() {
      try {
        if (state.playlist.items.length === 0) {
          Utils.showNotification('Playlist is empty.', 'info');
          return;
        }

        if (state.playlist.isPlaying) {
          this.pausePlaylist();
          return;
        }

        this.clearPlaybackTimers();
        state.playlist.advancingInProgress = false;
        state.playlist.isPlaying = true;

        if (state.playlist.shuffle) {
          state.playlist.playedInShuffle.clear();
          if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
            state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length);
          }
          const currentMediaIdShuffle = state.playlist.items[state.playlist.currentIndex];
          if (currentMediaIdShuffle) state.playlist.playedInShuffle.add(currentMediaIdShuffle);
        } else {
          if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
            state.playlist.currentIndex = 0;
          }
        }

        this.clearDisplay();
        this.playByIndex(state.playlist.currentIndex);
        PlaylistManager.updateUI();
      } catch (error) {
        console.error('[MediaPlayer.playPlaylist] Error:', error);
      }
    },

    // Pause playlist
    pausePlaylist() {
      try {
        state.playlist.isPlaying = false;
        this.clearPlaybackTimers();

        const videoEl = state.activeVideoElement || state.dom.mediaContainer.querySelector('video');
        if (videoEl && !videoEl.paused) videoEl.pause();

        PlaylistManager.updateUI();
        Utils.showNotification("Playlist paused.", "info");
      } catch (error) {
        console.error('[MediaPlayer.pausePlaylist] Error:', error);
      }
    },

    // Stop playlist
    stopPlaylist(resetIndexAndDisplay = true) {
      try {
        state.playlist.isPlaying = false;
        this.clearPlaybackTimers();

        const videoEl = state.activeVideoElement || state.dom.mediaContainer.querySelector('video');
        if (videoEl) videoEl.pause();

        if (resetIndexAndDisplay) {
          state.playlist.currentIndex = -1;
          this.clearDisplay();
          HighlightManager.updateActiveHighlight(null);
        }

        state.playlist.playedInShuffle.clear();
        PlaylistManager.updateUI();
        state.activeVideoElement = null;
      } catch (error) {
        console.error('[MediaPlayer.stopPlaylist] Error:', error);
      }
    },

    // Play media by index
    playByIndex(index) {
      try {
        if (index < 0 || index >= state.playlist.items.length) {
          if (state.playlist.items.length > 0) {
            index = 0;
            state.playlist.currentIndex = 0;
          } else {
            this.stopPlaylist();
            return;
          }
        }

        const mediaId = state.playlist.items[index];
        const media = state.mediaLibrary.find(m => m.id === mediaId);

        if (!media) {
          Utils.showNotification(`Media "${mediaId}" not found in library. Skipping.`, 'warning');
          if (state.playlist.isPlaying) {
            state.playlist.items.splice(index, 1);
            if (index <= state.playlist.currentIndex) state.playlist.currentIndex--;
            if (state.playlist.items.length === 0) {
              this.stopPlaylist();
              return;
            }
            const nextIdxTry = Math.max(0, Math.min(index, state.playlist.items.length - 1));
            this.playNextItem(nextIdxTry);
          }
          return;
        }

        state.playlist.currentIndex = index;
        state.playlist.isPlaying = true;

        const oldElement = state.dom.mediaContainer.firstChild;
        const newElement = this.createMediaElement(media, true);

        if (!newElement) {
          Utils.showNotification(`Error creating media element for ${media.name}. Skipping.`, "error");
          if (state.playlist.isPlaying) setTimeout(() => this.playNextItem(), 100);
          return;
        }

        // Apply transition if exists
        const transitionData = state.playlist.transitions[index];
        if (oldElement && transitionData && CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionData.transitionId)) {
          this.applyTransition(oldElement, newElement, transitionData);
        } else {
          this.clearDisplay();
          state.dom.mediaContainer.appendChild(newElement);
          if (newElement.tagName.toLowerCase() === 'video' && newElement.paused) {
            newElement.play().catch(e => console.warn("Autoplay prevented:", e));
          }
        }

        HighlightManager.updateActiveHighlight(media.id, 'playlist');
        if (state.playlist.shuffle) state.playlist.playedInShuffle.add(mediaId);
        PlaylistManager.updateUI();
      } catch (error) {
        console.error('[MediaPlayer.playByIndex] Error:', error);
      }
    },

    // Apply transition between media elements
    applyTransition(oldElement, newElement, transitionData) {
      try {
        console.log(`[MediaPlayer] Applying transition: ${transitionData.transitionId}`);

        newElement.style.opacity = '0';
        state.dom.mediaContainer.appendChild(newElement);

        const duration = transitionData.params.duration || 500;
        oldElement.style.transition = `opacity ${duration / 2}ms ease-out`;
        newElement.style.transition = `opacity ${duration / 2}ms ease-in ${duration / 2}ms`;

        requestAnimationFrame(() => {
          oldElement.style.opacity = '0';
          newElement.style.opacity = '1';
        });

        setTimeout(() => {
          if (oldElement.parentNode) oldElement.parentNode.removeChild(oldElement);
          if (newElement.tagName.toLowerCase() === 'video' && newElement.paused) {
            newElement.play().catch(e => console.warn("Autoplay prevented during transition:", e));
          }
        }, duration);

        state.playlist.lastTransitionTime = Date.now();
      } catch (error) {
        console.error('[MediaPlayer.applyTransition] Error:', error);
      }
    },

    // Play next item in playlist
    playNextItem(startIndex = -1) {
      try {
        if (!state.playlist.isPlaying || state.playlist.items.length === 0) {
          this.stopPlaylist();
          return;
        }

        if (state.playlist.advancingInProgress) return;

        state.playlist.advancingInProgress = true;
        this.clearPlaybackTimers();

        let nextIndex;

        if (state.playlist.shuffle) {
          if (state.playlist.playedInShuffle.size >= state.playlist.items.length) {
            state.playlist.playedInShuffle.clear();
            console.log("[MediaPlayer] Shuffle cycle complete, resetting played items.");
          }

          const availableItems = state.playlist.items.filter(id => !state.playlist.playedInShuffle.has(id));
          if (availableItems.length === 0) {
            state.playlist.playedInShuffle.clear();
            if (state.playlist.items.length > 0) {
              const randomAvailId = state.playlist.items[Math.floor(Math.random() * state.playlist.items.length)];
              nextIndex = state.playlist.items.indexOf(randomAvailId);
            } else {
              this.stopPlaylist();
              return;
            }
          } else {
            const randomAvailId = availableItems[Math.floor(Math.random() * availableItems.length)];
            nextIndex = state.playlist.items.indexOf(randomAvailId);
          }
        } else {
          nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
        }

        if (startIndex !== -1 && startIndex >= 0 && startIndex < state.playlist.items.length) {
          nextIndex = startIndex;
        }

        state.playlist.currentIndex = nextIndex;
        this.playByIndex(nextIndex);

        setTimeout(() => {
          state.playlist.advancingInProgress = false;
        }, 200);
      } catch (error) {
        console.error('[MediaPlayer.playNextItem] Error:', error);
        state.playlist.advancingInProgress = false;
      }
    },

    // Clear playback timers
    clearPlaybackTimers() {
      if (state.playlist.playbackTimer) {
        clearTimeout(state.playlist.playbackTimer);
        state.playlist.playbackTimer = null;
      }
    },

    // Clear media display
    clearDisplay() {
      try {
        this.clearPlaybackTimers();
        state.activeVideoElement = null;

        const container = state.dom.mediaContainer;
        while (container.firstChild) {
          const el = container.firstChild;
          if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) {
            el.pause();
            el.removeAttribute('src');
            el.load();
          }
          container.removeChild(el);
        }
      } catch (e) {
        console.error("Error clearing media display:", e);
        if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = '';
      }
    }
  };

  // Highlight Manager - Handle active media highlighting
  const HighlightManager = {
    updateActiveHighlight(mediaId, sourceType) {
      try {
        this.removeAllHighlights();

        if (!mediaId) {
          state.activeHighlight.mediaId = null;
          state.activeHighlight.sourceType = null;
          return;
        }

        state.activeHighlight.mediaId = mediaId;
        state.activeHighlight.sourceType = sourceType;

        let elementToHighlight;

        if (sourceType === 'library') {
          if (state.dom.mediaGallery) {
            elementToHighlight = state.dom.mediaGallery.querySelector(`.media-thumbnail[data-id="${mediaId}"]`);
          }
        } else if (sourceType === 'playlist') {
          if (state.dom.playlistContainer) {
            const playlistElements = state.dom.playlistContainer.querySelectorAll('.playlist-item');
            playlistElements.forEach((el) => {
              if (el.dataset.id === mediaId && parseInt(el.dataset.index) === state.playlist.currentIndex) {
                elementToHighlight = el;
                el.classList.add('current');
                const thumbDiv = el.querySelector('.playlist-item-thumbnail');
                if (state.playlist.isPlaying && thumbDiv) {
                  const existingInd = thumbDiv.querySelector('.playlist-item-playing-indicator');
                  if (!existingInd) {
                    const newInd = Utils.createElement('div', {
                      className: 'playlist-item-playing-indicator',
                      innerHTML: '<span style="filter: grayscale(100%); font-size: 0.8em;">▶</span>'
                    });
                    thumbDiv.appendChild(newInd);
                  }
                }
              } else {
                el.classList.remove('current');
                const indicator = el.querySelector('.playlist-item-playing-indicator');
                if (indicator) indicator.remove();
              }
            });
          }
        }

        if (elementToHighlight) {
          elementToHighlight.classList.add('playing-from-here');
        }
      } catch (error) {
        console.error('[HighlightManager.updateActiveHighlight] Error:', error);
      }
    },

    removeAllHighlights() {
      try {
        document.querySelectorAll('.media-thumbnail.playing-from-here, .playlist-item.playing-from-here').forEach(el => {
          el.classList.remove('playing-from-here');
        });

        if (state.dom.playlistContainer) {
          state.dom.playlistContainer.querySelectorAll('.playlist-item.current').forEach(el => {
            el.classList.remove('current');
            const indicator = el.querySelector('.playlist-item-playing-indicator');
            if (indicator) indicator.remove();
          });
        }
      } catch (error) {
        console.error('[HighlightManager.removeAllHighlights] Error:', error);
      }
    }
  };

  // Contextual Manager - Handle context menus and inline panels
  const ContextualManager = {
    // Show context menu
    showContextMenu(event, targetId, type, anchorElement) {
      try {
        this.hideContextMenu();
        this.hideInlinePanel();

        if (type !== 'transition_per_clip') {
          WallpaperApp.MenuTools.closePerClipTransitionsPanel();
        }

        const menu = state.dom.contextMenuContainer;
        if (!menu) {
          console.error("Context menu container not found.");
          return;
        }

        menu.innerHTML = '';
        menu.style.display = 'block';

        const importSubmenuRect = state.dom.importSubmenu.getBoundingClientRect();
        let x = event.clientX - importSubmenuRect.left;
        let y = event.clientY - importSubmenuRect.top;

        const menuWidth = 180;
        const menuHeight = 50;

        // Boundary checks
        if (x + menuWidth > importSubmenuRect.width) x = importSubmenuRect.width - menuWidth - 5;
        if (y + menuHeight > importSubmenuRect.height) y = importSubmenuRect.height - menuHeight - 5;
        if (x < 0) x = 5;
        if (y < 0) y = 5;

        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        state.contextualEditing.contextMenuElement = menu;
        state.contextualEditing.targetId = targetId;
        state.contextualEditing.type = type;
        state.contextualEditing.activeItem = null;

        if (type === 'effect') {
          const editEffectsButton = Utils.createElement('button', {
            textContent: 'Add/Edit Effect',
            className: 'context-menu-item',
            events: {
              click: () => {
                this.hideContextMenu();
                this.showInlinePanel(event, targetId, 'effect', anchorElement);
              }
            }
          });
          menu.appendChild(editEffectsButton);
        }
      } catch (error) {
        console.error('[ContextualManager.showContextMenu] Error:', error);
      }
    },

    // Hide context menu
    hideContextMenu() {
      try {
        if (state.contextualEditing.contextMenuElement) {
          state.contextualEditing.contextMenuElement.style.display = 'none';
          state.contextualEditing.contextMenuElement.innerHTML = '';
        }
        state.contextualEditing.contextMenuElement = null;
      } catch (error) {
        console.error('[ContextualManager.hideContextMenu] Error:', error);
      }
    },

    // Show inline panel
    showInlinePanel(event, targetId, type, anchorElement) {
      try {
        this.hideInlinePanel();
        this.hideContextMenu();
        WallpaperApp.MenuTools.closePerClipTransitionsPanel();

        const panel = state.dom.inlinePanelContainer;
        if (!panel) {
          console.error("Inline panel container not found.");
          return;
        }

        panel.innerHTML = '';
        panel.style.display = 'block';

        state.contextualEditing.panelElement = panel;
        state.contextualEditing.targetId = targetId;
        state.contextualEditing.type = type;
        state.contextualEditing.activeItem = null;

        // Position panel
        if (anchorElement && state.dom.importSubmenu) {
          const anchorRect = anchorElement.getBoundingClientRect();
          const submenuRect = state.dom.importSubmenu.getBoundingClientRect();

          let panelTop = anchorRect.bottom - submenuRect.top + 5;
          let panelLeft = anchorRect.left - submenuRect.left;

          const panelWidth = 280;
          const panelHeightEstimate = 200;

          if (panelLeft + panelWidth > submenuRect.width) {
            panelLeft = anchorRect.right - submenuRect.left - panelWidth;
          }
          if (panelTop + panelHeightEstimate > submenuRect.height) {
            panelTop = anchorRect.top - submenuRect.top - panelHeightEstimate - 5;
          }
          if (panelLeft < 0) panelLeft = 5;
          if (panelTop < 0) panelTop = 5;

          panel.style.top = panelTop + 'px';
          panel.style.left = panelLeft + 'px';
        } else {
          panel.style.top = '50px';
          panel.style.left = '50px';
        }

        // Create panel content
        const mediaItemForTitle = type === 'effect' ? state.mediaLibrary.find(m => m.id === targetId) : null;
        const titleText = type === 'effect' ?
            `Effects for ${mediaItemForTitle?.name || 'Item'}` :
            `Transition before item ${targetId + 1}`;

        const panelTitle = Utils.createElement('div', {
          textContent: titleText,
          className: 'inline-panel-title'
        });
        panel.appendChild(panelTitle);

        const itemsContainer = Utils.createElement('div', { className: 'inline-panel-items' });
        const itemsToList = type === 'effect' ? CONSTANTS.AVAILABLE_EFFECTS : CONSTANTS.AVAILABLE_TRANSITIONS;

        itemsToList.forEach(item => {
          const itemButton = Utils.createElement('button', {
            textContent: item.name,
            className: 'inline-panel-item-button',
            events: {
              click: (e) => {
                itemsContainer.querySelectorAll('.inline-panel-item-button.selected').forEach(btn =>
                    btn.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                state.contextualEditing.activeItem = item;
                this.populateInlinePanelControls(item, type, targetId);
              }
            }
          });
          itemsContainer.appendChild(itemButton);
        });
        panel.appendChild(itemsContainer);

        const controlsContainer = Utils.createElement('div', {
          id: 'inline-panel-controls',
          className: 'inline-panel-controls-container'
        });
        panel.appendChild(controlsContainer);

        // Footer buttons
        const applyButton = Utils.createElement('button', {
          textContent: 'Apply',
          className: 'btn btn-primary btn-small inline-panel-button-apply'
        });
        applyButton.addEventListener('click', () => {
          if (type === 'effect') {
            EffectsManager.applyEffect(targetId);
          } else if (type === 'transition') {
            TransitionManager.applyTransitionFromInlinePanel(targetId);
          }
        });

        const closeButton = Utils.createElement('button', {
          textContent: 'Close',
          className: 'btn btn-secondary btn-small'
        });
        closeButton.addEventListener('click', () => this.hideInlinePanel());

        const footer = Utils.createElement('div', { className: 'inline-panel-footer' });
        footer.appendChild(applyButton);
        footer.appendChild(closeButton);
        panel.appendChild(footer);
      } catch (error) {
        console.error('[ContextualManager.showInlinePanel] Error:', error);
      }
    },

    // Hide inline panel
    hideInlinePanel() {
      try {
        if (state.contextualEditing.panelElement) {
          state.contextualEditing.panelElement.style.display = 'none';
          state.contextualEditing.panelElement.innerHTML = '';
        }

        state.contextualEditing.panelElement = null;
        state.contextualEditing.active = false;
        state.contextualEditing.targetId = null;
        state.contextualEditing.type = null;
        state.contextualEditing.activeItem = null;
      } catch (error) {
        console.error('[ContextualManager.hideInlinePanel] Error:', error);
      }
    },

    // Populate inline panel controls
    populateInlinePanelControls(selectedItem, type, targetId) {
      try {
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
          const paramGroup = Utils.createElement('div', { className: 'form-group inline-param-group' });
          const label = Utils.createElement('label', {
            textContent: param.name,
            attributes: { 'for': `param-${param.id}` }
          });
          paramGroup.appendChild(label);

          let input;
          const currentValue = existingSettingsBundle?.params?.[param.id] !== undefined ?
              existingSettingsBundle.params[param.id] : param.value;

          if (param.type === 'slider') {
            input = Utils.createElement('input', {
              type: 'range',
              id: `param-${param.id}`,
              attributes: {
                min: param.min,
                max: param.max,
                value: currentValue,
                'data-param-id': param.id
              }
            });

            const unitDisplay = param.unit || '';
            const valueSpan = Utils.createElement('span', {
              textContent: `${currentValue}${unitDisplay}`,
              className: 'param-value-display'
            });

            input.addEventListener('input', (e) => {
              valueSpan.textContent = e.target.value + unitDisplay;
            });

            paramGroup.appendChild(input);
            paramGroup.appendChild(valueSpan);
          } else if (param.type === 'select') {
            input = Utils.createElement('select', {
              id: `param-${param.id}`,
              attributes: { 'data-param-id': param.id }
            });

            param.options.forEach(opt => {
              const optionEl = Utils.createElement('option', {
                textContent: opt,
                attributes: { value: opt }
              });
              if (opt === currentValue) optionEl.selected = true;
              input.appendChild(optionEl);
            });

            paramGroup.appendChild(input);
          }

          controlsContainer.appendChild(paramGroup);
        });
      } catch (error) {
        console.error('[ContextualManager.populateInlinePanelControls] Error:', error);
      }
    }
  };

  // Effects Manager - Handle effect application
  const EffectsManager = {
    // Apply effect to media item
    applyEffect(mediaId, effectIdToApply, paramsToApply) {
      try {
        const mediaItem = state.mediaLibrary.find(m => m.id === mediaId);
        if (!mediaItem) return;

        const activeEffectItem = effectIdToApply ?
            CONSTANTS.AVAILABLE_EFFECTS.find(e => e.id === effectIdToApply) :
            state.contextualEditing.activeItem;

        const effectParams = paramsToApply || {};

        if (!effectIdToApply && !paramsToApply) {
          const panel = state.contextualEditing.panelElement;
          if (!panel || !activeEffectItem) {
            Utils.showNotification("No active effect selected or panel not found.", "error");
            return;
          }

          panel.querySelectorAll('#inline-panel-controls [data-param-id]').forEach(inputEl => {
            effectParams[inputEl.dataset.paramId] = inputEl.type === 'range' ?
                parseFloat(inputEl.value) : inputEl.value;
          });
        }

        if (!activeEffectItem) {
          Utils.showNotification("Effect definition not found.", "error");
          return;
        }

        const currentEffectId = activeEffectItem.id;

        if (!mediaItem.settings) mediaItem.settings = {};
        if (!mediaItem.settings.effects) mediaItem.settings.effects = [];

        // Remove existing effect of same type
        mediaItem.settings.effects = mediaItem.settings.effects.filter(eff => eff.effectId !== currentEffectId);

        // Add new effect
        mediaItem.settings.effects.push({ effectId: currentEffectId, params: effectParams });

        Utils.showNotification(`Effect ${activeEffectItem.name} applied to ${mediaItem.name}.`, 'success');
        StorageManager.saveData();
        MediaLibraryManager.updateUI();

        // Update currently displayed element if it matches
        const currentlyDisplayedElement = state.dom.mediaContainer.querySelector(
            `[src="${mediaItem.url}"], video[data-media-id="${mediaId}"]`
        );
        if (currentlyDisplayedElement) {
          MediaPlayer.applyEffectsToElement(currentlyDisplayedElement, mediaItem.settings.effects);
        }
      } catch (error) {
        console.error('[EffectsManager.applyEffect] Error:', error);
      }
    },

    // Get parameters for effect (L2 submenu integration)
    getParamsFor(itemId, itemType, controlsContainerElement, targetApplyId, targetApplyType) {
      try {
        if (!controlsContainerElement) {
          console.error("[EffectsManager.getParamsFor] Controls container element is missing.");
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
          const paramGroup = Utils.createElement('div', { className: 'form-group' });
          const label = Utils.createElement('label', {
            textContent: param.name,
            attributes: { 'for': `l2-param-${param.id}` }
          });
          paramGroup.appendChild(label);

          let input;
          const currentValue = param.value;

          if (param.type === 'slider') {
            input = Utils.createElement('input', {
              type: 'range',
              className: 'parameter-slider',
              id: `l2-param-${param.id}`,
              attributes: {
                min: param.min,
                max: param.max,
                value: currentValue,
                'data-param-id': param.id
              }
            });

            const unitDisplay = param.unit || '';
            const valueSpan = Utils.createElement('span', {
              textContent: `${currentValue}${unitDisplay}`,
              className: 'parameter-value'
            });

            input.addEventListener('input', (e) => {
              valueSpan.textContent = e.target.value + unitDisplay;
            });

            paramGroup.appendChild(input);
            paramGroup.appendChild(valueSpan);
          } else if (param.type === 'select') {
            input = Utils.createElement('select', {
              id: `l2-param-${param.id}`,
              className: 'parameter-select',
              attributes: { 'data-param-id': param.id }
            });

            param.options.forEach(opt => {
              const optionEl = Utils.createElement('option', {
                textContent: opt,
                attributes: { value: opt }
              });
              if (opt === currentValue) optionEl.selected = true;
              input.appendChild(optionEl);
            });

            paramGroup.appendChild(input);
          }

          controlsContainerElement.appendChild(paramGroup);
        });

        const applyBtn = Utils.createElement('button', {
          textContent: 'Apply to Target',
          className: 'btn btn-primary apply-params-btn'
        });

        applyBtn.addEventListener('click', () => {
          if (targetApplyId === null || targetApplyId === undefined) {
            Utils.showNotification(`No target selected to apply ${itemType}. Please select an item.`, 'warning');
            return;
          }

          const collectedParams = {};
          controlsContainerElement.querySelectorAll('[data-param-id]').forEach(inputEl => {
            collectedParams[inputEl.dataset.paramId] = inputEl.type === 'range' ?
                parseFloat(inputEl.value) : inputEl.value;
          });

          if (itemType === 'effect' && targetApplyType === 'effect') {
            this.applyEffect(targetApplyId, itemId, collectedParams);
          } else if (itemType === 'transition' && targetApplyType === 'transition') {
            TransitionManager.applyTransition(targetApplyId, itemId, collectedParams);
          } else {
            Utils.showNotification(`Cannot apply ${itemType}: Mismatched target type or invalid target.`, 'error');
          }
        });

        controlsContainerElement.appendChild(applyBtn);
      } catch (error) {
        console.error('[EffectsManager.getParamsFor] Error:', error);
      }
    }
  };

  // Transition Manager - Handle transition operations
  const TransitionManager = {
    // Apply transition from inline panel
    applyTransitionFromInlinePanel(playlistIndex) {
      try {
        const activeTransitionItem = state.contextualEditing.activeItem;
        const transitionParams = {};
        const panel = state.contextualEditing.panelElement;

        if (!panel || !activeTransitionItem) {
          Utils.showNotification("No active transition selected or panel not found.", "error");
          return;
        }

        panel.querySelectorAll('#inline-panel-controls [data-param-id]').forEach(inputEl => {
          transitionParams[inputEl.dataset.paramId] = inputEl.type === 'range' ?
              parseFloat(inputEl.value) : inputEl.value;
        });

        state.playlist.transitions[playlistIndex] = {
          transitionId: activeTransitionItem.id,
          params: transitionParams
        };

        Utils.showNotification(`Transition ${activeTransitionItem.name} applied before item ${playlistIndex + 1}.`, 'success');
        StorageManager.saveData();
        PlaylistManager.updateUI();
        ContextualManager.hideInlinePanel();
      } catch (error) {
        console.error('[TransitionManager.applyTransitionFromInlinePanel] Error:', error);
      }
    },

    // Apply transition (L2 submenu integration)
    applyTransition(targetIndex, transitionId, params) {
      try {
        const transitionDefinition = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionId);
        if (!transitionDefinition) {
          Utils.showNotification(`Transition definition for ID "${transitionId}" not found.`, "error");
          return;
        }

        state.playlist.transitions[targetIndex] = {
          transitionId: transitionId,
          params: params
        };

        Utils.showNotification(`Transition "${transitionDefinition.name}" applied before item ${targetIndex + 1} (via L2).`, 'success');
        StorageManager.saveData();
        PlaylistManager.updateUI();
      } catch (error) {
        console.error('[TransitionManager.applyTransition] Error:', error);
      }
    },

    // Apply outro transition for per-clip panel
    applyOutroTransition(playlistItemIndex, transitionId) {
      try {
        const transitionDefinition = CONSTANTS.AVAILABLE_TRANSITIONS.find(t => t.id === transitionId);
        if (!transitionDefinition) {
          Utils.showNotification(`Transition definition for ID "${transitionId}" not found.`, "error");
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
        const targetName = mediaItem ? mediaItem.name : `item ${playlistItemIndex + 1}`;

        Utils.showNotification(`Transition '${transitionDefinition.name}' set for '${targetName}'.`, 'success');
        StorageManager.saveData();
        PlaylistManager.updateUI();
        WallpaperApp.MenuTools.closePerClipTransitionsPanel();
      } catch (error) {
        console.error('[TransitionManager.applyOutroTransition] Error:', error);
      }
    },

    // Populate per-clip transitions panel
    populatePerClipTransitions(playlistItemIndex) {
      try {
        if (!state.dom.perClipTransitionsList) {
          console.error("[TransitionManager.populatePerClipTransitions] Panel list element not found.");
          return;
        }

        state.dom.perClipTransitionsList.innerHTML = '';
        state.contextualEditing.perClipTargetIndex = playlistItemIndex;

        const currentTransitionData = state.playlist.transitions[playlistItemIndex];

        CONSTANTS.AVAILABLE_TRANSITIONS.forEach(transitionDef => {
          const button = Utils.createElement('button', {
            className: 'submenu-item',
            textContent: transitionDef.name,
            attributes: { 'data-transition-id': transitionDef.id }
          });

          if (currentTransitionData && currentTransitionData.transitionId === transitionDef.id) {
            button.classList.add('selected');
          }

          button.addEventListener('click', () => {
            this.applyOutroTransition(state.contextualEditing.perClipTargetIndex, transitionDef.id);
          });

          state.dom.perClipTransitionsList.appendChild(button);
        });

        // Remove transition button
        const removeButton = Utils.createElement('button', {
          className: 'submenu-item btn-danger',
          textContent: 'Remove Transition'
        });

        if (!currentTransitionData) {
          removeButton.classList.add('disabled');
        }

        removeButton.addEventListener('click', () => {
          if (currentTransitionData) {
            delete state.playlist.transitions[state.contextualEditing.perClipTargetIndex];

            const mediaItem = state.mediaLibrary.find(m =>
                m.id === state.playlist.items[state.contextualEditing.perClipTargetIndex]);
            const targetName = mediaItem ?
                mediaItem.name :
                `item ${state.contextualEditing.perClipTargetIndex + 1}`;

            Utils.showNotification(`Transition removed for '${targetName}'.`, 'info');
            StorageManager.saveData();
            PlaylistManager.updateUI();
          }
          WallpaperApp.MenuTools.closePerClipTransitionsPanel();
        });

        state.dom.perClipTransitionsList.appendChild(Utils.createDivider());
        state.dom.perClipTransitionsList.appendChild(removeButton);
      } catch (error) {
        console.error('[TransitionManager.populatePerClipTransitions] Error:', error);
      }
    }
  };

  // Event Handler - Central event handling
  const EventHandler = {
    // Setup global event delegation
    setupGlobalEvents() {
      try {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Shift') state.selection.shiftKeyActive = true;
        });

        document.addEventListener('keyup', (e) => {
          if (e.key === 'Shift') state.selection.shiftKeyActive = false;
        });

        // Global click handler
        document.addEventListener('click', (e) => {
          if (state.contextualEditing.contextMenuElement &&
              state.contextualEditing.contextMenuElement.style.display !== 'none' &&
              !state.contextualEditing.contextMenuElement.contains(e.target) &&
              !e.target.closest('.media-thumbnail')) {
            ContextualManager.hideContextMenu();
          }

          if (state.contextualEditing.panelElement &&
              state.contextualEditing.panelElement.style.display !== 'none' &&
              !state.contextualEditing.panelElement.contains(e.target) &&
              !e.target.closest('.media-thumbnail') &&
              !e.target.closest('.parameter-controls-container')) {
            ContextualManager.hideInlinePanel();
          }
        }, true);

        // Setup submenu event delegation
        this.setupSubmenuEvents();
      } catch (error) {
        console.error('[EventHandler.setupGlobalEvents] Error:', error);
      }
    },

    // Setup submenu-specific events
    setupSubmenuEvents() {
      if (state.dom.importSubmenu) {
        state.dom.importSubmenu.addEventListener('click', (e) => {
          const target = e.target.closest('button');
          if (!target) return;

          if (target.matches('.import-media-button')) {
            if (state.fileInput) {
              state.fileInput.click();
            } else {
              console.error("MediaModule: File input not found.");
            }
          }
        });
      }

      if (state.dom.mediaGallery) {
        // Media gallery click events
        state.dom.mediaGallery.addEventListener('click', (e) => {
          const thumbnail = e.target.closest('.media-thumbnail');
          if (!thumbnail) return;

          ContextualManager.hideContextMenu();
          ContextualManager.hideInlinePanel();

          const mediaId = thumbnail.dataset.id;
          const media = state.mediaLibrary.find(m => m.id === mediaId);
          if (!media) return;

          if (e.target.closest('.media-delete-btn')) {
            e.stopPropagation();
            e.preventDefault();
            MediaLibraryManager.handleMediaDelete(media);
          } else {
            SelectionManager.handleThumbnailClick(e, media, thumbnail);
          }
        });

        // Media gallery context menu
        state.dom.mediaGallery.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const thumbnail = e.target.closest('.media-thumbnail');

          if (!thumbnail) {
            ContextualManager.hideContextMenu();
            return;
          }

          const mediaId = thumbnail.dataset.id;
          ContextualManager.showContextMenu(e, mediaId, 'effect', thumbnail);
        });
      }

      // Playlist controls events
      if (state.dom.playlistControlsContainer) {
        state.dom.playlistControlsContainer.addEventListener('click', (e) => {
          const target = e.target.closest('button');
          if (!target) return;

          if (target.matches('#playlist-play-button')) {
            MediaPlayer.playPlaylist();
          } else if (target.matches('#playlist-shuffle-button')) {
            PlaylistManager.toggleShuffle();
          } else if (target.matches('#playlist-clear-button')) {
            PlaylistManager.clearPlaylist();
          }
        });
      }

      // Playlist container events
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
            e.stopPropagation();
            const playlistIndex = parseInt(transitionZone.dataset.index, 10);
            if (!isNaN(playlistIndex)) {
              ContextualManager.showInlinePanel(e, playlistIndex, 'transition', transitionZone);
            }
          } else if (item) {
            ContextualManager.hideContextMenu();
            ContextualManager.hideInlinePanel();

            const mediaId = item.dataset.id;
            const index = parseInt(item.dataset.index, 10);
            const media = state.mediaLibrary.find(m => m.id === mediaId);

            if (e.target.closest('.playlist-item-delete')) {
              e.stopPropagation();
              PlaylistManager.removeItem(index);
            } else if (media) {
              if (state.playlist.isPlaying && state.playlist.currentIndex === index) {
                MediaPlayer.pausePlaylist();
              } else {
                state.playlist.currentIndex = index;
                MediaPlayer.playPlaylist();
                HighlightManager.updateActiveHighlight(media.id, 'playlist');
              }
            }
          }
        });
      }
    }
  };

  // Main initialization function
  const init = () => {
    console.log("[MediaModule] Starting initialization.");

    try {
      // Initialize DOM references
      if (!DOMManager.initializeDOMReferences()) {
        throw new Error("Failed to initialize DOM references");
      }

      // Initialize media importer
      initMediaImporter();

      // Setup global events
      EventHandler.setupGlobalEvents();

      console.log("[MediaModule] Initialization complete.");
    } catch (error) {
      console.error("[MediaModule] CRITICAL ERROR during initialization:", error);
      Utils.showNotification("Failed to initialize media module.", "error");
    }
  };

  // Initialize media importer
  const initMediaImporter = () => {
    console.log("[MediaModule] Initializing media importer.");

    try {
      state.dom.importSubmenu = document.getElementById('import-media-submenu');
      if (!state.dom.importSubmenu) {
        console.error("[MediaModule] CRITICAL - #import-media-submenu not found.");
        return;
      }

      const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
      if (!menuContent) {
        console.error("[MediaModule] CRITICAL - .menu-content not found in #import-media-submenu.");
        return;
      }

      // Setup UI
      if (!DOMManager.setupMediaImportUI(menuContent)) {
        throw new Error("Failed to setup media import UI");
      }

      // Load saved data
      StorageManager.loadData();

      console.log("[MediaModule] Media importer initialized successfully.");
    } catch (error) {
      console.error("[MediaModule] CRITICAL ERROR initializing media importer:", error);
    }
  };

  // Public API
  return {
    init: init,
    hideContextMenu: () => ContextualManager.hideContextMenu(),
    hideInlinePanel: () => ContextualManager.hideInlinePanel(),
    getAvailableEffects: () => CONSTANTS.AVAILABLE_EFFECTS,
    getAvailableTransitions: () => CONSTANTS.AVAILABLE_TRANSITIONS,
    getParamsFor: (itemId, itemType, controlsContainerElement, targetApplyId, targetApplyType) =>
        EffectsManager.getParamsFor(itemId, itemType, controlsContainerElement, targetApplyId, targetApplyType),
    populatePerClipTransitions: (playlistItemIndex) =>
        TransitionManager.populatePerClipTransitions(playlistItemIndex),
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', MediaModule.init);
} else {
  MediaModule.init();
}
/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Fixed version with reliable Play All button functionality
 */

const MediaModule = (() => {
  // STATE
  const state = {
    supportedTypes: {
      video: ['video/mp4', 'video/webm', 'video/ogg'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
    },
    mediaLibrary: [],
    playlist: {
      items: [],
      currentIndex: -1,
      isPlaying: false,
      shuffle: false,
      playbackTimer: null,  // New: Add timer tracking for better cleanup
      advancingInProgress: false,  // Lock to prevent simultaneous transitions
      lastTransitionTime: 0  // Track when the last transition happened
    },
    dom: {
      importSubmenu: null,
      mediaContainer: null,
      mediaGallery: null,
      playlistContainer: null,
      playbackControls: null
    },
    fileInput: null
  };

  // INITIALIZATION
  const init = () => {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initMediaImporter, 1000));
  };

  const initMediaImporter = () => {
    state.dom.importSubmenu = document.getElementById('import-media-submenu');
    state.dom.mediaContainer = document.getElementById('media-container');

    if (!state.dom.importSubmenu || !state.dom.mediaContainer) {
      console.error('Required DOM elements not found');
      return;
    }

    // Add styles and initialize UI
    document.head.appendChild(createStyleElement());
    setupMediaImportUI();
    loadSavedMedia();
  };

  const createStyleElement = () => {
    const style = document.createElement('style');
    style.textContent = `
      #playlist-container::-webkit-scrollbar,
      #media-gallery::-webkit-scrollbar {
        display: none;
      }
    `;
    return style;
  };

  // UI SETUP
  const setupMediaImportUI = () => {
    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');

    // Setup file input
    setupFileInput();
    setupImportButton();

    // Add divider
    const divider = document.createElement('hr');
    menuContent.appendChild(divider);

    // Create and add UI sections
    menuContent.appendChild(createMediaLibrarySection());
    menuContent.appendChild(createPlaylistSection());

    // Initialize playback controls container
    state.dom.playbackControls = { style: { display: 'none' } };
  };

  const setupFileInput = () => {
    state.fileInput = document.createElement('input');
    state.fileInput.type = 'file';
    state.fileInput.id = 'media-file-input';
    state.fileInput.accept = [...state.supportedTypes.video, ...state.supportedTypes.image].join(',');
    state.fileInput.multiple = true;
    state.fileInput.style.display = 'none';
    document.body.appendChild(state.fileInput);

    state.fileInput.addEventListener('change', (e) => {
      handleFileSelect(e.target.files);
      e.target.value = '';
    });
  };

  const setupImportButton = () => {
    const importButton = state.dom.importSubmenu.querySelector('.submenu-item[data-action="import-media"]');
    if (importButton) {
      importButton.addEventListener('click', () => state.fileInput.click());
    }
  };

  const createMediaLibrarySection = () => {
    const section = document.createElement('div');
    section.id = 'media-library-section';
    section.style.marginTop = '15px';

    // Add section title
    const title = document.createElement('h3');
    title.textContent = 'MEDIA';
    title.style.fontSize = '14px';
    title.style.marginBottom = '10px';
    title.style.color = 'rgba(255, 255, 255, 0.7)';
    section.appendChild(title);

    // Create gallery container
    const gallery = document.createElement('div');
    gallery.id = 'media-gallery';
    gallery.style.display = 'grid';
    gallery.style.gridTemplateColumns = 'repeat(3, 1fr)';
    gallery.style.gap = '10px';
    gallery.style.padding = '10px';
    gallery.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    gallery.style.borderRadius = '8px';
    gallery.style.height = '320px';
    gallery.style.overflowY = 'auto';
    gallery.style.msOverflowStyle = 'none';
    gallery.style.scrollbarWidth = 'none';

    // Add empty state message
    const emptyState = document.createElement('div');
    emptyState.id = 'media-empty-state';
    emptyState.textContent = 'No media imported yet';
    emptyState.style.padding = '15px';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(255, 255, 255, 0.5)';
    emptyState.style.gridColumn = '1 / -1';

    gallery.appendChild(emptyState);
    section.appendChild(gallery);

    // Store reference
    state.dom.mediaGallery = gallery;

    return section;
  };

  const createPlaylistSection = () => {
    const section = document.createElement('div');
    section.id = 'playlist-section';
    section.style.marginTop = '15px';

    // Add section title
    const title = document.createElement('h3');
    title.textContent = 'PLAYLIST';
    title.style.fontSize = '14px';
    title.style.marginBottom = '10px';
    title.style.color = 'rgba(255, 255, 255, 0.7)';
    section.appendChild(title);

    // Create playlist container
    const playlistContainer = document.createElement('div');
    playlistContainer.id = 'playlist-container';
    playlistContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    playlistContainer.style.borderRadius = '8px';
    playlistContainer.style.height = '340px';
    playlistContainer.style.overflowY = 'auto';
    playlistContainer.style.msOverflowStyle = 'none';
    playlistContainer.style.scrollbarWidth = 'none';
    playlistContainer.style.padding = '8px';
    playlistContainer.style.display = 'flex';
    playlistContainer.style.flexDirection = 'column';
    playlistContainer.style.gap = '8px';

    // Set up drag events
    playlistContainer.addEventListener('dragover', handlePlaylistDragOver);
    playlistContainer.addEventListener('drop', handlePlaylistDrop);
    playlistContainer.addEventListener('dragenter', e => {
      e.preventDefault();
      playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)';
    });
    playlistContainer.addEventListener('dragleave', e => {
      e.preventDefault();
      playlistContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    });

    // Add empty state message
    const emptyState = document.createElement('div');
    emptyState.id = 'playlist-empty-state';
    emptyState.textContent = 'Drag media here to create playlist';
    emptyState.style.padding = '15px';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(255, 255, 255, 0.5)';

    playlistContainer.appendChild(emptyState);
    section.appendChild(playlistContainer);

    // Create playlist controls
    section.appendChild(createPlaylistControls());

    // Store reference
    state.dom.playlistContainer = playlistContainer;

    return section;
  };

  const createPlaylistControls = () => {
    const controls = document.createElement('div');
    controls.id = 'playlist-controls';
    controls.style.display = 'flex';
    controls.style.justifyContent = 'space-between';
    controls.style.marginTop = '10px';

    const buttonStyle = {
      backgroundColor: 'rgba(40, 40, 40, 0.8)',
      color: 'white',
      border: 'none',
      borderRadius: '0',
      padding: '6px 12px',
      cursor: 'pointer',
      fontSize: '11px'
    };

    // Create and add buttons
    const buttons = [
      { id: 'playlist-play-button', html: '<span style="filter: grayscale(100%);">▶</span> Play All', handler: playPlaylist },
      { id: 'playlist-shuffle-button', html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle', handler: toggleShuffle },
      { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', handler: clearPlaylist }
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.id = btn.id;
      button.innerHTML = btn.html;

      // Apply styles
      Object.assign(button.style, buttonStyle);

      // Add event listener
      button.addEventListener('click', btn.handler);
      controls.appendChild(button);
    });

    return controls;
  };

  // FILE HANDLING
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

    // Show notifications
    if (validCount > 0) {
      showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}`, 'success');
    }
    if (invalidCount > 0) {
      showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} not supported`, 'warning');
    }

    // Update UI and save
    updateMediaGallery();
    updatePlaylistUI();
    saveMediaList();
  };

  const isFileSupported = (type) => {
    return state.supportedTypes.video.includes(type) || state.supportedTypes.image.includes(type);
  };

  const processFile = (file) => {
    // Generate unique ID
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const url = URL.createObjectURL(file);

    // Determine media type
    const type = state.supportedTypes.video.includes(file.type) ? 'video' : 'image';

    // Create media item
    const mediaItem = {
      id,
      name: file.name,
      type,
      mimeType: file.type,
      size: file.size,
      url,
      dateAdded: Date.now(),
      thumbnail: null,
      trimSettings: type === 'video' ? {
        trimEnabled: true,
        startTime: 0,
        endTime: null
      } : null
    };

    // Generate thumbnail
    generateThumbnail(mediaItem, file).then(thumbnail => {
      mediaItem.thumbnail = thumbnail;

      // For videos, get duration for trim
      if (type === 'video') {
        const video = document.createElement('video');
        video.preload = 'auto'; // Use auto instead of metadata for faster loading
        video.onloadedmetadata = function() {
          const duration = video.duration;
          mediaItem.trimSettings.endTime = duration > 30 ? 15 : duration;
          video.src = '';
          updateMediaGallery();
          saveMediaList();
        };
        video.src = url;
      }

      updateMediaGallery();
      saveMediaList();
    });

    // Add to library
    state.mediaLibrary.push(mediaItem);
  };

  const generateThumbnail = (mediaItem, file) => {
    return new Promise(resolve => {
      if (mediaItem.type === 'image') {
        // For images, create thumbnail directly
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      }
      else if (mediaItem.type === 'video') {
        // For videos, capture a frame
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadeddata = function() {
          // Seek to a position in the video
          video.currentTime = Math.min(1.0, video.duration / 3);
        };

        video.onseeked = function() {
          // Create canvas for thumbnail
          const canvas = document.createElement('canvas');
          canvas.width = 150;
          canvas.height = 150;
          const ctx = canvas.getContext('2d');

          // Calculate aspect ratio
          const aspectRatio = video.videoWidth / video.videoHeight;
          let drawWidth = canvas.width;
          let drawHeight = canvas.height;

          if (aspectRatio > 1) {
            drawHeight = canvas.width / aspectRatio;
          } else {
            drawWidth = canvas.height * aspectRatio;
          }

          // Center the image
          const offsetX = (canvas.width - drawWidth) / 2;
          const offsetY = (canvas.height - drawHeight) / 2;

          // Draw black background and video frame
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

          // Add play icon
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const triangleSize = 20;

          ctx.beginPath();
          ctx.moveTo(centerX + triangleSize, centerY);
          ctx.lineTo(centerX - triangleSize/2, centerY + triangleSize);
          ctx.lineTo(centerX - triangleSize/2, centerY - triangleSize);
          ctx.closePath();
          ctx.fill();

          // Get data URL and clean up
          resolve(canvas.toDataURL('image/jpeg', 0.7));
          video.src = '';
        };

        video.src = mediaItem.url;
      }
    });
  };

  // UI UPDATES
  const updateMediaGallery = () => {
    const gallery = state.dom.mediaGallery;
    const emptyState = document.getElementById('media-empty-state');

    if (!gallery || !emptyState) return;

    // Clear gallery (except empty state)
    Array.from(gallery.children).forEach(child => {
      if (child.id !== 'media-empty-state') child.remove();
    });

    // Show or hide empty state
    if (state.mediaLibrary.length === 0) {
      emptyState.style.display = 'block';
      return;
    } else {
      emptyState.style.display = 'none';
    }

    // Add media items to gallery
    state.mediaLibrary.forEach(media => gallery.appendChild(createMediaThumbnail(media)));
  };

  const createMediaThumbnail = (media) => {
    // Create thumbnail container
    const thumbnail = document.createElement('div');
    thumbnail.className = 'media-thumbnail';
    thumbnail.dataset.id = media.id;
    thumbnail.style.position = 'relative';
    thumbnail.style.width = '100%';
    thumbnail.style.aspectRatio = '1';
    thumbnail.style.backgroundColor = '#222';
    thumbnail.style.borderRadius = '4px';
    thumbnail.style.overflow = 'hidden';
    thumbnail.style.cursor = 'pointer';
    thumbnail.style.transition = 'transform 0.2s, box-shadow 0.2s';

    // Make draggable
    thumbnail.draggable = true;
    thumbnail.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', media.id);
      e.dataTransfer.effectAllowed = 'copy';
    });

    // Add hover effect
    thumbnail.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.05)';
      this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
    });
    thumbnail.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = 'none';
    });

    // Image container
    const imgContainer = document.createElement('div');
    imgContainer.style.width = '100%';
    imgContainer.style.height = '100%';
    imgContainer.style.display = 'flex';
    imgContainer.style.alignItems = 'center';
    imgContainer.style.justifyContent = 'center';

    // If we have a thumbnail, show it
    if (media.thumbnail) {
      imgContainer.style.backgroundImage = `url(${media.thumbnail})`;
      imgContainer.style.backgroundSize = 'cover';
      imgContainer.style.backgroundPosition = 'center';
    }

    // Add badge indicating media type
    const badge = document.createElement('div');
    badge.className = 'media-type-badge';
    badge.textContent = media.type.toUpperCase();
    badge.style.position = 'absolute';
    badge.style.bottom = '0';
    badge.style.left = '0';
    badge.style.right = '0';
    badge.style.backgroundColor = 'rgba(0,0,0,0.7)';
    badge.style.color = '#fff';
    badge.style.fontSize = '10px';
    badge.style.padding = '2px 4px';
    badge.style.textAlign = 'center';

    // Add trim settings indicator for videos
    if (media.type === 'video' && media.trimSettings && media.trimSettings.trimEnabled) {
      const trimIndicator = document.createElement('div');
      trimIndicator.className = 'trim-indicator';
      trimIndicator.innerHTML = '<span style="filter: grayscale(100%);">✂️</span>';
      trimIndicator.style.position = 'absolute';
      trimIndicator.style.top = '2px';
      trimIndicator.style.left = '2px';
      trimIndicator.style.fontSize = '12px';
      thumbnail.appendChild(trimIndicator);
    }

    // Add settings button for video (cogwheel for trim)
    if (media.type === 'video') {
      const settingsBtn = document.createElement('div');
      settingsBtn.className = 'media-settings';
      settingsBtn.innerHTML = '<span style="filter: grayscale(100%);">⚙️</span>';
      settingsBtn.style.position = 'absolute';
      settingsBtn.style.top = '2px';
      settingsBtn.style.left = '2px';
      settingsBtn.style.backgroundColor = 'rgba(0,0,0,0.7)';
      settingsBtn.style.color = '#fff';
      settingsBtn.style.width = '20px';
      settingsBtn.style.height = '20px';
      settingsBtn.style.borderRadius = '50%';
      settingsBtn.style.display = 'flex';
      settingsBtn.style.alignItems = 'center';
      settingsBtn.style.justifyContent = 'center';
      settingsBtn.style.cursor = 'pointer';
      settingsBtn.style.opacity = '0';
      settingsBtn.style.transition = 'opacity 0.2s';

      // Show settings button on hover
      thumbnail.addEventListener('mouseenter', () => settingsBtn.style.opacity = '1');
      thumbnail.addEventListener('mouseleave', () => settingsBtn.style.opacity = '0');

      // Add click handler for settings
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTrimSettings(media);
      });

      thumbnail.appendChild(settingsBtn);
    }

    // Add delete button
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'media-delete';
    deleteBtn.innerHTML = '<span style="filter: grayscale(100%);">×</span>';
    deleteBtn.style.position = 'absolute';
    deleteBtn.style.top = '2px';
    deleteBtn.style.right = '2px';
    deleteBtn.style.backgroundColor = 'rgba(0,0,0,0.7)';
    deleteBtn.style.color = '#fff';
    deleteBtn.style.width = '20px';
    deleteBtn.style.height = '20px';
    deleteBtn.style.borderRadius = '50%';
    deleteBtn.style.display = 'flex';
    deleteBtn.style.alignItems = 'center';
    deleteBtn.style.justifyContent = 'center';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.opacity = '0';
    deleteBtn.style.transition = 'opacity 0.2s';

    // Show delete button on hover
    thumbnail.addEventListener('mouseenter', () => deleteBtn.style.opacity = '1');
    thumbnail.addEventListener('mouseleave', () => deleteBtn.style.opacity = '0');

    // Add tooltip with filename
    thumbnail.setAttribute('data-tooltip', media.name);

    // Click handlers
    thumbnail.addEventListener('click', () => selectMedia(media));
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMedia(media.id);
    });

    // Assemble the thumbnail
    thumbnail.appendChild(imgContainer);
    thumbnail.appendChild(badge);
    thumbnail.appendChild(deleteBtn);

    return thumbnail;
  };

  const openTrimSettings = (media) => {
    if (media.type !== 'video') return;

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'trim-dialog-backdrop';
    Object.assign(backdrop.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.8)',
      zIndex: '1000',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    });

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'trim-dialog';
    Object.assign(dialog.style, {
      width: '80%',
      maxWidth: '600px',
      backgroundColor: '#222',
      borderRadius: '4px',
      padding: '20px',
      color: 'white'
    });

    // Dialog title
    const title = document.createElement('h3');
    title.textContent = 'Trim Video';
    title.style.marginTop = '0';
    title.style.marginBottom = '15px';

    // Video preview
    const videoPreview = document.createElement('video');
    videoPreview.src = media.url;
    videoPreview.controls = true;
    videoPreview.style.width = '100%';
    videoPreview.style.marginBottom = '20px';
    videoPreview.style.backgroundColor = '#000';
    videoPreview.style.borderRadius = '2px';

    // Variables for trim settings
    let videoDuration = 0;
    let startTime = media.trimSettings ? media.trimSettings.startTime || 0 : 0;
    let endTime = media.trimSettings && media.trimSettings.endTime !== null ?
      media.trimSettings.endTime : videoDuration;

    // Load video metadata to get duration
    videoPreview.onloadedmetadata = function() {
      videoDuration = videoPreview.duration;
      if (!endTime || endTime === 0 || endTime > videoDuration) {
        endTime = videoDuration;
      }
      updateTimeDisplay();
    };

    // Format time as MM:SS.ms
    const formatTime = (seconds) => {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 100);
      return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // Trim controls container
    const trimContainer = document.createElement('div');
    trimContainer.style.marginBottom = '20px';

    // Trim UI container
    const trimUIContainer = document.createElement('div');
    Object.assign(trimUIContainer.style, {
      position: 'relative',
      height: '50px',
      backgroundColor: '#111',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '10px',
      marginBottom: '10px'
    });

    // Timeline (background)
    const timeline = document.createElement('div');
    Object.assign(timeline.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: '#333'
    });

    // Trim region (selectable area)
    const trimRegion = document.createElement('div');
    Object.assign(trimRegion.style, {
      position: 'absolute',
      top: '0',
      height: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      border: '2px solid white',
      boxSizing: 'border-box'
    });

    // Left and right handles
    const leftHandle = document.createElement('div');
    Object.assign(leftHandle.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '10px',
      height: '100%',
      backgroundColor: 'white',
      cursor: 'ew-resize'
    });

    const rightHandle = document.createElement('div');
    Object.assign(rightHandle.style, {
      position: 'absolute',
      top: '0',
      right: '0',
      width: '10px',
      height: '100%',
      backgroundColor: 'white',
      cursor: 'ew-resize'
    });

    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.style.marginTop = '10px';
    timeDisplay.style.fontSize = '14px';
    timeDisplay.style.textAlign = 'center';

    // Function to update display
    function updateTimeDisplay() {
      const startPercent = (startTime / videoDuration) * 100;
      const endPercent = (endTime / videoDuration) * 100;

      trimRegion.style.left = startPercent + '%';
      trimRegion.style.width = (endPercent - startPercent) + '%';
      timeDisplay.textContent = `Start: ${formatTime(startTime)} | End: ${formatTime(endTime)} | Duration: ${formatTime(endTime - startTime)}`;
    }

    // Add drag functionality to handles
    let isDragging = false;
    let dragHandle = null;

    leftHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragHandle = 'left';
      e.preventDefault();
    });

    rightHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragHandle = 'right';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const trimRect = trimUIContainer.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - trimRect.left) / trimRect.width));
      const time = percent * videoDuration;

      if (dragHandle === 'left') {
        startTime = Math.min(time, endTime - 0.5);
        videoPreview.currentTime = startTime;
      } else if (dragHandle === 'right') {
        endTime = Math.max(time, startTime + 0.5);
        videoPreview.currentTime = endTime;
      }

      updateTimeDisplay();
    });

    const removeMouseListeners = () => {
      isDragging = false;
      dragHandle = null;
      document.removeEventListener('mouseup', removeMouseListeners);
    };

    document.addEventListener('mouseup', removeMouseListeners);

    // Assemble timeline UI
    trimRegion.appendChild(leftHandle);
    trimRegion.appendChild(rightHandle);
    timeline.appendChild(trimRegion);
    trimUIContainer.appendChild(timeline);

    // Status message
    const trimStatusContainer = document.createElement('div');
    Object.assign(trimStatusContainer.style, {
      marginBottom: '15px',
      padding: '8px',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.8)'
    });
    trimStatusContainer.textContent = 'Video trimming is always active. Adjust the handles to set start and end points.';

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '20px';

    // Cancel and Save buttons
    const createButton = (text, bgColor, marginRight = false) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      Object.assign(btn.style, {
        padding: '6px 12px',
        backgroundColor: bgColor,
        color: 'white',
        border: 'none',
        borderRadius: '0',
        cursor: 'pointer'
      });
      if (marginRight) btn.style.marginRight = '10px';
      return btn;
    };

    const cancelButton = createButton('Cancel', '#444', true);
    const saveButton = createButton('Save', '#666');

    // Event handlers
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(backdrop);
      document.removeEventListener('mouseup', removeMouseListeners);
    });

    saveButton.addEventListener('click', () => {
      // Save trim settings
      media.trimSettings = {
        trimEnabled: true,
        startTime: startTime,
        endTime: endTime
      };

      // Update UI, save, and close
      updateMediaGallery();
      saveMediaList();
      document.body.removeChild(backdrop);
      document.removeEventListener('mouseup', removeMouseListeners);
      showNotification('Video trim settings saved', 'success');
    });

    // Assemble dialog
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);

    dialog.appendChild(title);
    dialog.appendChild(videoPreview);
    dialog.appendChild(trimStatusContainer);
    dialog.appendChild(trimContainer);
    trimContainer.appendChild(trimUIContainer);
    trimContainer.appendChild(timeDisplay);
    dialog.appendChild(buttonContainer);

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
  };

  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer;
    const emptyState = document.getElementById('playlist-empty-state');

    if (!playlistContainer || !emptyState) return;

    // Clear all existing playlist items
    Array.from(playlistContainer.children).forEach(child => {
      if (child.id !== 'playlist-empty-state') child.remove();
    });

    // Handle empty playlist
    if (state.playlist.items.length === 0) {
      emptyState.style.display = 'block';

      // Disable controls
      ['playlist-play-button', 'playlist-clear-button'].forEach(id => {
        const button = document.getElementById(id);
        if (button) {
          button.disabled = true;
          button.style.opacity = '0.5';
        }
      });
      return;
    }

    // Playlist has items
    emptyState.style.display = 'none';

    // Enable controls
    ['playlist-play-button', 'playlist-clear-button'].forEach(id => {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = false;
        button.style.opacity = '1';
      }
    });

    // Add playlist items IN ORDER
    state.playlist.items.forEach((mediaId, index) => {
      const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (!media) {
        console.error(`Media ID ${mediaId} at index ${index} not found in library`);
        return;
      }

      playlistContainer.appendChild(createPlaylistItem(media, index));
    });

    // Update shuffle button state
    const shuffleButton = document.getElementById('playlist-shuffle-button');
    if (shuffleButton) {
      shuffleButton.style.backgroundColor = state.playlist.shuffle ?
        'rgba(255, 255, 255, 0.2)' : 'rgba(40, 40, 40, 0.8)';
    }

    // Update play button text based on state
    const playButton = document.getElementById('playlist-play-button');
    if (playButton) {
      playButton.innerHTML = state.playlist.isPlaying ?
        '<span style="filter: grayscale(100%);">⏸</span> Pause' :
        '<span style="filter: grayscale(100%);">▶</span> Play All';
    }
  };

  const createPlaylistItem = (media, index) => {
    // Create playlist item container
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.dataset.id = media.id;
    item.dataset.index = index;
    Object.assign(item.style, {
      display: 'flex',
      alignItems: 'center',
      padding: '6px',
      backgroundColor: index === state.playlist.currentIndex ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.3)',
      borderRadius: '4px',
      cursor: 'pointer',
      marginBottom: '4px',
      transition: 'background-color 0.2s ease, border-top 0.2s ease'
    });

    // Make draggable for reordering
    item.draggable = true;

    // Set up drag events
    item.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'playlist-reorder',
        id: media.id,
        index: index
      }));
      e.dataTransfer.effectAllowed = 'move';
      this.style.opacity = '0.5';
    });

    item.addEventListener('dragend', function() {
      this.style.opacity = '1';
      document.querySelectorAll('.playlist-item').forEach(i => {
        i.classList.remove('drag-over');
        i.style.borderTop = 'none';
      });
    });

    // Drag-over and drop handling
    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();

      document.querySelectorAll('.playlist-item').forEach(i => {
        i.classList.remove('drag-over');
        i.style.borderTop = 'none';
      });

      this.classList.add('drag-over');
      this.style.borderTop = '2px solid white';
      e.dataTransfer.dropEffect = 'move';
    });

    item.addEventListener('dragleave', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      this.style.borderTop = 'none';
    });

    item.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.remove('drag-over');
      this.style.borderTop = 'none';

      try {
        const dataText = e.dataTransfer.getData('text/plain');
        if (!dataText) return;

        try {
          const data = JSON.parse(dataText);
          if (data && data.type === 'playlist-reorder') {
            const fromIndex = parseInt(data.index);
            const toIndex = parseInt(this.dataset.index);

            if (fromIndex !== toIndex && !isNaN(fromIndex) && !isNaN(toIndex)) {
              reorderPlaylistItem(fromIndex, toIndex);
            }
          }
        } catch(err) {
          // Not JSON, might be just the ID
          const mediaId = dataText;
          if (!state.playlist.items.includes(mediaId)) {
            addToPlaylist(mediaId);
          }
        }
      } catch(err) {
        console.error('Error during playlist drop handling:', err);
      }
    });

    // Thumbnail
    const thumbnail = document.createElement('div');
    Object.assign(thumbnail.style, {
      width: '40px',
      height: '40px',
      backgroundColor: '#222',
      borderRadius: '3px',
      marginRight: '10px',
      overflow: 'hidden',
      flexShrink: '0',
      position: 'relative'
    });

    // Show thumbnail if available
    if (media.thumbnail) {
      thumbnail.style.backgroundImage = `url(${media.thumbnail})`;
      thumbnail.style.backgroundSize = 'cover';
      thumbnail.style.backgroundPosition = 'center';
    }

    // Add trim indicator if applicable
    if (media.type === 'video' && media.trimSettings && media.trimSettings.trimEnabled) {
      const trimIndicator = document.createElement('div');
      trimIndicator.innerHTML = '<span style="filter: grayscale(100%);">✂️</span>';
      Object.assign(trimIndicator.style, {
        position: 'absolute',
        bottom: '2px',
        right: '2px',
        fontSize: '8px'
      });
      thumbnail.appendChild(trimIndicator);
    }

    // Add media type indicator
    const typeIndicator = document.createElement('div');
    Object.assign(typeIndicator.style, {
      position: 'absolute',
      bottom: '0',
      right: '0',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: '#fff',
      fontSize: '8px',
      padding: '1px 3px'
    });
    typeIndicator.textContent = media.type.charAt(0).toUpperCase();
    thumbnail.appendChild(typeIndicator);

    // Add "Now Playing" indicator if this is the current item
    if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
      const playingIndicator = document.createElement('div');
      playingIndicator.innerHTML = '<span style="filter: grayscale(100%);">▶</span>';
      Object.assign(playingIndicator.style, {
        position: 'absolute',
        top: '2px',
        left: '2px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#fff',
        fontSize: '8px',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });
      thumbnail.appendChild(playingIndicator);
    }

    // Info container
    const infoContainer = document.createElement('div');
    infoContainer.style.overflow = 'hidden';
    infoContainer.style.flexGrow = '1';

    // Media name
    const nameEl = document.createElement('div');
    nameEl.textContent = media.name;
    Object.assign(nameEl.style, {
      fontSize: '12px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: 'white'
    });
    infoContainer.appendChild(nameEl);

    // Media details
    const detailsEl = document.createElement('div');
    let detailsText = `${media.type} · ${formatFileSize(media.size)}`;
    if (media.type === 'video' && media.trimSettings && media.trimSettings.trimEnabled) {
      const duration = media.trimSettings.endTime - media.trimSettings.startTime;
      detailsText += ` · Trimmed (${duration.toFixed(1)}s)`;
    }
    detailsEl.textContent = detailsText;
    Object.assign(detailsEl.style, {
      fontSize: '10px',
      color: 'rgba(255, 255, 255, 0.6)'
    });
    infoContainer.appendChild(detailsEl);

    // Delete button
    const deleteBtn = document.createElement('div');
    deleteBtn.innerHTML = '<span style="filter: grayscale(100%);">×</span>';
    Object.assign(deleteBtn.style, {
      width: '24px',
      height: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderRadius: '50%',
      cursor: 'pointer',
      marginLeft: '5px',
      color: 'white',
      fontSize: '18px'
    });

    // Event listeners
    item.addEventListener('click', function() {
      // If already playing this item, do nothing
      if (state.playlist.isPlaying && state.playlist.currentIndex === index) {
        return;
      }

      // Otherwise, select this item and start playing
      state.playlist.currentIndex = index;
      playPlaylist();
    });

    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      removeFromPlaylist(index);
    });

    // Assemble the item
    item.appendChild(thumbnail);
    item.appendChild(infoContainer);
    item.appendChild(deleteBtn);

    return item;
  };

  // PLAYLIST DRAG & DROP HANDLERS
  const handlePlaylistDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handlePlaylistDrop = (e) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';

    try {
      const dataText = e.dataTransfer.getData('text/plain');
      if (!dataText) return;

      // Try to parse as JSON (for reordering)
      try {
        const jsonData = JSON.parse(dataText);
        if (jsonData && jsonData.type === 'playlist-reorder') {
          const fromIndex = parseInt(jsonData.index);
          const toIndex = state.playlist.items.length - 1; // Move to end

          if (!isNaN(fromIndex) && fromIndex >= 0 && fromIndex !== toIndex) {
            reorderPlaylistItem(fromIndex, toIndex);
          }
          return;
        }
      } catch (err) {
        // Not JSON, likely a media ID - continue
      }

      // Handle as a media ID
      const mediaId = dataText;
      const media = state.mediaLibrary.find(m => m.id === mediaId);

      if (media) {
        addToPlaylist(mediaId);
      } else {
        console.error(`Media ID ${mediaId} not found in library`);
      }
    } catch (err) {
      console.error('Error in handlePlaylistDrop:', err);
    }
  };

  // PLAYLIST MANAGEMENT
  const addToPlaylist = (mediaId) => {
    // Verify the media exists
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) {
      console.error(`Cannot add media ID ${mediaId} to playlist - not found in library`);
      return;
    }

    // Check if it's already in the playlist
    if (state.playlist.items.includes(mediaId)) {
      console.log(`Media ${media.name} is already in the playlist`);
      return;
    }

    // Check if this will be the first item
    const wasEmpty = state.playlist.items.length === 0;

    // Add to playlist
    state.playlist.items.push(mediaId);

    // If this was the first item, automatically select it
    if (wasEmpty) {
      state.playlist.currentIndex = 0;
      // Auto-play the first item
      setTimeout(() => playPlaylist(), 50);
    }

    // Update UI
    updatePlaylistUI();
    saveMediaList();
    showNotification(`Added to playlist: ${media.name}`, 'success');
  };

  const removeFromPlaylist = (index) => {
    if (index < 0 || index >= state.playlist.items.length) return;

    // Get media details for notification
    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);

    // Remove from playlist
    state.playlist.items.splice(index, 1);

    // If it was the current item or before it, adjust current index
    if (state.playlist.isPlaying) {
      if (index === state.playlist.currentIndex) {
        // If it was the current item, play next item
        if (state.playlist.items.length > 0) {
          // Keep the index (will now point to the next item)
          if (state.playlist.currentIndex >= state.playlist.items.length) {
            state.playlist.currentIndex = 0;
          }
          playMediaByIndex(state.playlist.currentIndex);
        } else {
          // Playlist is now empty
          stopPlaylist();
        }
      } else if (index < state.playlist.currentIndex) {
        // It was before the current item, adjust index
        state.playlist.currentIndex--;
      }
    }

    // Update UI and save
    updatePlaylistUI();
    saveMediaList();

    // Show notification
    if (media) {
      showNotification(`Removed from playlist: ${media.name}`, 'info');
    }
  };

  const reorderPlaylistItem = (fromIndex, toIndex) => {
    if (
      fromIndex < 0 ||
      fromIndex >= state.playlist.items.length ||
      toIndex < 0 ||
      toIndex >= state.playlist.items.length
    ) {
      return;
    }

    try {
      // Get the item to move
      const item = state.playlist.items[fromIndex];

      // Remove from original position and insert at new position
      state.playlist.items.splice(fromIndex, 1);
      state.playlist.items.splice(toIndex, 0, item);

      // Adjust current index if needed
      if (state.playlist.isPlaying) {
        if (fromIndex === state.playlist.currentIndex) {
          // If moving the current item
          state.playlist.currentIndex = toIndex;
        } else if (fromIndex < state.playlist.currentIndex && toIndex >= state.playlist.currentIndex) {
          // If moving an item from before current to after it
          state.playlist.currentIndex--;
        } else if (fromIndex > state.playlist.currentIndex && toIndex <= state.playlist.currentIndex) {
          // If moving an item from after current to before it
          state.playlist.currentIndex++;
        }
      }

      // Update UI and save
      updatePlaylistUI();
      saveMediaList();
    } catch (e) {
      console.error('Error reordering playlist item:', e);
    }
  };

  const clearPlaylist = () => {
    try {
      // Stop playback first
      stopPlaylist();
      clearMediaDisplay();

      // Clear playlist data completely
      state.playlist.items = [];
      state.playlist.currentIndex = -1;
      state.playlist.isPlaying = false;

      // Clear any lingering timers
      clearPlaybackTimers();

      // Update UI and save
      updatePlaylistUI();
      saveMediaList();
      showNotification('Playlist cleared', 'info');
    } catch (e) {
      console.error('Error in clearPlaylist:', e);
    }
  };

  // MEDIA PLAYBACK

  /**
   * Fixed version of selectMedia to ensure proper single-item looping
   * @param {Object} media - The media item to play
   */
  const selectMedia = (media) => {
    console.log(`Selecting media: ${media.name} for standalone playback (should loop)`);

    // Clear the playlist playback state
    stopPlaylist();

    // Clear media container
    clearMediaDisplay();

    // Create appropriate element based on media type
    // isPlaylist=false ensures it will loop
    const element = createMediaElement(media, false);

    if (element) {
      state.dom.mediaContainer.appendChild(element);
      showNotification(`Now playing: ${media.name}`, 'info');
    }
  };

  /**
   * Enhanced version of media element creation with better event handling
   */
  const createMediaElement = (media, isPlaylist = false) => {
    let element;

    if (media.type === 'image') {
      element = document.createElement('img');
      element.src = media.url;
      Object.assign(element.style, {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        top: '0',
        left: '0'
      });

      // For images in playlist mode, auto-advance after a delay
      if (isPlaylist) {
        console.log(`Setting timer for image ${media.name} to auto-advance in 5 seconds`);

        // Clear any existing timer
        clearPlaybackTimers();

        // Set new timer
        state.playlist.playbackTimer = setTimeout(() => {
          if (state.playlist.isPlaying) {
            console.log(`Image timer expired - advancing to next item`);
            playNextItem();
          }
        }, 5000); // 5 seconds per image
      }
    }
    else if (media.type === 'video') {
      element = document.createElement('video');
      element.src = media.url;
      element.autoplay = true;

      // IMPORTANT: Loop ONLY when NOT in playlist mode
      element.loop = !isPlaylist;
      element.muted = true;
      Object.assign(element.style, {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        top: '0',
        left: '0'
      });

      console.log(`Created video element for ${media.name}, loop=${element.loop}, isPlaylist=${isPlaylist}`);

      // Make sure video loads
      element.addEventListener('error', function(e) {
        console.error(`Error loading video: ${media.name}`, e);
        // If in playlist mode, try to recover by going to the next item
        if (isPlaylist && state.playlist.isPlaying) {
          setTimeout(() => playNextItem(), 100);
        }
      });

      // Apply trim settings
      if (media.trimSettings) {
        // Store isPlaylist in closure for event handlers
        const playlistMode = isPlaylist;

        // Set initial time to the start trim point
        element.addEventListener('loadedmetadata', function() {
          this.currentTime = media.trimSettings.startTime || 0;
          console.log(`Set video start time to ${media.trimSettings.startTime || 0}`);
        });

        // Handle trim edges
        element.addEventListener('timeupdate', function() {
          // Keep video within trim boundaries
          if (this.currentTime < media.trimSettings.startTime) {
            this.currentTime = media.trimSettings.startTime;
          }

          // If we've reached or passed the end trim point
          if (media.trimSettings.endTime && this.currentTime >= media.trimSettings.endTime) {
            console.log(`Video reached end trim point: ${this.currentTime} >= ${media.trimSettings.endTime}`);

            if (playlistMode && state.playlist.isPlaying) {
              // When in playlist mode, go to next item
              console.log(`Advancing to next item due to reaching trim end`);
              playNextItem();
            } else if (!playlistMode) { // Only loop when NOT in playlist mode
              // For single media, set back to start point
              console.log(`Looping single video back to start trim point`);
              this.currentTime = media.trimSettings.startTime || 0;
            }
          }
        });
      }

      // For playlist videos - advance to next item when video ends
      if (isPlaylist) {
        element.addEventListener('ended', () => {
          if (state.playlist.isPlaying) {
            console.log(`Video ended normally - advancing to next item`);
            playNextItem();
          }
        });
      }
    }

    return element;
  };

  /**
   * Fixed Play All button with instant playback
   */
  const playPlaylist = () => {
    if (state.playlist.items.length === 0) {
      showNotification('Playlist is empty. Add media to play.', 'info');
      return;
    }

    // If already playing, toggle to pause
    if (state.playlist.isPlaying) {
      pausePlaylist();
      return;
    }

    // Clear any lingering timers
    clearPlaybackTimers();

    // Reset any flags that might be blocking playback
    state.playlist.advancingInProgress = false;

    // If we don't have a valid current index, set it
    if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
      if (state.playlist.shuffle) {
        // If shuffle is enabled, pick a random item
        state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length);
      } else {
        // Otherwise start from the beginning
        state.playlist.currentIndex = 0;
      }
    }

    // Set playing state immediately
    state.playlist.isPlaying = true;

    // Clear any current media display (do this synchronously)
    clearMediaDisplay();

    // Play the media immediately
    playMediaByIndex(state.playlist.currentIndex);

    // Update the UI
    updatePlaylistUI();
  };

  /**
   * New pause function for better control
   */
  const pausePlaylist = () => {
    console.log("Pausing playlist");

    // Update state
    state.playlist.isPlaying = false;

    // Clear any scheduled timers
    clearPlaybackTimers();

    // Pause video if playing
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) {
      videoElement.pause();
    }

    // Update UI to show paused state
    updatePlaylistUI();

    showNotification("Playlist paused", "info");
  };

  /**
   * Enhanced playMediaByIndex with immediate playback
   */
  const playMediaByIndex = (index) => {
    // Guard against invalid indices
    if (index < 0 || index >= state.playlist.items.length) {
      if (state.playlist.items.length > 0) {
        // Recover by starting from the beginning
        index = 0;
      } else {
        return;
      }
    }

    // Get the media
    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);

    if (!media) {
      // Try to recover by going to next item
      if (state.playlist.isPlaying) {
        playNextItem();
      }
      return;
    }

    // Set state - make sure we're in playing mode
    state.playlist.currentIndex = index;
    state.playlist.isPlaying = true;

    // Force synchronous clear and update
    clearMediaDisplay();

    // Create and play media element
    const element = createMediaElement(media, true);
    if (element) {
      state.dom.mediaContainer.appendChild(element);

      // Force element to load ASAP
      if (element.tagName.toLowerCase() === 'video') {
        element.load();
      }

      // Update UI to highlight current item
      updatePlaylistUI();
    } else {
      // Try to recover by going to next item
      if (state.playlist.isPlaying) {
        playNextItem();
      }
    }
  };

  /**
   * Optimized playNextItem with zero delay between clips
   */
  const playNextItem = () => {
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) {
      return;
    }

    // Clear any timers
    clearPlaybackTimers();

    // Calculate next index based on current mode
    let nextIndex;

    if (state.playlist.shuffle) {
      // For shuffle mode, pick a random item that's not the current one
      if (state.playlist.items.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * state.playlist.items.length);
        } while (nextIndex === state.playlist.currentIndex);
      } else {
        nextIndex = 0;
      }
    } else {
      // For sequential mode, move to next index, looping back to start when needed
      nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
    }

    // Update the current index
    state.playlist.currentIndex = nextIndex;

    // Ensure playing state is maintained
    state.playlist.isPlaying = true;

    // Play the next item immediately - no delay
    playMediaByIndex(nextIndex);
  };

  /**
   * New helper function to clear all playback timers
   */
  const clearPlaybackTimers = () => {
    // Clear the main playback timer
    if (state.playlist.playbackTimer) {
      clearTimeout(state.playlist.playbackTimer);
      state.playlist.playbackTimer = null;
    }
  };

  const toggleShuffle = () => {
    state.playlist.shuffle = !state.playlist.shuffle;
    updatePlaylistUI();
    showNotification(
      state.playlist.shuffle ? 'Shuffle mode: On' : 'Shuffle mode: Off',
      'info'
    );
  };

  const stopPlaylist = (resetIndex = true) => {
    // Update state
    state.playlist.isPlaying = false;

    // Clear any playback timers
    clearPlaybackTimers();

    // Reset current index if requested
    if (resetIndex) {
      state.playlist.currentIndex = -1;
    }

    // Clear display if resetting
    if (resetIndex) {
      clearMediaDisplay();
    }

    // Update UI
    updatePlaylistUI();
  };

  const clearMediaDisplay = () => {
    try {
      // Clear timers first
      clearPlaybackTimers();

      // Get all media elements to clean up
      const mediaElements = state.dom.mediaContainer.querySelectorAll('video, audio, img');

      // Clean up each element
      mediaElements.forEach(el => {
        try {
          if (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio') {
            el.pause();
            el.currentTime = 0;
            el.removeAttribute('src');
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          } else if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } catch (e) {
          // Just remove the element if error
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        }
      });

      // Quick clear
      state.dom.mediaContainer.innerHTML = '';
    } catch (e) {
      // Force clear if any errors
      if (state.dom.mediaContainer) {
        state.dom.mediaContainer.innerHTML = '';
      }
    }
  };

  // MEDIA MANAGEMENT
  const deleteMedia = (id) => {
    const index = state.mediaLibrary.findIndex(m => m.id === id);
    if (index === -1) return;

    const media = state.mediaLibrary[index];

    // Remove from array
    state.mediaLibrary.splice(index, 1);

    // Revoke object URL
    URL.revokeObjectURL(media.url);

    // Remove from playlist if present
    const playlistIndex = state.playlist.items.indexOf(id);
    if (playlistIndex !== -1) {
      removeFromPlaylist(playlistIndex);
    }

    // Clear display
    clearMediaDisplay();

    // Reset if no media left
    if (state.mediaLibrary.length === 0) {
      state.playlist = {
        items: [],
        currentIndex: -1,
        isPlaying: false,
        shuffle: false,
        playbackTimer: null,
        advancingInProgress: false,
        lastTransitionTime: 0
      };
      clearMediaDisplay();
    }

    // Update UI and save
    updateMediaGallery();
    updatePlaylistUI();
    saveMediaList();
    showNotification(`Removed: ${media.name}`, 'info');
  };

  // STORAGE
  const saveMediaList = () => {
    try {
      // Create storage-safe version (without URLs)
      const mediaForStorage = state.mediaLibrary.map(media => {
        const { url, ...mediaCopy } = media;
        return mediaCopy;
      });

      // Create storage object
      const storageData = {
        media: mediaForStorage,
        playlist: {
          items: state.playlist.items,
          shuffle: state.playlist.shuffle
        }
      };

      localStorage.setItem('flStudioWallpaper_media', JSON.stringify(storageData));
    } catch (e) {
      console.error('Failed to save media list to localStorage:', e);
    }
  };

  const loadSavedMedia = () => {
    try {
      const savedData = localStorage.getItem('flStudioWallpaper_media');
      if (!savedData) return;

      const parsedData = JSON.parse(savedData);

      // Notify about media
      if (parsedData.media && Array.isArray(parsedData.media) && parsedData.media.length > 0) {
        showNotification(`Found ${parsedData.media.length} previously imported media files. Please re-import them to use.`, 'info');
      }

      // Load playlist if available
      if (parsedData.playlist && parsedData.playlist.items) {
        state.playlist.items = parsedData.playlist.items;
        if (typeof parsedData.playlist.shuffle === 'boolean') {
          state.playlist.shuffle = parsedData.playlist.shuffle;
        }
        updatePlaylistUI();
      }
    } catch (e) {
      console.error('Failed to load media data from localStorage:', e);
    }
  };

  // UTILITY FUNCTIONS
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const showNotification = (message, type) => {
    if (typeof WallpaperApp !== 'undefined' &&
      WallpaperApp.UI &&
      typeof WallpaperApp.UI.showNotification === 'function') {
      WallpaperApp.UI.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };

  // Public API
  return { init };
})();

// Initialize media module
MediaModule.init();

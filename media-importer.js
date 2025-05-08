/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Zaktualizowana wersja z integracją z nowym systemem menu dla Effects/Transitions
 * Oraz zmienionym układem przycisków w Media Player
 */

const MediaModule = (() => {
  // STATE (bez zmian)
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
      playbackTimer: null,
      advancingInProgress: false,
      lastTransitionTime: 0
    },
    dom: {
      importSubmenu: null,
      mediaContainer: null,
      mediaGallery: null,
      playlistContainer: null,
      playlistControlsContainer: null,
      playbackControls: null
    },
    selection: {
      active: false,
      startPoint: null,
      items: new Set(),
      shiftKeyActive: false,
      lastSelected: null
    },
    activeHighlight: {
      mediaId: null,
      sourceType: null
    },
    fileInput: null
  };

  // INITIALIZATION
  const init = () => {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initMediaImporter, 1000));
    document.addEventListener('keydown', (e) => { if (e.key === 'Shift') state.selection.shiftKeyActive = true; });
    document.addEventListener('keyup', (e) => { if (e.key === 'Shift') state.selection.shiftKeyActive = false; });
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

  // UI SETUP
  const setupMediaImportUI = () => {
    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
    if (!menuContent) {
      console.error("Menu content not found in import-media-submenu");
      return;
    }
    menuContent.innerHTML = ''; // Clear existing content

    setupFileInput();

    // Create and add "IMPORT MEDIA" button directly
    const importButton = document.createElement('button');
    importButton.className = 'submenu-item import-media-button'; // Added specific class for styling
    importButton.setAttribute('data-action', 'import-media-action');
    importButton.textContent = 'IMPORT MEDIA';
    importButton.addEventListener('click', () => state.fileInput.click());
    menuContent.appendChild(importButton);

    menuContent.appendChild(document.createElement('hr')).className = 'divider';

    // Add Media Library section
    const mediaLibrarySection = createMediaLibrarySection();
    menuContent.appendChild(mediaLibrarySection);

    menuContent.appendChild(document.createElement('hr')).className = 'divider';

    // Add Quick Nav section (now only Effects)
    const quickNavSection = createQuickNavSection();
    menuContent.appendChild(quickNavSection);

    menuContent.appendChild(document.createElement('hr')).className = 'divider';

    // Add Playlist section (will include Transitions button)
    const playlistSection = createPlaylistSection();
    menuContent.appendChild(playlistSection);

    state.dom.playbackControls = { style: { display: 'none' } }; // Placeholder
  };

  const setupFileInput = () => {
    // (Bez zmian)
    if (state.fileInput && state.fileInput.parentNode) {
      state.fileInput.parentNode.removeChild(state.fileInput);
    }
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

  const createMediaLibrarySection = () => {
    // (Bez zmian w logice, tylko kosmetyczne poprawki w tekście jeśli potrzebne)
    const section = document.createElement('div');
    section.id = 'media-library-section';
    const title = document.createElement('h3');
    title.textContent = 'MEDIA LIBRARY';
    section.appendChild(title);
    const selectionInfo = document.createElement('div');
    selectionInfo.className = 'selection-info';
    selectionInfo.textContent = 'Shift+Click or drag to select multiple'; // English text
    section.appendChild(selectionInfo);
    const gallery = document.createElement('div');
    gallery.id = 'media-gallery';
    // Drag selection logic (bez zmian)
    let selectionBox = null;
    let isSelecting = false;
    let startPointGallery = { x: 0, y: 0 };
    gallery.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target !== gallery) return;
      isSelecting = true;
      startPointGallery = { x: e.clientX, y: e.clientY };
      if (selectionBox) gallery.removeChild(selectionBox);
      selectionBox = document.createElement('div');
      selectionBox.className = 'selection-box';
      const galleryRect = gallery.getBoundingClientRect();
      selectionBox.style.left = (startPointGallery.x - galleryRect.left + gallery.scrollLeft) + 'px';
      selectionBox.style.top = (startPointGallery.y - galleryRect.top + gallery.scrollTop) + 'px';
      gallery.appendChild(selectionBox);
      if (!state.selection.shiftKeyActive) clearSelection();
    });
    gallery.addEventListener('mousemove', (e) => {
      if (!isSelecting || !selectionBox) return;
      const galleryRect = gallery.getBoundingClientRect();
      const currentX = e.clientX - galleryRect.left + gallery.scrollLeft;
      const currentY = e.clientY - galleryRect.top + gallery.scrollTop;
      const startX = startPointGallery.x - galleryRect.left + gallery.scrollLeft;
      const startY = startPointGallery.y - galleryRect.top + gallery.scrollTop;
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
      const selectionRect = { left, top, right: left + width, bottom: top + height };
      gallery.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
        const thumbnailRect = thumbnail.getBoundingClientRect();
        const thumbLeft = thumbnailRect.left - galleryRect.left + gallery.scrollLeft;
        const thumbTop = thumbnailRect.top - galleryRect.top + gallery.scrollTop;
        const thumbRight = thumbLeft + thumbnailRect.width;
        const thumbBottom = thumbTop + thumbnailRect.height;
        const mediaId = thumbnail.dataset.id;
        if (thumbRight >= selectionRect.left && thumbLeft <= selectionRect.right && thumbBottom >= selectionRect.top && thumbTop <= selectionRect.bottom) {
          addToSelection(mediaId); thumbnail.classList.add('selected');
        } else if (!state.selection.shiftKeyActive) {
          removeFromSelection(mediaId); thumbnail.classList.remove('selected');
        }
      });
    });
    gallery.addEventListener('mouseup', () => {
      if (!isSelecting) return;
      isSelecting = false;
      if (selectionBox && selectionBox.parentNode) gallery.removeChild(selectionBox);
      selectionBox = null;
      if (state.selection.items.size > 0) state.selection.lastSelected = Array.from(state.selection.items).pop();
      updateMediaSelectionUI();
    });
    gallery.addEventListener('mouseleave', () => { if (isSelecting && selectionBox) selectionBox.style.display = 'none'; });
    gallery.addEventListener('mouseenter', () => { if (isSelecting && selectionBox) selectionBox.style.display = 'block'; });

    const emptyState = document.createElement('div');
    emptyState.id = 'media-empty-state';
    emptyState.textContent = 'No media imported yet';
    gallery.appendChild(emptyState);
    section.appendChild(gallery);
    state.dom.mediaGallery = gallery;
    return section;
  };

  // MODIFIED: Quick Navigation Section - Only Effects
  const createQuickNavSection = () => {
    const section = document.createElement('div');
    section.id = 'quick-nav-section'; // Keep ID for potential styling

    // Effects Button (now takes full width)
    const effectsButton = document.createElement('button');
    effectsButton.textContent = 'EFFECTS';
    effectsButton.className = 'quick-nav-button btn btn-secondary'; // Use existing class
    effectsButton.addEventListener('click', () => {
      // Directly open L2 effects list.
      if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
        window.WallpaperApp.MenuTools.closeAllL3Submenus?.(); // Close any open L3 first
        window.WallpaperApp.MenuTools.openL2Submenu('effects-list-submenu');
      } else {
        showNotification('Menu function not available.', 'warning');
        document.querySelector('.category-item[data-action="effects"]')?.click(); // Fallback
      }
    });
    section.appendChild(effectsButton);
    return section;
  };

  // MODIFIED: Playlist Section - Adds Transitions button below playlist
  const createPlaylistSection = () => {
    const section = document.createElement('div');
    section.id = 'playlist-section';

    const title = document.createElement('h3');
    title.textContent = 'PLAYLIST';
    section.appendChild(title);

    // Playlist container (unchanged)
    const playlistContainer = document.createElement('div');
    playlistContainer.id = 'playlist-container';
    playlistContainer.addEventListener('dragover', handlePlaylistDragOver);
    playlistContainer.addEventListener('drop', handlePlaylistDrop);
    playlistContainer.addEventListener('dragenter', e => { e.preventDefault(); playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)'; });
    playlistContainer.addEventListener('dragleave', e => { e.preventDefault(); playlistContainer.style.backgroundColor = ''; });
    const emptyState = document.createElement('div');
    emptyState.id = 'playlist-empty-state';
    emptyState.textContent = 'Drag media here to create playlist';
    playlistContainer.appendChild(emptyState);
    section.appendChild(playlistContainer); // Add playlist container

    state.dom.playlistContainer = playlistContainer; // Store reference

    // Add Transitions button below playlist
    const transitionsButton = document.createElement('button');
    transitionsButton.textContent = 'TRANSITIONS';
    transitionsButton.id = 'playlist-transitions-button'; // Assign ID for styling
    transitionsButton.className = 'quick-nav-button btn btn-secondary'; // Reuse class for similar style
    transitionsButton.addEventListener('click', () => {
      // Directly open L2 transitions list.
      if (window.WallpaperApp?.MenuTools?.openL2Submenu) {
        window.WallpaperApp.MenuTools.closeAllL3Submenus?.(); // Close any open L3 first
        window.WallpaperApp.MenuTools.openL2Submenu('transitions-list-submenu');
      } else {
        showNotification('Menu function not available.', 'warning');
        document.querySelector('.category-item[data-action="transitions"]')?.click(); // Fallback
      }
    });
    section.appendChild(transitionsButton); // Add Transitions button HERE

    // Playlist controls container (unchanged)
    let controlsContainer = document.getElementById('playlist-controls');
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.id = 'playlist-controls';
    }
    state.dom.playlistControlsContainer = controlsContainer;
    createPlaylistControls(controlsContainer); // Populate controls
    section.appendChild(controlsContainer); // Add controls container at the end

    return section;
  };

  const createPlaylistControls = (controlsContainer) => {
    // (Bez zmian)
    controlsContainer.innerHTML = '';
    controlsContainer.style.visibility = 'hidden';
    const buttonsData = [
      { id: 'playlist-play-button', html: '<span style="filter: grayscale(100%);">▶</span> Play All', handler: playPlaylist, class: 'btn-primary' },
      { id: 'playlist-shuffle-button', html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle', handler: toggleShuffle, class: 'btn-secondary' },
      { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', handler: clearPlaylist, class: 'btn-danger' }
    ];
    buttonsData.forEach(btnData => {
      const button = document.createElement('button');
      button.id = btnData.id;
      button.innerHTML = btnData.html;
      button.className = `btn playlist-button ${btnData.class || 'btn-secondary'}`;
      button.addEventListener('click', btnData.handler);
      controlsContainer.appendChild(button);
    });
  };

  // --- Pozostałe funkcje (bez zmian w logice) ---

  // FUNKCJE ZARZĄDZANIA ZAZNACZENIEM (Bez zmian)
  const clearSelection = () => { state.selection.items.clear(); state.selection.lastSelected = null; updateMediaSelectionUI(); };
  const addToSelection = (mediaId) => { state.selection.items.add(mediaId); };
  const removeFromSelection = (mediaId) => { state.selection.items.delete(mediaId); };
  const toggleSelection = (mediaId) => { if (state.selection.items.has(mediaId)) state.selection.items.delete(mediaId); else state.selection.items.add(mediaId); updateMediaSelectionUI(); };
  const selectRange = (startId, endId) => {
    const startIndex = state.mediaLibrary.findIndex(m => m.id === startId);
    const endIndex = state.mediaLibrary.findIndex(m => m.id === endId);
    if (startIndex === -1 || endIndex === -1) return;
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    for (let i = minIndex; i <= maxIndex; i++) addToSelection(state.mediaLibrary[i].id);
    updateMediaSelectionUI();
  };
  const updateMediaSelectionUI = () => {
    state.dom.mediaGallery.querySelectorAll('.media-thumbnail').forEach(thumbnail => {
      thumbnail.classList.toggle('selected', state.selection.items.has(thumbnail.dataset.id));
    });
  };

  // FUNKCJE ZARZĄDZANIA PODŚWIETLENIEM AKTYWNEGO MEDIA (Bez zmian)
  const updateActiveHighlight = (mediaId, sourceType) => {
    removeAllActiveHighlights();
    if (!mediaId) return;
    state.activeHighlight.mediaId = mediaId;
    state.activeHighlight.sourceType = sourceType;
    const selector = sourceType === 'library' ? `.media-thumbnail[data-id="${mediaId}"]` : `.playlist-item[data-id="${mediaId}"]`;
    const element = (sourceType === 'library' ? state.dom.mediaGallery : state.dom.playlistContainer).querySelector(selector);
    if (element) element.classList.add('playing-from-here');
  };
  const removeAllActiveHighlights = () => {
    document.querySelectorAll('.media-thumbnail.playing-from-here, .playlist-item.playing-from-here').forEach(el => el.classList.remove('playing-from-here'));
    state.activeHighlight.mediaId = null; state.activeHighlight.sourceType = null;
  };

  // FILE HANDLING (Bez zmian)
  const handleFileSelect = (files) => {
    if (!files || files.length === 0) return;
    let validCount = 0, invalidCount = 0;
    Array.from(files).forEach(file => {
      if (isFileSupported(file.type)) { processFile(file); validCount++; } else { invalidCount++; }
    });
    if (validCount > 0) showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}`, 'success');
    if (invalidCount > 0) showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} not supported`, 'warning');
    updateMediaGallery(); updatePlaylistUI(); saveMediaList();
  };
  const isFileSupported = (type) => state.supportedTypes.video.includes(type) || state.supportedTypes.image.includes(type);
  const processFile = (file) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const url = URL.createObjectURL(file);
    const type = state.supportedTypes.video.includes(file.type) ? 'video' : 'image';
    const mediaItem = { id, name: file.name, type, mimeType: file.type, size: file.size, url, dateAdded: Date.now(), thumbnail: null, settings: { volume: 0, playbackRate: 1 }, trimSettings: type === 'video' ? { trimEnabled: true, startTime: 0, endTime: null } : null };
    if (type === 'video' && mediaItem.settings) mediaItem.settings.trimSettings = { trimEnabled: true, startTime: 0, endTime: null };
    generateThumbnail(mediaItem, file).then(thumbnail => {
      mediaItem.thumbnail = thumbnail;
      if (type === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function() {
          const duration = video.duration;
          if (mediaItem.settings?.trimSettings) mediaItem.settings.trimSettings.endTime = duration;
          if (mediaItem.trimSettings) mediaItem.trimSettings.endTime = duration;
          video.src = ''; URL.revokeObjectURL(video.src);
          updateMediaGallery(); saveMediaList();
        };
        video.src = url;
      } else { updateMediaGallery(); saveMediaList(); }
    });
    state.mediaLibrary.push(mediaItem);
  };
  const generateThumbnail = (mediaItem, file) => new Promise(resolve => {
    if (mediaItem.type === 'image') {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    } else if (mediaItem.type === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata'; video.muted = true;
      video.onloadeddata = function() { video.currentTime = Math.min(1.0, video.duration / 3); };
      video.onseeked = function() {
        const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 90;
        const ctx = canvas.getContext('2d');
        const videoAspectRatio = video.videoWidth / video.videoHeight;
        const canvasAspectRatio = canvas.width / canvas.height;
        let drawWidth = canvas.width, drawHeight = canvas.height, offsetX = 0, offsetY = 0;
        if (videoAspectRatio > canvasAspectRatio) { drawHeight = canvas.width / videoAspectRatio; offsetY = (canvas.height - drawHeight) / 2; }
        else { drawWidth = canvas.height * videoAspectRatio; offsetX = (canvas.width - drawWidth) / 2; }
        ctx.fillStyle = '#1A1A1A'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const centerX = canvas.width / 2, centerY = canvas.height / 2, triangleSize = Math.min(canvas.width, canvas.height) * 0.2;
        ctx.beginPath(); ctx.moveTo(centerX - triangleSize / 2, centerY - triangleSize * 0.866 / 2); ctx.lineTo(centerX - triangleSize / 2, centerY + triangleSize * 0.866 / 2); ctx.lineTo(centerX + triangleSize / 2, centerY); ctx.closePath(); ctx.fill();
        resolve(canvas.toDataURL('image/jpeg', 0.6));
        video.src = ''; URL.revokeObjectURL(video.src);
      };
      video.onerror = function() { console.error("Error loading video for thumbnail:", mediaItem.name); resolve(null); video.src = ''; URL.revokeObjectURL(video.src); }
      video.src = mediaItem.url;
    }
  });


  // UI UPDATES (Bez zmian)
  const updateMediaGallery = () => {
    const gallery = state.dom.mediaGallery;
    const emptyState = document.getElementById('media-empty-state');
    if (!gallery) return;
    if(emptyState) emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
    Array.from(gallery.querySelectorAll('.media-thumbnail')).forEach(child => child.remove());
    state.mediaLibrary.forEach(media => gallery.appendChild(createMediaThumbnail(media)));
    updateMediaSelectionUI();
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'library') updateActiveHighlight(state.activeHighlight.mediaId, 'library');
  };
  const createMediaThumbnail = (media) => {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'media-thumbnail'; thumbnail.dataset.id = media.id; thumbnail.draggable = true;
    const highlightRing = document.createElement('div'); highlightRing.className = 'media-active-highlight-ring'; thumbnail.appendChild(highlightRing);
    thumbnail.addEventListener('dragstart', (e) => {
      if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'multiple-media', ids: Array.from(state.selection.items) }));
      } else { e.dataTransfer.setData('text/plain', media.id); }
      e.dataTransfer.effectAllowed = 'copy';
    });
    const imgContainer = document.createElement('div'); imgContainer.className = 'media-thumbnail-img-container';
    if (media.thumbnail) imgContainer.style.backgroundImage = `url(${media.thumbnail})`;
    else { imgContainer.style.backgroundColor = '#333'; imgContainer.textContent = media.type.charAt(0).toUpperCase(); Object.assign(imgContainer.style, {display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white'}); }
    thumbnail.appendChild(imgContainer);
    const nameLabel = document.createElement('div'); nameLabel.className = 'media-thumbnail-name'; nameLabel.textContent = media.name; thumbnail.appendChild(nameLabel);
    const badge = document.createElement('div'); badge.className = 'media-type-badge'; badge.textContent = media.type.toUpperCase(); thumbnail.appendChild(badge);
    const settingsBtn = document.createElement('button'); settingsBtn.className = 'media-settings-btn btn btn-icon'; settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>'; settingsBtn.setAttribute('aria-label', 'Clip settings');
    settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); openMediaSettingsDialog(media); }); thumbnail.appendChild(settingsBtn);
    const deleteBtn = document.createElement('button'); deleteBtn.className = 'media-delete-btn btn btn-icon btn-danger'; deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'; deleteBtn.setAttribute('aria-label', 'Delete clip');
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); if (state.selection.items.has(media.id) && state.selection.items.size > 1) { if (confirm(`Delete ${state.selection.items.size} selected clips?`)) Array.from(state.selection.items).forEach(id => deleteMedia(id)); } else deleteMedia(media.id); }); thumbnail.appendChild(deleteBtn); // English confirm
    thumbnail.setAttribute('data-tooltip', media.name);
    thumbnail.addEventListener('click', (e) => {
      if (e.target === settingsBtn || settingsBtn.contains(e.target) || e.target === deleteBtn || deleteBtn.contains(e.target)) return;
      if (state.selection.shiftKeyActive && state.selection.lastSelected) selectRange(state.selection.lastSelected, media.id);
      else if (state.selection.shiftKeyActive) { clearSelection(); addToSelection(media.id); state.selection.lastSelected = media.id; updateMediaSelectionUI(); }
      else if (state.selection.items.size > 0 && state.selection.items.has(media.id)) selectMedia(media, true);
      else { clearSelection(); addToSelection(media.id); state.selection.lastSelected = media.id; updateMediaSelectionUI(); selectMedia(media, true); }
    });
    return thumbnail;
  };
  const openMediaSettingsDialog = (media) => {
    const existingDialog = document.getElementById('media-settings-dialog-backdrop');
    if (existingDialog) existingDialog.remove();
    const backdrop = document.createElement('div'); backdrop.id = 'media-settings-dialog-backdrop'; backdrop.className = 'media-settings-dialog-backdrop acrylic acrylic-dark';
    const dialog = document.createElement('div'); dialog.id = 'media-settings-dialog'; dialog.className = 'media-settings-dialog';
    setTimeout(() => { dialog.classList.add('open'); backdrop.classList.add('open'); }, 10);
    const header = document.createElement('div'); header.className = 'media-settings-dialog-header';
    const title = document.createElement('h3'); title.textContent = `Settings: ${media.name}`;
    const closeBtn = document.createElement('button'); closeBtn.className = 'btn btn-icon dialog-close-btn'; closeBtn.innerHTML = '&times;'; closeBtn.setAttribute('aria-label', 'Close settings');
    closeBtn.onclick = () => { dialog.classList.remove('open'); backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 300); };
    header.appendChild(title); header.appendChild(closeBtn); dialog.appendChild(header);
    const body = document.createElement('div'); body.className = 'media-settings-dialog-body';
    const settingsTooltip = document.createElement('div'); settingsTooltip.className = 'settings-tooltip'; settingsTooltip.textContent = 'Settings apply to playback from library and playlist'; body.appendChild(settingsTooltip); // English text
    const nameGroup = document.createElement('div'); nameGroup.className = 'form-group'; const nameLabel = document.createElement('label'); nameLabel.htmlFor = `media-name-${media.id}`; nameLabel.textContent = 'Clip Name:'; const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.id = `media-name-${media.id}`; nameInput.value = media.name; nameGroup.appendChild(nameLabel); nameGroup.appendChild(nameInput); body.appendChild(nameGroup);
    let videoPreview = null, trimContainer = null, trimRegion = null, timeDisplay = null, videoDuration = 0, startTime = 0, endTime = 0;
    if (media.type === 'video') {
      const trimGroup = document.createElement('div'); trimGroup.className = 'form-group'; const trimLabel = document.createElement('label'); trimLabel.textContent = 'Trim Video:'; trimGroup.appendChild(trimLabel);
      videoPreview = document.createElement('video'); videoPreview.src = media.url; videoPreview.controls = true; videoPreview.muted = !(media.settings?.volume > 0); videoPreview.style.cssText = 'width: 100%; margin-bottom: 10px; background-color: #000; border-radius: 4px;'; trimGroup.appendChild(videoPreview);
      let currentTrimSettings = media.settings?.trimSettings || media.trimSettings || { trimEnabled: true, startTime: 0, endTime: null }; startTime = currentTrimSettings.startTime || 0; endTime = currentTrimSettings.endTime;
      videoPreview.onloadedmetadata = function() { videoDuration = videoPreview.duration; if (endTime === null || endTime === 0 || endTime > videoDuration) endTime = videoDuration; videoPreview.currentTime = startTime; updateTimeDisplay(); };
      const trimDescription = document.createElement('div'); trimDescription.className = 'trim-description'; trimDescription.textContent = 'Adjust start and end points using sliders:'; trimGroup.appendChild(trimDescription); // English text
      trimContainer = document.createElement('div');
      const startTimeGroup = document.createElement('div'); startTimeGroup.className = 'form-group'; startTimeGroup.style.marginBottom = '15px'; const startTimeLabel = document.createElement('label'); startTimeLabel.htmlFor = `trim-start-${media.id}`; startTimeLabel.textContent = 'Start Point:'; const startTimeInput = document.createElement('input'); startTimeInput.type = 'range'; startTimeInput.id = `trim-start-${media.id}`; startTimeInput.min = '0'; startTimeInput.max = '100'; startTimeInput.step = '0.1'; startTimeInput.value = (videoDuration ? (startTime / videoDuration) * 100 : 0); const startTimeDisplay = document.createElement('span'); startTimeDisplay.textContent = formatTimeSimple(startTime); startTimeDisplay.style.marginLeft = '10px';
      startTimeInput.oninput = () => { const percent = parseFloat(startTimeInput.value) / 100; startTime = percent * videoDuration; if (startTime >= endTime) { startTime = Math.max(0, endTime - 0.1); startTimeInput.value = (videoDuration ? (startTime / videoDuration) * 100 : 0); } startTimeDisplay.textContent = formatTimeSimple(startTime); videoPreview.currentTime = startTime; updateTimeDisplay(); };
      startTimeGroup.appendChild(startTimeLabel); startTimeGroup.appendChild(startTimeInput); startTimeGroup.appendChild(startTimeDisplay); trimContainer.appendChild(startTimeGroup);
      const endTimeGroup = document.createElement('div'); endTimeGroup.className = 'form-group'; const endTimeLabel = document.createElement('label'); endTimeLabel.htmlFor = `trim-end-${media.id}`; endTimeLabel.textContent = 'End Point:'; const endTimeInput = document.createElement('input'); endTimeInput.type = 'range'; endTimeInput.id = `trim-end-${media.id}`; endTimeInput.min = '0'; endTimeInput.max = '100'; endTimeInput.step = '0.1'; endTimeInput.value = (videoDuration ? (endTime / videoDuration) * 100 : 100); const endTimeDisplay = document.createElement('span'); endTimeDisplay.textContent = formatTimeSimple(endTime); endTimeDisplay.style.marginLeft = '10px';
      endTimeInput.oninput = () => { const percent = parseFloat(endTimeInput.value) / 100; endTime = percent * videoDuration; if (endTime <= startTime) { endTime = startTime + 0.1; endTimeInput.value = (videoDuration ? (endTime / videoDuration) * 100 : 100); } endTimeDisplay.textContent = formatTimeSimple(endTime); videoPreview.currentTime = endTime; updateTimeDisplay(); };
      endTimeGroup.appendChild(endTimeLabel); endTimeGroup.appendChild(endTimeInput); endTimeGroup.appendChild(endTimeDisplay); trimContainer.appendChild(endTimeGroup);
      const trimUIContainer = document.createElement('div'); Object.assign(trimUIContainer.style, { position: 'relative', height: '20px', backgroundColor: '#111', borderRadius: '4px', overflow: 'hidden', marginTop: '15px', marginBottom: '15px' });
      const timeline = document.createElement('div'); Object.assign(timeline.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: '#333' });
      trimRegion = document.createElement('div'); Object.assign(trimRegion.style, { position: 'absolute', top: '0', height: '100%', backgroundColor: 'rgba(var(--primary-color-rgb), 0.5)', borderLeft: '2px solid var(--primary-color)', borderRight: '2px solid var(--primary-color)', boxSizing: 'border-box' });
      timeDisplay = document.createElement('div'); timeDisplay.style.cssText = 'margin-top: 5px; font-size: 12px; text-align: center; color: rgba(255, 255, 255, 0.7);';
      const updateTimeDisplay = () => { if (videoDuration === 0) return; const startPercent = (startTime / videoDuration) * 100; const endPercent = (endTime / videoDuration) * 100; trimRegion.style.left = startPercent + '%'; trimRegion.style.width = Math.max(0, endPercent - startPercent) + '%'; timeDisplay.textContent = `Start: ${formatTimeSimple(startTime)} | End: ${formatTimeSimple(endTime)} | Duration: ${formatTimeSimple(Math.max(0, endTime - startTime))}`; if (startTimeInput) startTimeInput.value = (startTime / videoDuration) * 100; if (endTimeInput) endTimeInput.value = (endTime / videoDuration) * 100; if (startTimeDisplay) startTimeDisplay.textContent = formatTimeSimple(startTime); if (endTimeDisplay) endTimeDisplay.textContent = formatTimeSimple(endTime); };
      timeline.addEventListener('click', (e) => { const trimRect = trimUIContainer.getBoundingClientRect(); const percent = Math.max(0, Math.min(1, (e.clientX - trimRect.left) / trimRect.width)); videoPreview.currentTime = percent * videoDuration; });
      timeline.appendChild(trimRegion); trimUIContainer.appendChild(timeline); trimContainer.appendChild(trimUIContainer); trimContainer.appendChild(timeDisplay); trimGroup.appendChild(trimContainer); body.appendChild(trimGroup);
      const volumeGroup = document.createElement('div'); volumeGroup.className = 'form-group'; const volumeLabel = document.createElement('label'); volumeLabel.htmlFor = `media-volume-${media.id}`; volumeLabel.textContent = 'Volume:'; const volumeInput = document.createElement('input'); volumeInput.type = 'range'; volumeInput.id = `media-volume-${media.id}`; volumeInput.min = '0'; volumeInput.max = '1'; volumeInput.step = '0.01'; volumeInput.value = media.settings?.volume ?? 0; const volumeValueDisplay = document.createElement('span'); volumeValueDisplay.textContent = `${Math.round(volumeInput.value * 100)}%`;
      volumeInput.oninput = () => { volumeValueDisplay.textContent = `${Math.round(volumeInput.value * 100)}%`; if (videoPreview) { videoPreview.volume = volumeInput.value; videoPreview.muted = volumeInput.value === "0"; } }; /* Ensure "0" for muted */
      volumeGroup.appendChild(volumeLabel); volumeGroup.appendChild(volumeInput); volumeGroup.appendChild(volumeValueDisplay); body.appendChild(volumeGroup);
      const rateGroup = document.createElement('div'); rateGroup.className = 'form-group'; const rateLabel = document.createElement('label'); rateLabel.htmlFor = `media-rate-${media.id}`; rateLabel.textContent = 'Playback Speed:'; const rateInput = document.createElement('input'); rateInput.type = 'range'; rateInput.id = `media-rate-${media.id}`; rateInput.min = '0.25'; rateInput.max = '2'; rateInput.step = '0.25'; rateInput.value = media.settings?.playbackRate ?? 1; const rateValueDisplay = document.createElement('span'); rateValueDisplay.textContent = `${rateInput.value}x`;
      rateInput.oninput = () => { rateValueDisplay.textContent = `${rateInput.value}x`; if (videoPreview) videoPreview.playbackRate = parseFloat(rateInput.value); };
      rateGroup.appendChild(rateLabel); rateGroup.appendChild(rateInput); rateGroup.appendChild(rateValueDisplay); body.appendChild(rateGroup);
    }
    const navButtonsContainer = document.createElement('div'); navButtonsContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 20px;';
    const effectsLink = document.createElement('button'); effectsLink.textContent = 'EFFECTS'; effectsLink.className = 'btn btn-secondary setting-btn'; effectsLink.style.flex = '1';
    effectsLink.onclick = () => { closeBtn.click(); document.querySelector('.category-item[data-action="effects"]')?.click(); };
    const transitionsLink = document.createElement('button'); transitionsLink.textContent = 'TRANSITIONS'; transitionsLink.className = 'btn btn-secondary setting-btn'; transitionsLink.style.flex = '1';
    transitionsLink.onclick = () => { closeBtn.click(); document.querySelector('.category-item[data-action="transitions"]')?.click(); };
    navButtonsContainer.appendChild(effectsLink); navButtonsContainer.appendChild(transitionsLink); body.appendChild(navButtonsContainer);
    dialog.appendChild(body);
    const footer = document.createElement('div'); footer.className = 'media-settings-dialog-footer';
    const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-primary'; saveBtn.textContent = 'Save Changes';
    saveBtn.onclick = () => { media.name = nameInput.value; if (media.type === 'video') { if (!media.settings) media.settings = {}; media.settings.volume = parseFloat(document.getElementById(`media-volume-${media.id}`).value); media.settings.playbackRate = parseFloat(document.getElementById(`media-rate-${media.id}`).value); if (!media.settings.trimSettings) media.settings.trimSettings = { trimEnabled: true, startTime: 0, endTime: videoDuration }; media.settings.trimSettings.startTime = startTime; media.settings.trimSettings.endTime = endTime; if (media.trimSettings) { media.trimSettings.startTime = startTime; media.trimSettings.endTime = endTime; }} updateMediaGallery(); updatePlaylistUI(); saveMediaList(); showNotification('Settings saved!', 'success'); closeBtn.click(); };
    const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn btn-secondary'; cancelBtn.textContent = 'Cancel'; cancelBtn.onclick = () => closeBtn.click();
    footer.appendChild(cancelBtn); footer.appendChild(saveBtn); dialog.appendChild(footer);
    backdrop.appendChild(dialog); document.body.appendChild(backdrop); nameInput.focus();
  };


  // PLAYLIST DRAG & DROP HANDLERS (Bez zmian)
  const handlePlaylistDragOver = (e) => { e.preventDefault(); const isReordering = e.dataTransfer.types.includes('application/json'); const isAddingNew = e.dataTransfer.types.includes('text/plain'); if (isReordering) e.dataTransfer.dropEffect = 'move'; else if (isAddingNew) e.dataTransfer.dropEffect = 'copy'; else e.dataTransfer.dropEffect = 'none'; };
  const handlePlaylistDrop = (e) => {
    e.preventDefault(); e.currentTarget.style.backgroundColor = '';
    try {
      const jsonDataText = e.dataTransfer.getData('application/json');
      if (jsonDataText) {
        const jsonData = JSON.parse(jsonDataText);
        if (jsonData?.type === 'multiple-media') { const { ids } = jsonData; if (Array.isArray(ids) && ids.length > 0) { ids.forEach(id => addToPlaylist(id, state.playlist.items.length)); showNotification(`Added ${ids.length} items to playlist`, 'success'); } return; }
        else if (jsonData?.type === 'playlist-reorder') { const fromIndex = parseInt(jsonData.index); if (!isNaN(fromIndex) && fromIndex >= 0 && fromIndex < state.playlist.items.length) reorderPlaylistItem(fromIndex, state.playlist.items.length - 1); return; }
      }
      const mediaId = e.dataTransfer.getData('text/plain'); if (mediaId) { const media = state.mediaLibrary.find(m => m.id === mediaId); if (media) addToPlaylist(mediaId, state.playlist.items.length); }
    } catch (err) { console.error('Error in handlePlaylistDrop (on container):', err); }
  };

  // PLAYLIST MANAGEMENT (Bez zmian)
  const addToPlaylist = (mediaId, insertAtIndex = -1) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId); if (!media) return;
    const wasEmpty = state.playlist.items.length === 0;
    if (insertAtIndex === -1 || insertAtIndex >= state.playlist.items.length) state.playlist.items.push(mediaId);
    else { state.playlist.items.splice(insertAtIndex, 0, mediaId); if (state.playlist.isPlaying && insertAtIndex <= state.playlist.currentIndex) state.playlist.currentIndex++; }
    if (wasEmpty && state.playlist.items.length > 0) state.playlist.currentIndex = 0;
    updatePlaylistUI(); saveMediaList(); showNotification(`Added to playlist: ${media.name}`, 'success');
  };
  const removeFromPlaylist = (index) => {
    if (index < 0 || index >= state.playlist.items.length) return;
    const mediaId = state.playlist.items[index]; const media = state.mediaLibrary.find(m => m.id === mediaId); state.playlist.items.splice(index, 1);
    if (state.playlist.isPlaying) {
      if (index === state.playlist.currentIndex) { if (state.playlist.items.length > 0) { if (state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = 0; playMediaByIndex(state.playlist.currentIndex); } else stopPlaylist(); }
      else if (index < state.playlist.currentIndex) state.playlist.currentIndex--;
    } else { if (state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = Math.max(0, state.playlist.items.length - 1); else if (index < state.playlist.currentIndex) state.playlist.currentIndex--; if (state.playlist.items.length === 0) state.playlist.currentIndex = -1; }
    updatePlaylistUI(); saveMediaList(); if (media) showNotification(`Removed from playlist: ${media.name}`, 'info');
  };
  const reorderPlaylistItem = (fromIndex, toIndex) => {
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length || toIndex < 0 || toIndex >= state.playlist.items.length || fromIndex === toIndex) return;
    try {
      const itemToMove = state.playlist.items.splice(fromIndex, 1)[0]; state.playlist.items.splice(toIndex, 0, itemToMove);
      if (state.playlist.isPlaying) { if (fromIndex === state.playlist.currentIndex) state.playlist.currentIndex = toIndex; else { if (fromIndex < state.playlist.currentIndex && toIndex >= state.playlist.currentIndex) state.playlist.currentIndex--; else if (fromIndex > state.playlist.currentIndex && toIndex <= state.playlist.currentIndex) state.playlist.currentIndex++; }}
      else { if (fromIndex === state.playlist.currentIndex) state.playlist.currentIndex = toIndex; else { if (fromIndex < state.playlist.currentIndex && toIndex >= state.playlist.currentIndex) state.playlist.currentIndex--; else if (fromIndex > state.playlist.currentIndex && toIndex <= state.playlist.currentIndex) state.playlist.currentIndex++; }}
      updatePlaylistUI(); saveMediaList();
    } catch (e) { console.error('Error reordering playlist item:', e); }
  };
  const clearPlaylist = () => {
    try { stopPlaylist(); state.playlist.items = []; state.playlist.currentIndex = -1; clearPlaybackTimers(); updatePlaylistUI(); saveMediaList(); showNotification('Playlist cleared', 'info'); }
    catch (e) { console.error('Error in clearPlaylist:', e); }
  };


  // MEDIA PLAYBACK (Bez zmian)
  const selectMedia = (media, loopSingle = false) => {
    stopPlaylist(false); clearMediaDisplay();
    const element = createMediaElement(media, !loopSingle, loopSingle);
    if (element) { state.dom.mediaContainer.appendChild(element); showNotification(`Now playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info'); state.playlist.isPlaying = !loopSingle; if (loopSingle) { state.playlist.currentIndex = -1; updateActiveHighlight(media.id, 'library'); } else updateActiveHighlight(null); updatePlaylistUI(); }
  };
  const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
    let element; if (!media || !media.type) return null;
    const useTrim = media.type === 'video' && (media.settings?.trimSettings?.trimEnabled || media.trimSettings?.trimEnabled);
    const trimSettingsToUse = media.settings?.trimSettings || media.trimSettings;
    if (media.type === 'image') { element = document.createElement('img'); element.src = media.url; Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' }); if (isPlaylistContext) { clearPlaybackTimers(); state.playlist.playbackTimer = setTimeout(() => { if (state.playlist.isPlaying) playNextItem(); }, 5000); }}
    else if (media.type === 'video') { element = document.createElement('video'); element.src = media.url; element.autoplay = true; element.loop = loopOverride; element.muted = (media.settings?.volume === 0) || (media.settings?.volume === undefined && !isPlaylistContext); element.volume = media.settings?.volume ?? (isPlaylistContext ? 0.5 : 0); element.playbackRate = media.settings?.playbackRate ?? 1; Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });
      element.addEventListener('error', function(e) { console.error(`Error loading video: ${media.name}`, e); if (isPlaylistContext && state.playlist.isPlaying) setTimeout(() => playNextItem(), 100); });
      if (useTrim && trimSettingsToUse) { element.addEventListener('loadedmetadata', function() { this.currentTime = trimSettingsToUse.startTime || 0; }); element.addEventListener('timeupdate', function() { if (this.currentTime < (trimSettingsToUse.startTime - 0.1)) this.currentTime = trimSettingsToUse.startTime; if (trimSettingsToUse.endTime && this.currentTime >= trimSettingsToUse.endTime) { if (isPlaylistContext && state.playlist.isPlaying && !loopOverride) playNextItem(); else if (loopOverride) { this.currentTime = trimSettingsToUse.startTime || 0; this.play(); } else this.pause(); }}); }
      if (isPlaylistContext && !loopOverride && !useTrim) element.addEventListener('ended', () => { if (state.playlist.isPlaying) playNextItem(); });
    } return element;
  };
  const playPlaylist = () => {
    if (state.playlist.items.length === 0) { showNotification('Playlist is empty.', 'info'); return; }
    const playAllButton = document.getElementById('playlist-play-button'); const isPlayAllClick = playAllButton && playAllButton.contains(event?.target);
    if (state.playlist.isPlaying && isPlayAllClick) { pausePlaylist(); return; }
    clearPlaybackTimers(); state.playlist.advancingInProgress = false;
    if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = state.playlist.shuffle ? Math.floor(Math.random() * state.playlist.items.length) : 0;
    state.playlist.isPlaying = true; clearMediaDisplay(); playMediaByIndex(state.playlist.currentIndex); updatePlaylistUI();
  };
  const pausePlaylist = () => {
    state.playlist.isPlaying = false; clearPlaybackTimers(); const videoElement = state.dom.mediaContainer.querySelector('video'); if (videoElement) videoElement.pause(); updatePlaylistUI(); showNotification("Playlist paused", "info");
  };
  const playMediaByIndex = (index) => {
    if (index < 0 || index >= state.playlist.items.length) { if (state.playlist.items.length > 0) { index = 0; state.playlist.currentIndex = 0; } else { stopPlaylist(); return; }}
    const mediaId = state.playlist.items[index]; const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) { if (state.playlist.isPlaying) { state.playlist.items.splice(index, 1); if (index < state.playlist.currentIndex) state.playlist.currentIndex--; if (state.playlist.items.length === 0) { stopPlaylist(); return; } const nextIndexToTry = Math.min(index, state.playlist.items.length - 1); playNextItem(nextIndexToTry); } return; }
    state.playlist.currentIndex = index; state.playlist.isPlaying = true; clearMediaDisplay();
    const element = createMediaElement(media, true);
    if (element) { state.dom.mediaContainer.appendChild(element); if (element.tagName.toLowerCase() === 'video' && typeof element.load === 'function') { element.load(); element.play().catch(e => console.warn("Autoplay prevented:", media.name, e)); } updateActiveHighlight(media.id, 'playlist'); updatePlaylistUI(); }
    else if (state.playlist.isPlaying) playNextItem();
  };
  const playNextItem = (startIndex = -1) => {
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) { stopPlaylist(); return; } if (state.playlist.advancingInProgress) return; state.playlist.advancingInProgress = true; clearPlaybackTimers(); let nextIndex;
    if (startIndex !== -1 && startIndex < state.playlist.items.length) nextIndex = startIndex;
    else if (state.playlist.shuffle) { if (state.playlist.items.length > 1) { do { nextIndex = Math.floor(Math.random() * state.playlist.items.length); } while (nextIndex === state.playlist.currentIndex); } else nextIndex = 0; }
    else nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
    state.playlist.currentIndex = nextIndex; playMediaByIndex(nextIndex); setTimeout(() => { state.playlist.advancingInProgress = false; }, 100);
  };
  const clearPlaybackTimers = () => { if (state.playlist.playbackTimer) { clearTimeout(state.playlist.playbackTimer); state.playlist.playbackTimer = null; } };
  const toggleShuffle = () => { state.playlist.shuffle = !state.playlist.shuffle; updatePlaylistUI(); showNotification(state.playlist.shuffle ? 'Shuffle mode: On' : 'Shuffle mode: Off', 'info'); };
  const stopPlaylist = (resetIndexAndDisplay = true) => {
    state.playlist.isPlaying = false; clearPlaybackTimers(); const videoElement = state.dom.mediaContainer.querySelector('video'); if (videoElement) videoElement.pause();
    if (resetIndexAndDisplay) { state.playlist.currentIndex = -1; clearMediaDisplay(); } updatePlaylistUI();
  };
  const clearMediaDisplay = () => {
    try { clearPlaybackTimers(); while (state.dom.mediaContainer.firstChild) { const el = state.dom.mediaContainer.firstChild; if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) { el.pause(); el.removeAttribute('src'); if (typeof el.load === 'function') el.load(); } state.dom.mediaContainer.removeChild(el); }}
    catch (e) { console.error("Error clearing media display:", e); if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = ''; }
  };

  // MEDIA MANAGEMENT (Bez zmian)
  const deleteMedia = (id) => {
    const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id); if (indexInLibrary === -1) return;
    const mediaToDelete = state.mediaLibrary[indexInLibrary]; URL.revokeObjectURL(mediaToDelete.url); state.mediaLibrary.splice(indexInLibrary, 1);
    let wasPlayingDeletedItem = false, deletedItemCurrentIndex = -1;
    for (let i = state.playlist.items.length - 1; i >= 0; i--) { if (state.playlist.items[i] === id) { if (state.playlist.isPlaying && i === state.playlist.currentIndex) { wasPlayingDeletedItem = true; deletedItemCurrentIndex = i; } state.playlist.items.splice(i, 1); if (i < state.playlist.currentIndex) state.playlist.currentIndex--; }}
    if (wasPlayingDeletedItem) { if (state.playlist.items.length > 0) { const nextIndexToPlay = Math.min(deletedItemCurrentIndex, state.playlist.items.length - 1); playMediaByIndex(nextIndexToPlay); } else stopPlaylist(); }
    else if (state.playlist.currentIndex >= state.playlist.items.length && state.playlist.items.length > 0) state.playlist.currentIndex = state.playlist.items.length - 1;
    const currentMediaElement = state.dom.mediaContainer.querySelector('img, video'); if (currentMediaElement && currentMediaElement.src === mediaToDelete.url) clearMediaDisplay();
    if (state.mediaLibrary.length === 0) clearPlaylist(); else updatePlaylistUI();
    updateMediaGallery(); saveMediaList(); showNotification(`Removed: ${mediaToDelete.name}`, 'info');
  };


  // PLAYLIST UI UPDATE (Bez zmian)
  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer; const emptyState = document.getElementById('playlist-empty-state'); const controlsContainer = state.dom.playlistControlsContainer;
    if (!playlistContainer || !controlsContainer) return;
    Array.from(playlistContainer.querySelectorAll('.playlist-item')).forEach(child => child.remove());
    if (state.playlist.items.length === 0) { if(emptyState) emptyState.style.display = 'block'; controlsContainer.style.visibility = 'hidden'; }
    else { if(emptyState) emptyState.style.display = 'none'; controlsContainer.style.visibility = 'visible'; state.playlist.items.forEach((mediaId, index) => { const media = state.mediaLibrary.find(m => m.id === mediaId); if (media) playlistContainer.appendChild(createPlaylistItem(media, index)); }); }
    const shuffleButton = document.getElementById('playlist-shuffle-button'); if (shuffleButton) shuffleButton.classList.toggle('active', state.playlist.shuffle);
    const playButton = document.getElementById('playlist-play-button'); if (playButton) playButton.innerHTML = state.playlist.isPlaying ? '<span style="filter: grayscale(100%);">⏸</span> Pause' : '<span style="filter: grayscale(100%);">▶</span> Play All';
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'playlist') updateActiveHighlight(state.activeHighlight.mediaId, 'playlist');
  };
  const createPlaylistItem = (media, index) => {
    const item = document.createElement('div'); item.className = 'playlist-item'; item.dataset.id = media.id; item.dataset.index = index; if (index === state.playlist.currentIndex) item.classList.add('current');
    const highlightRing = document.createElement('div'); highlightRing.className = 'media-active-highlight-ring'; item.appendChild(highlightRing);
    item.draggable = true;
    item.addEventListener('dragstart', function(e) { e.dataTransfer.setData('application/json', JSON.stringify({ type: 'playlist-reorder', id: media.id, index: index })); e.dataTransfer.effectAllowed = 'move'; this.classList.add('dragging'); });
    item.addEventListener('dragend', function() { this.classList.remove('dragging'); document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom')); });
    item.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const rect = this.getBoundingClientRect(); const isOverTopHalf = e.clientY < rect.top + rect.height / 2; document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom')); if (isOverTopHalf) this.classList.add('drag-over-top'); else this.classList.add('drag-over-bottom'); });
    item.addEventListener('dragleave', function() { this.classList.remove('drag-over-top', 'drag-over-bottom'); });
    item.addEventListener('drop', function(e) { e.preventDefault(); e.stopPropagation(); this.classList.remove('drag-over-top', 'drag-over-bottom'); try { const dataText = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain'); if (!dataText) return; let droppedData; try { droppedData = JSON.parse(dataText); } catch (err) { const mediaId = dataText; const targetIndex = parseInt(this.dataset.index); const rect = this.getBoundingClientRect(); const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2; const insertAtIndex = isDroppedOnTopHalf ? targetIndex : targetIndex + 1; addToPlaylist(mediaId, insertAtIndex); return; } if (droppedData?.type === 'playlist-reorder') { const fromIndex = parseInt(droppedData.index); let toIndex = parseInt(this.dataset.index); if (fromIndex === toIndex) return; const rect = this.getBoundingClientRect(); const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2; if (!isDroppedOnTopHalf && fromIndex < toIndex) {} else if (isDroppedOnTopHalf && fromIndex > toIndex) {} else if (fromIndex < toIndex) toIndex = isDroppedOnTopHalf ? toIndex -1 : toIndex; else toIndex = isDroppedOnTopHalf ? toIndex : toIndex +1; if (fromIndex < toIndex) toIndex--; reorderPlaylistItem(fromIndex, toIndex); } else if (droppedData?.type === 'multiple-media') { const { ids } = droppedData; if (Array.isArray(ids) && ids.length > 0) { const targetIndex = parseInt(this.dataset.index); const rect = this.getBoundingClientRect(); const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2; const insertAtIndex = isDroppedOnTopHalf ? targetIndex : targetIndex + 1; ids.forEach((id, i) => addToPlaylist(id, insertAtIndex + i)); showNotification(`Added ${ids.length} items to playlist`, 'success'); }}} catch (err) { console.error('Error during playlist drop handling:', err); }});
    const thumbnail = document.createElement('div'); thumbnail.className = 'playlist-item-thumbnail'; if (media.thumbnail) thumbnail.style.backgroundImage = `url(${media.thumbnail})`; else { thumbnail.style.backgroundColor = '#333'; thumbnail.textContent = media.type.charAt(0).toUpperCase(); }
    let isTrimmed = false; if (media.type === 'video') { const trimSettings = media.settings?.trimSettings || media.trimSettings; if (trimSettings?.trimEnabled) isTrimmed = true; } if (isTrimmed) { const trimIndicator = document.createElement('div'); trimIndicator.className = 'playlist-item-trim-indicator'; trimIndicator.innerHTML = '<span style="filter: grayscale(100%);">✂️</span>'; thumbnail.appendChild(trimIndicator); }
    const infoContainer = document.createElement('div'); infoContainer.className = 'playlist-item-info'; const nameEl = document.createElement('div'); nameEl.className = 'playlist-item-name'; nameEl.textContent = media.name; infoContainer.appendChild(nameEl);
    const detailsEl = document.createElement('div'); detailsEl.className = 'playlist-item-details'; let detailsText = `${media.type} · ${formatFileSize(media.size)}`; if (isTrimmed && media.type === 'video') { const trimSettings = media.settings?.trimSettings || media.trimSettings; detailsText += ` · Trimmed`; if (trimSettings.startTime !== undefined && trimSettings.endTime !== undefined) { const duration = trimSettings.endTime - trimSettings.startTime; if (duration > 0) detailsText += ` (${formatTimeSimple(duration)})`; }} detailsEl.textContent = detailsText; infoContainer.appendChild(detailsEl);
    const deleteBtn = document.createElement('button'); deleteBtn.className = 'btn btn-icon btn-danger playlist-item-delete'; deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'; deleteBtn.setAttribute('aria-label', 'Remove from playlist');
    item.addEventListener('click', function(e) { if (e.target === deleteBtn || deleteBtn.contains(e.target)) return; if (state.playlist.isPlaying && state.playlist.currentIndex === index) { pausePlaylist(); return; } state.playlist.currentIndex = index; playPlaylist(); updateActiveHighlight(media.id, 'playlist'); });
    deleteBtn.addEventListener('click', function(e) { e.stopPropagation(); removeFromPlaylist(index); });
    item.appendChild(thumbnail); item.appendChild(infoContainer); item.appendChild(deleteBtn);
    if (index === state.playlist.currentIndex && state.playlist.isPlaying) { const playingIndicator = document.createElement('div'); playingIndicator.className = 'playlist-item-playing-indicator'; playingIndicator.innerHTML = '<span style="filter: grayscale(100%);">▶</span>'; thumbnail.appendChild(playingIndicator); }
    return item;
  };


  // STORAGE FUNCTIONS (Bez zmian)
  const saveMediaList = () => {
    try { const mediaForStorage = state.mediaLibrary.map(media => { const { url, thumbnail, ...mediaMeta } = media; return { ...mediaMeta, name: media.name, type: media.type, mimeType: media.mimeType, size: media.size, dateAdded: media.dateAdded, settings: media.settings, trimSettings: media.trimSettings }; }); const storageData = { media: mediaForStorage, playlist: { items: state.playlist.items, shuffle: state.playlist.shuffle }}; localStorage.setItem('flStudioWallpaper_media_v2', JSON.stringify(storageData)); }
    catch (e) { console.error('Failed to save media list:', e); showNotification('Error saving media library.', 'error'); }
  };
  const loadSavedMedia = () => {
    try { const savedData = localStorage.getItem('flStudioWallpaper_media_v2'); if (!savedData) return; const parsedData = JSON.parse(savedData);
      if (parsedData.media?.length > 0) showNotification( `Found ${parsedData.media.length} media entries. Please re-import files.`, 'info' );
      if (parsedData.playlist) state.playlist.shuffle = parsedData.playlist.shuffle || false;
      updateMediaGallery(); updatePlaylistUI();
    } catch (e) { console.error('Failed to load media data:', e); localStorage.removeItem('flStudioWallpaper_media_v2'); }
  };

  // UTILITY FUNCTIONS (Bez zmian)
  const formatFileSize = (bytes) => { if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'; return (bytes / 1073741824).toFixed(1) + ' GB'; };
  const formatTimeSimple = (totalSeconds) => { const minutes = Math.floor(totalSeconds / 60); const seconds = Math.floor(totalSeconds % 60); return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; };
  const showNotification = (message, type) => { if (typeof WallpaperApp !== 'undefined' && WallpaperApp.UI?.showNotification === 'function') WallpaperApp.UI.showNotification(message, type); else console.log(`[${type?.toUpperCase() || 'INFO'}] ${message}`); };

  // Public API (bez zmian)
  return {
    init,
    getCurrentPlaylist: () => state.playlist,
    getMediaLibrary: () => state.mediaLibrary,
    openMediaSettings: (mediaId) => { const media = state.mediaLibrary.find(m => m.id === mediaId); if (media) openMediaSettingsDialog(media); }
  };
})();

MediaModule.init();

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
      playbackTimer: null,
      advancingInProgress: false,
      lastTransitionTime: 0
    },
    dom: {
      importSubmenu: null,
      mediaContainer: null,
      mediaGallery: null,
      playlistContainer: null,
      playlistControlsContainer: null, // Dodano referencję do kontenera przycisków
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
      console.error('Required DOM elements not found for MediaModule');
      return;
    }

    document.head.appendChild(createStyleElement()); // Style dla scrollbarów, jeśli nadal potrzebne
    setupMediaImportUI();
    loadSavedMedia();
  };

  const createStyleElement = () => {
    const style = document.createElement('style');
    style.textContent = `
      /* Można usunąć, jeśli scrollbary są już globalnie ostylowane w style.css */
      /* #playlist-container::-webkit-scrollbar,
      #media-gallery::-webkit-scrollbar {
        display: none; 
      } */
    `;
    return style;
  };

  // UI SETUP
  const setupMediaImportUI = () => {
    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
    if (!menuContent) {
      console.error("Menu content not found in import-media-submenu");
      return;
    }

    setupFileInput();
    setupImportButton();

    const divider = document.createElement('hr');
    divider.className = 'divider'; // Użycie klasy divider z CSS
    menuContent.appendChild(divider);

    menuContent.appendChild(createMediaLibrarySection());
    menuContent.appendChild(createPlaylistSection());

    // Inicjalizacja kontenera kontrolek odtwarzania (jeśli jest używany gdzie indziej)
    state.dom.playbackControls = { style: { display: 'none' } }; // Przykładowa inicjalizacja
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
    // Przycisk "IMPORT MEDIA" w submenu jest teraz .category-item lub .submenu-item
    // Jego styl jest zarządzany przez CSS, nie wymaga dodatkowych klas .btn
    const importButton = state.dom.importSubmenu.querySelector('.submenu-item[data-action="import-media"]');
    if (importButton) {
      importButton.addEventListener('click', () => state.fileInput.click());
    }
  };

  const createMediaLibrarySection = () => {
    const section = document.createElement('div');
    section.id = 'media-library-section';
    section.style.marginTop = '15px';

    const title = document.createElement('h3');
    title.textContent = 'MEDIA';
    title.style.fontSize = '14px';
    title.style.marginBottom = '10px';
    title.style.color = 'rgba(255, 255, 255, 0.7)';
    section.appendChild(title);

    const gallery = document.createElement('div');
    gallery.id = 'media-gallery';
    // Style dla gallery są teraz w CSS, można usunąć stąd powielone
    gallery.style.msOverflowStyle = 'none'; // Firefox
    gallery.style.scrollbarWidth = 'none';  // Firefox

    const emptyState = document.createElement('div');
    emptyState.id = 'media-empty-state';
    emptyState.textContent = 'No media imported yet';
    emptyState.style.padding = '15px';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(255, 255, 255, 0.5)';
    emptyState.style.gridColumn = '1 / -1'; // Dla layoutu grid w #media-gallery

    gallery.appendChild(emptyState);
    section.appendChild(gallery);
    state.dom.mediaGallery = gallery;
    return section;
  };

  const createPlaylistSection = () => {
    const section = document.createElement('div');
    section.id = 'playlist-section';
    // Style dla playlist-section są w CSS

    const title = document.createElement('h3');
    title.textContent = 'PLAYLIST';
    title.style.fontSize = '14px';
    title.style.marginBottom = '10px';
    title.style.color = 'rgba(255, 255, 255, 0.7)';
    section.appendChild(title);

    const playlistContainer = document.createElement('div');
    playlistContainer.id = 'playlist-container';
    // Style dla playlist-container są w CSS
    playlistContainer.style.msOverflowStyle = 'none';
    playlistContainer.style.scrollbarWidth = 'none';
    playlistContainer.style.display = 'flex'; // Potrzebne dla flex-direction
    playlistContainer.style.flexDirection = 'column';
    playlistContainer.style.gap = '8px';


    playlistContainer.addEventListener('dragover', handlePlaylistDragOver);
    playlistContainer.addEventListener('drop', handlePlaylistDrop);
    playlistContainer.addEventListener('dragenter', e => {
      e.preventDefault();
      playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)'; // Feedback wizualny
    });
    playlistContainer.addEventListener('dragleave', e => {
      e.preventDefault();
      // Przywrócenie tła z CSS (jeśli .acrylic jest używane, to będzie bardziej skomplikowane)
      // Na razie zakładamy, że nie ma .acrylic bezpośrednio na tym elemencie dynamicznie
      const playlistStyle = window.getComputedStyle(playlistContainer);
      playlistContainer.style.backgroundColor = playlistStyle.getPropertyValue('background-color') || 'rgba(0, 0, 0, 0.2)';
    });

    const emptyState = document.createElement('div');
    emptyState.id = 'playlist-empty-state';
    emptyState.textContent = 'Drag media here to create playlist';
    emptyState.style.padding = '15px';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(255, 255, 255, 0.5)';

    playlistContainer.appendChild(emptyState);
    section.appendChild(playlistContainer);

    // Tworzenie kontenera dla przycisków, jeśli nie istnieje w HTML
    let controlsContainer = document.getElementById('playlist-controls');
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.id = 'playlist-controls';
      // Style dla #playlist-controls są w CSS
      section.appendChild(controlsContainer); // Dodaj do sekcji playlisty
    }
    state.dom.playlistControlsContainer = controlsContainer;


    createPlaylistControls(controlsContainer); // Przekaż kontener do funkcji

    state.dom.playlistContainer = playlistContainer;
    return section;
  };

  const createPlaylistControls = (controlsContainer) => { // Akceptuje kontener jako argument
    // Czyścimy istniejące przyciski, aby uniknąć duplikatów przy wielokrotnym wywołaniu
    controlsContainer.innerHTML = '';
    controlsContainer.style.visibility = 'hidden'; // Domyślnie ukryte

    const buttons = [
      { id: 'playlist-play-button', html: '<span style="filter: grayscale(100%);">▶</span> Play All', handler: playPlaylist, class: 'btn-primary' }, // Dodano klasę wariantu
      { id: 'playlist-shuffle-button', html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle', handler: toggleShuffle, class: 'btn-secondary' },
      { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', handler: clearPlaylist, class: 'btn-danger' }
    ];

    buttons.forEach(btnData => {
      const button = document.createElement('button');
      button.id = btnData.id;
      button.innerHTML = btnData.html;
      // Zastosowanie nowych klas CSS
      button.className = `btn playlist-button ${btnData.class || 'btn-secondary'}`; // Domyślnie btn-secondary

      button.addEventListener('click', btnData.handler);
      controlsContainer.appendChild(button);
    });
    // Nie zwracamy controls, bo dodajemy bezpośrednio do przekazanego kontenera
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

    if (validCount > 0) showNotification(`Imported ${validCount} media file${validCount !== 1 ? 's' : ''}`, 'success');
    if (invalidCount > 0) showNotification(`${invalidCount} file${invalidCount !== 1 ? 's' : ''} not supported`, 'warning');

    updateMediaGallery();
    updatePlaylistUI(); // To wywoła też aktualizację widoczności kontrolek
    saveMediaList();
  };

  const isFileSupported = (type) => {
    return state.supportedTypes.video.includes(type) || state.supportedTypes.image.includes(type);
  };

  const processFile = (file) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const url = URL.createObjectURL(file);
    const type = state.supportedTypes.video.includes(file.type) ? 'video' : 'image';

    const mediaItem = {
      id, name: file.name, type, mimeType: file.type, size: file.size, url, dateAdded: Date.now(), thumbnail: null,
      trimSettings: type === 'video' ? { trimEnabled: true, startTime: 0, endTime: null } : null
    };

    generateThumbnail(mediaItem, file).then(thumbnail => {
      mediaItem.thumbnail = thumbnail;
      if (type === 'video') {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.onloadedmetadata = function() {
          const duration = video.duration;
          mediaItem.trimSettings.endTime = duration > 30 ? 15 : duration; // Domyślny trim do 15s dla długich wideo
          video.src = ''; // Zwolnij zasób
          updateMediaGallery();
          saveMediaList();
        };
        video.src = url;
      } else {
        updateMediaGallery();
        saveMediaList();
      }
    });
    state.mediaLibrary.push(mediaItem);
  };

  const generateThumbnail = (mediaItem, file) => {
    return new Promise(resolve => {
      if (mediaItem.type === 'image') {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      } else if (mediaItem.type === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadeddata = function() { video.currentTime = Math.min(1.0, video.duration / 3); };
        video.onseeked = function() {
          const canvas = document.createElement('canvas');
          canvas.width = 150; canvas.height = 150;
          const ctx = canvas.getContext('2d');
          const aspectRatio = video.videoWidth / video.videoHeight;
          let drawWidth = canvas.width, drawHeight = canvas.height;
          if (aspectRatio > 1) drawHeight = canvas.width / aspectRatio;
          else drawWidth = canvas.height * aspectRatio;
          const offsetX = (canvas.width - drawWidth) / 2, offsetY = (canvas.height - drawHeight) / 2;
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          const centerX = canvas.width / 2, centerY = canvas.height / 2, triangleSize = 20;
          ctx.beginPath(); ctx.moveTo(centerX + triangleSize, centerY);
          ctx.lineTo(centerX - triangleSize/2, centerY + triangleSize);
          ctx.lineTo(centerX - triangleSize/2, centerY - triangleSize);
          ctx.closePath(); ctx.fill();
          resolve(canvas.toDataURL('image/jpeg', 0.7));
          video.src = ''; // Zwolnij zasób
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

    Array.from(gallery.children).forEach(child => { if (child.id !== 'media-empty-state') child.remove(); });
    emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
    state.mediaLibrary.forEach(media => gallery.appendChild(createMediaThumbnail(media)));
  };

  const createMediaThumbnail = (media) => {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'media-thumbnail';
    thumbnail.dataset.id = media.id;
    // Style dla .media-thumbnail są w CSS
    thumbnail.draggable = true;
    thumbnail.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', media.id); e.dataTransfer.effectAllowed = 'copy'; });
    thumbnail.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.05)'; this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)'; });
    thumbnail.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; this.style.boxShadow = 'none'; });

    const imgContainer = document.createElement('div');
    // Style dla imgContainer są w CSS lub inline jeśli specyficzne
    imgContainer.style.width = '100%'; imgContainer.style.height = '100%';
    imgContainer.style.display = 'flex'; imgContainer.style.alignItems = 'center'; imgContainer.style.justifyContent = 'center';
    if (media.thumbnail) { imgContainer.style.backgroundImage = `url(${media.thumbnail})`; imgContainer.style.backgroundSize = 'cover'; imgContainer.style.backgroundPosition = 'center';}

    const badge = document.createElement('div');
    badge.className = 'media-type-badge'; badge.textContent = media.type.toUpperCase();
    // Style dla .media-type-badge są w CSS

    if (media.type === 'video') { // Zawsze pokazuj ikonę ustawień dla wideo
      const settingsBtn = document.createElement('div');
      settingsBtn.className = 'media-settings btn btn-icon'; // Użycie klas .btn .btn-icon
      settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>'; // SVG ikony zębatki
      settingsBtn.style.position = 'absolute'; settingsBtn.style.top = '4px'; settingsBtn.style.left = '4px';
      // Usunięto style opacity, bo .btn-icon ma swoje stany hover
      settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); openTrimSettings(media); });
      thumbnail.appendChild(settingsBtn);
    }

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'media-delete btn btn-icon btn-danger'; // Użycie klas .btn .btn-icon .btn-danger
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'; // SVG ikony X
    deleteBtn.style.position = 'absolute'; deleteBtn.style.top = '4px'; deleteBtn.style.right = '4px';
    // Usunięto style opacity

    thumbnail.setAttribute('data-tooltip', media.name);
    thumbnail.addEventListener('click', () => selectMedia(media));
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteMedia(media.id); });

    thumbnail.appendChild(imgContainer);
    thumbnail.appendChild(badge);
    thumbnail.appendChild(deleteBtn);
    return thumbnail;
  };

  const openTrimSettings = (media) => {
    if (media.type !== 'video') return;

    const backdrop = document.createElement('div');
    backdrop.className = 'trim-dialog-backdrop'; // Można ostylować w CSS
    Object.assign(backdrop.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: '1000', display: 'flex', justifyContent: 'center', alignItems: 'center' });

    const dialog = document.createElement('div');
    dialog.className = 'trim-dialog'; // Można ostylować w CSS
    Object.assign(dialog.style, { width: '80%', maxWidth: '600px', backgroundColor: '#222', borderRadius: '8px', padding: '20px', color: 'white', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' });

    const title = document.createElement('h3');
    title.textContent = 'Trim Video'; title.style.marginTop = '0'; title.style.marginBottom = '15px';

    const videoPreview = document.createElement('video');
    videoPreview.src = media.url; videoPreview.controls = true;
    videoPreview.style.width = '100%'; videoPreview.style.marginBottom = '20px'; videoPreview.style.backgroundColor = '#000'; videoPreview.style.borderRadius = '4px';

    let videoDuration = 0;
    let startTime = media.trimSettings ? media.trimSettings.startTime || 0 : 0;
    let endTime = media.trimSettings && media.trimSettings.endTime !== null ? media.trimSettings.endTime : videoDuration;

    videoPreview.onloadedmetadata = function() {
      videoDuration = videoPreview.duration;
      if (!endTime || endTime === 0 || endTime > videoDuration) endTime = videoDuration;
      updateTimeDisplay();
    };

    const formatTime = (seconds) => { const min = Math.floor(seconds / 60), sec = Math.floor(seconds % 60), ms = Math.floor((seconds % 1) * 100); return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`; };
    const trimContainer = document.createElement('div'); trimContainer.style.marginBottom = '20px';
    const trimUIContainer = document.createElement('div'); Object.assign(trimUIContainer.style, { position: 'relative', height: '50px', backgroundColor: '#111', borderRadius: '4px', overflow: 'hidden', marginTop: '10px', marginBottom: '10px' });
    const timeline = document.createElement('div'); Object.assign(timeline.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: '#333' });
    const trimRegion = document.createElement('div'); Object.assign(trimRegion.style, { position: 'absolute', top: '0', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.2)', border: '2px solid white', boxSizing: 'border-box' });
    const leftHandle = document.createElement('div'); Object.assign(leftHandle.style, { position: 'absolute', top: '0', left: '0', width: '10px', height: '100%', backgroundColor: 'white', cursor: 'ew-resize' });
    const rightHandle = document.createElement('div'); Object.assign(rightHandle.style, { position: 'absolute', top: '0', right: '0', width: '10px', height: '100%', backgroundColor: 'white', cursor: 'ew-resize' });
    const timeDisplay = document.createElement('div'); timeDisplay.style.marginTop = '10px'; timeDisplay.style.fontSize = '14px'; timeDisplay.style.textAlign = 'center';

    function updateTimeDisplay() {
      const startPercent = (startTime / videoDuration) * 100, endPercent = (endTime / videoDuration) * 100;
      trimRegion.style.left = startPercent + '%'; trimRegion.style.width = (endPercent - startPercent) + '%';
      timeDisplay.textContent = `Start: ${formatTime(startTime)} | End: ${formatTime(endTime)} | Duration: ${formatTime(endTime - startTime)}`;
    }

    let isDragging = false, dragHandle = null;
    const onMouseMove = (e) => { if (!isDragging) return; const trimRect = trimUIContainer.getBoundingClientRect(); const percent = Math.max(0, Math.min(1, (e.clientX - trimRect.left) / trimRect.width)); const time = percent * videoDuration; if (dragHandle === 'left') { startTime = Math.min(time, endTime - 0.5); videoPreview.currentTime = startTime; } else if (dragHandle === 'right') { endTime = Math.max(time, startTime + 0.5); videoPreview.currentTime = endTime; } updateTimeDisplay(); };
    const onMouseUp = () => { isDragging = false; dragHandle = null; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    leftHandle.addEventListener('mousedown', (e) => { isDragging = true; dragHandle = 'left'; e.preventDefault(); document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
    rightHandle.addEventListener('mousedown', (e) => { isDragging = true; dragHandle = 'right'; e.preventDefault(); document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });

    trimRegion.appendChild(leftHandle); trimRegion.appendChild(rightHandle); timeline.appendChild(trimRegion); trimUIContainer.appendChild(timeline);
    const trimStatusContainer = document.createElement('div'); Object.assign(trimStatusContainer.style, { marginBottom: '15px', padding: '8px', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' });
    trimStatusContainer.textContent = 'Video trimming is always active. Adjust the handles to set start and end points.';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex'; buttonContainer.style.justifyContent = 'flex-end'; buttonContainer.style.marginTop = '20px'; buttonContainer.style.gap = '10px'; // Odstęp między przyciskami

    const createModalButton = (text, classes) => { // Użycie klas CSS
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.className = `btn ${classes}`; // Np. "btn-secondary", "btn-primary"
      return btn;
    };

    const cancelButton = createModalButton('Cancel', 'btn-secondary');
    const saveButton = createModalButton('Save', 'btn-primary');

    cancelButton.addEventListener('click', () => { document.body.removeChild(backdrop); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); });
    saveButton.addEventListener('click', () => {
      media.trimSettings = { trimEnabled: true, startTime: startTime, endTime: endTime };
      updateMediaGallery(); saveMediaList(); document.body.removeChild(backdrop); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
      showNotification('Video trim settings saved', 'success');
    });

    buttonContainer.appendChild(cancelButton); buttonContainer.appendChild(saveButton);
    dialog.appendChild(title); dialog.appendChild(videoPreview); dialog.appendChild(trimStatusContainer);
    trimContainer.appendChild(trimUIContainer); trimContainer.appendChild(timeDisplay); dialog.appendChild(trimContainer); // Poprawione dodanie trimContainer
    dialog.appendChild(buttonContainer);
    backdrop.appendChild(dialog); document.body.appendChild(backdrop);
    updateTimeDisplay(); // Inicjalne ustawienie wyświetlania czasu
  };

  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer;
    const emptyState = document.getElementById('playlist-empty-state');
    const controlsContainer = state.dom.playlistControlsContainer; // Użycie referencji

    if (!playlistContainer || !emptyState || !controlsContainer) {
      console.error("Required DOM elements for playlist UI not found.");
      return;
    }

    Array.from(playlistContainer.children).forEach(child => { if (child.id !== 'playlist-empty-state') child.remove(); });

    if (state.playlist.items.length === 0) {
      emptyState.style.display = 'block';
      controlsContainer.style.visibility = 'hidden'; // Ukryj kontrolki
    } else {
      emptyState.style.display = 'none';
      controlsContainer.style.visibility = 'visible'; // Pokaż kontrolki

      state.playlist.items.forEach((mediaId, index) => {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) playlistContainer.appendChild(createPlaylistItem(media, index));
        else console.error(`Media ID ${mediaId} at index ${index} not found in library for playlist UI`);
      });
    }

    const shuffleButton = document.getElementById('playlist-shuffle-button');
    if (shuffleButton) {
      if (state.playlist.shuffle) shuffleButton.classList.add('active');
      else shuffleButton.classList.remove('active');
    }

    const playButton = document.getElementById('playlist-play-button');
    if (playButton) {
      playButton.innerHTML = state.playlist.isPlaying ?
          '<span style="filter: grayscale(100%);">⏸</span> Pause' :
          '<span style="filter: grayscale(100%);">▶</span> Play All';
    }
  };

  const createPlaylistItem = (media, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.dataset.id = media.id; item.dataset.index = index;
    // Style dla .playlist-item są w CSS
    if (index === state.playlist.currentIndex) item.classList.add('current'); // Dodatkowa klasa dla aktualnego

    item.draggable = true;
    item.addEventListener('dragstart', function(e) { e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'playlist-reorder', id: media.id, index: index })); e.dataTransfer.effectAllowed = 'move'; this.style.opacity = '0.5'; });
    item.addEventListener('dragend', function() { this.style.opacity = '1'; document.querySelectorAll('.playlist-item').forEach(i => { i.classList.remove('drag-over'); i.style.borderTop = 'none'; }); });
    item.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); document.querySelectorAll('.playlist-item').forEach(i => { i.classList.remove('drag-over'); i.style.borderTop = 'none'; }); this.classList.add('drag-over'); this.style.borderTop = '2px solid white'; e.dataTransfer.dropEffect = 'move'; });
    item.addEventListener('dragleave', function(e) { e.preventDefault(); this.classList.remove('drag-over'); this.style.borderTop = 'none'; });
    item.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation(); this.classList.remove('drag-over'); this.style.borderTop = 'none';
      try {
        const dataText = e.dataTransfer.getData('text/plain'); if (!dataText) return;
        try {
          const data = JSON.parse(dataText);
          if (data && data.type === 'playlist-reorder') { const fromIndex = parseInt(data.index), toIndex = parseInt(this.dataset.index); if (fromIndex !== toIndex && !isNaN(fromIndex) && !isNaN(toIndex)) reorderPlaylistItem(fromIndex, toIndex); }
        } catch(err) { const mediaId = dataText; if (!state.playlist.items.includes(mediaId)) addToPlaylist(mediaId); }
      } catch(err) { console.error('Error during playlist drop handling:', err); }
    });

    const thumbnail = document.createElement('div');
    // Style dla thumbnail w CSS lub inline
    thumbnail.style.width = '40px'; thumbnail.style.height = '40px'; thumbnail.style.backgroundColor = '#222'; thumbnail.style.borderRadius = '3px'; thumbnail.style.marginRight = '10px'; thumbnail.style.overflow = 'hidden'; thumbnail.style.flexShrink = '0'; thumbnail.style.position = 'relative';
    if (media.thumbnail) { thumbnail.style.backgroundImage = `url(${media.thumbnail})`; thumbnail.style.backgroundSize = 'cover'; thumbnail.style.backgroundPosition = 'center'; }
    if (media.type === 'video' && media.trimSettings && media.trimSettings.trimEnabled) { const trimIndicator = document.createElement('div'); trimIndicator.innerHTML = '<span style="filter: grayscale(100%);">✂️</span>'; Object.assign(trimIndicator.style, { position: 'absolute', bottom: '2px', right: '2px', fontSize: '8px' }); thumbnail.appendChild(trimIndicator); }
    const typeIndicator = document.createElement('div'); Object.assign(typeIndicator.style, { position: 'absolute', bottom: '0', right: '0', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '8px', padding: '1px 3px' }); typeIndicator.textContent = media.type.charAt(0).toUpperCase(); thumbnail.appendChild(typeIndicator);
    if (index === state.playlist.currentIndex && state.playlist.isPlaying) { const playingIndicator = document.createElement('div'); playingIndicator.innerHTML = '<span style="filter: grayscale(100%);">▶</span>'; Object.assign(playingIndicator.style, { position: 'absolute', top: '2px', left: '2px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '8px', width: '14px', height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }); thumbnail.appendChild(playingIndicator); }

    const infoContainer = document.createElement('div'); infoContainer.style.overflow = 'hidden'; infoContainer.style.flexGrow = '1';
    const nameEl = document.createElement('div'); nameEl.textContent = media.name; Object.assign(nameEl.style, { fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }); infoContainer.appendChild(nameEl);
    const detailsEl = document.createElement('div'); let detailsText = `${media.type} · ${formatFileSize(media.size)}`; if (media.type === 'video' && media.trimSettings && media.trimSettings.trimEnabled) { const duration = media.trimSettings.endTime - media.trimSettings.startTime; detailsText += ` · Trimmed (${duration.toFixed(1)}s)`; } detailsEl.textContent = detailsText; Object.assign(detailsEl.style, { fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }); infoContainer.appendChild(detailsEl);

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'btn btn-icon btn-danger playlist-item-delete'; // Użycie klas
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'; // Mniejsza ikona
    // Usunięto style inline, będą z .btn-icon, można dodać .playlist-item-delete dla specyficznych override'ów
    deleteBtn.style.padding = '4px'; // Mniejszy padding dla tej konkretnej ikony
    deleteBtn.style.marginLeft = 'auto'; // Wyrównaj do prawej


    item.addEventListener('click', function() { if (state.playlist.isPlaying && state.playlist.currentIndex === index) return; state.playlist.currentIndex = index; playPlaylist(); });
    deleteBtn.addEventListener('click', function(e) { e.stopPropagation(); removeFromPlaylist(index); });

    item.appendChild(thumbnail); item.appendChild(infoContainer); item.appendChild(deleteBtn);
    return item;
  };

  // PLAYLIST DRAG & DROP HANDLERS
  const handlePlaylistDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const handlePlaylistDrop = (e) => {
    e.preventDefault();
    // const playlistStyle = window.getComputedStyle(e.currentTarget); // Pobierz styl przed zmianą
    // e.currentTarget.style.backgroundColor = playlistStyle.getPropertyValue('background-color') || 'rgba(0, 0, 0, 0.2)';
    e.currentTarget.style.backgroundColor = ''; // Usunięcie inline stylu, aby CSS mógł zadziałać

    try {
      const dataText = e.dataTransfer.getData('text/plain'); if (!dataText) return;
      try {
        const jsonData = JSON.parse(dataText);
        if (jsonData && jsonData.type === 'playlist-reorder') { const fromIndex = parseInt(jsonData.index), toIndex = state.playlist.items.length -1; if (!isNaN(fromIndex) && fromIndex >= 0 && fromIndex !== toIndex) reorderPlaylistItem(fromIndex, toIndex); return; }
      } catch (err) { /* Not JSON, likely a media ID - continue */ }
      const mediaId = dataText; const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (media) addToPlaylist(mediaId); else console.error(`Media ID ${mediaId} not found in library on drop`);
    } catch (err) { console.error('Error in handlePlaylistDrop:', err); }
  };

  // PLAYLIST MANAGEMENT
  const addToPlaylist = (mediaId) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId); if (!media) { console.error(`Cannot add media ID ${mediaId} to playlist - not found in library`); return; }
    if (state.playlist.items.includes(mediaId)) { console.log(`Media ${media.name} is already in the playlist`); return; }
    const wasEmpty = state.playlist.items.length === 0;
    state.playlist.items.push(mediaId);
    if (wasEmpty) { state.playlist.currentIndex = 0; setTimeout(() => playPlaylist(), 50); }
    updatePlaylistUI(); saveMediaList(); showNotification(`Added to playlist: ${media.name}`, 'success');
  };

  const removeFromPlaylist = (index) => {
    if (index < 0 || index >= state.playlist.items.length) return;
    const mediaId = state.playlist.items[index], media = state.mediaLibrary.find(m => m.id === mediaId);
    state.playlist.items.splice(index, 1);
    if (state.playlist.isPlaying) {
      if (index === state.playlist.currentIndex) { if (state.playlist.items.length > 0) { if (state.playlist.currentIndex >= state.playlist.items.length) state.playlist.currentIndex = 0; playMediaByIndex(state.playlist.currentIndex); } else stopPlaylist(); }
      else if (index < state.playlist.currentIndex) state.playlist.currentIndex--;
    }
    updatePlaylistUI(); saveMediaList();
    if (media) showNotification(`Removed from playlist: ${media.name}`, 'info');
  };

  const reorderPlaylistItem = (fromIndex, toIndex) => {
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length || toIndex < 0 || toIndex >= state.playlist.items.length) return;
    try {
      const item = state.playlist.items[fromIndex]; state.playlist.items.splice(fromIndex, 1); state.playlist.items.splice(toIndex, 0, item);
      if (state.playlist.isPlaying) { if (fromIndex === state.playlist.currentIndex) state.playlist.currentIndex = toIndex; else if (fromIndex < state.playlist.currentIndex && toIndex >= state.playlist.currentIndex) state.playlist.currentIndex--; else if (fromIndex > state.playlist.currentIndex && toIndex <= state.playlist.currentIndex) state.playlist.currentIndex++; }
      updatePlaylistUI(); saveMediaList();
    } catch (e) { console.error('Error reordering playlist item:', e); }
  };

  const clearPlaylist = () => {
    try {
      stopPlaylist(); clearMediaDisplay(); state.playlist.items = []; state.playlist.currentIndex = -1; state.playlist.isPlaying = false; clearPlaybackTimers();
      updatePlaylistUI(); saveMediaList(); showNotification('Playlist cleared', 'info');
    } catch (e) { console.error('Error in clearPlaylist:', e); }
  };

  // MEDIA PLAYBACK
  const selectMedia = (media) => {
    console.log(`Selecting media: ${media.name} for standalone playback (should loop)`);
    stopPlaylist(); clearMediaDisplay();
    const element = createMediaElement(media, false); // isPlaylist=false
    if (element) { state.dom.mediaContainer.appendChild(element); showNotification(`Now playing: ${media.name}`, 'info'); }
  };

  const createMediaElement = (media, isPlaylist = false) => {
    let element;
    if (media.type === 'image') {
      element = document.createElement('img'); element.src = media.url;
      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });
      if (isPlaylist) { clearPlaybackTimers(); state.playlist.playbackTimer = setTimeout(() => { if (state.playlist.isPlaying) playNextItem(); }, 5000); }
    } else if (media.type === 'video') {
      element = document.createElement('video'); element.src = media.url; element.autoplay = true;
      element.loop = !isPlaylist; element.muted = true; // Zawsze wyciszone dla tapety
      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });
      element.addEventListener('error', function(e) { console.error(`Error loading video: ${media.name}`, e); if (isPlaylist && state.playlist.isPlaying) setTimeout(() => playNextItem(), 100); });
      if (media.trimSettings) {
        const playlistMode = isPlaylist;
        element.addEventListener('loadedmetadata', function() { this.currentTime = media.trimSettings.startTime || 0; });
        element.addEventListener('timeupdate', function() {
          if (this.currentTime < media.trimSettings.startTime) this.currentTime = media.trimSettings.startTime;
          if (media.trimSettings.endTime && this.currentTime >= media.trimSettings.endTime) {
            if (playlistMode && state.playlist.isPlaying) playNextItem();
            else if (!playlistMode) this.currentTime = media.trimSettings.startTime || 0;
          }
        });
      }
      if (isPlaylist) element.addEventListener('ended', () => { if (state.playlist.isPlaying) playNextItem(); });
    }
    return element;
  };

  const playPlaylist = () => {
    if (state.playlist.items.length === 0) { showNotification('Playlist is empty. Add media to play.', 'info'); return; }
    if (state.playlist.isPlaying) { pausePlaylist(); return; }
    clearPlaybackTimers(); state.playlist.advancingInProgress = false;
    if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
      state.playlist.currentIndex = state.playlist.shuffle ? Math.floor(Math.random() * state.playlist.items.length) : 0;
    }
    state.playlist.isPlaying = true; clearMediaDisplay();
    playMediaByIndex(state.playlist.currentIndex);
    updatePlaylistUI();
  };

  const pausePlaylist = () => {
    state.playlist.isPlaying = false; clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video'); if (videoElement) videoElement.pause();
    updatePlaylistUI(); showNotification("Playlist paused", "info");
  };

  const playMediaByIndex = (index) => {
    if (index < 0 || index >= state.playlist.items.length) { if (state.playlist.items.length > 0) index = 0; else return; }
    const mediaId = state.playlist.items[index], media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) { if (state.playlist.isPlaying) playNextItem(); return; }
    state.playlist.currentIndex = index; state.playlist.isPlaying = true;
    clearMediaDisplay();
    const element = createMediaElement(media, true);
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      if (element.tagName.toLowerCase() === 'video') element.load();
      updatePlaylistUI();
    } else if (state.playlist.isPlaying) playNextItem();
  };

  const playNextItem = () => {
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) return;
    clearPlaybackTimers(); let nextIndex;
    if (state.playlist.shuffle) { if (state.playlist.items.length > 1) { do { nextIndex = Math.floor(Math.random() * state.playlist.items.length); } while (nextIndex === state.playlist.currentIndex); } else nextIndex = 0; }
    else nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
    state.playlist.currentIndex = nextIndex; state.playlist.isPlaying = true;
    playMediaByIndex(nextIndex);
  };

  const clearPlaybackTimers = () => { if (state.playlist.playbackTimer) { clearTimeout(state.playlist.playbackTimer); state.playlist.playbackTimer = null; } };
  const toggleShuffle = () => { state.playlist.shuffle = !state.playlist.shuffle; updatePlaylistUI(); showNotification(state.playlist.shuffle ? 'Shuffle mode: On' : 'Shuffle mode: Off', 'info'); };
  const stopPlaylist = (resetIndex = true) => { state.playlist.isPlaying = false; clearPlaybackTimers(); if (resetIndex) state.playlist.currentIndex = -1; if (resetIndex) clearMediaDisplay(); updatePlaylistUI(); };
  const clearMediaDisplay = () => {
    try {
      clearPlaybackTimers();
      const mediaElements = state.dom.mediaContainer.querySelectorAll('video, audio, img');
      mediaElements.forEach(el => { try { if (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio') { el.pause(); el.currentTime = 0; el.removeAttribute('src'); el.load(); } if (el.parentNode) el.parentNode.removeChild(el); } catch (e) { if (el.parentNode) el.parentNode.removeChild(el); } });
      state.dom.mediaContainer.innerHTML = '';
    } catch (e) { if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = ''; }
  };

  // MEDIA MANAGEMENT
  const deleteMedia = (id) => {
    const index = state.mediaLibrary.findIndex(m => m.id === id); if (index === -1) return;
    const media = state.mediaLibrary[index]; state.mediaLibrary.splice(index, 1);
    URL.revokeObjectURL(media.url);
    const playlistIndex = state.playlist.items.indexOf(id); if (playlistIndex !== -1) removeFromPlaylist(playlistIndex);
    // Nie czyścimy całego displayu jeśli coś innego gra
    // clearMediaDisplay();
    if (state.mediaLibrary.length === 0) { state.playlist = { items: [], currentIndex: -1, isPlaying: false, shuffle: false, playbackTimer: null, advancingInProgress: false, lastTransitionTime: 0 }; clearMediaDisplay(); }
    updateMediaGallery(); updatePlaylistUI(); saveMediaList(); showNotification(`Removed: ${media.name}`, 'info');
  };

  // STORAGE
  const saveMediaList = () => {
    try {
      const mediaForStorage = state.mediaLibrary.map(media => { const { url, ...mediaCopy } = media; return mediaCopy; });
      const storageData = { media: mediaForStorage, playlist: { items: state.playlist.items, shuffle: state.playlist.shuffle } };
      localStorage.setItem('flStudioWallpaper_media', JSON.stringify(storageData));
    } catch (e) { console.error('Failed to save media list to localStorage:', e); }
  };

  const loadSavedMedia = () => {
    try {
      const savedData = localStorage.getItem('flStudioWallpaper_media'); if (!savedData) return;
      const parsedData = JSON.parse(savedData);
      if (parsedData.media && Array.isArray(parsedData.media) && parsedData.media.length > 0) {
        // Nie przywracamy mediów automatycznie, tylko informujemy
        showNotification(`Found ${parsedData.media.length} previously imported media files. Please re-import them to use. (Stored URLs are invalid after session closes)`, 'info');
      }
      if (parsedData.playlist && parsedData.playlist.items) {
        // Filtrujemy playlistę, aby usunąć ID mediów, których nie ma już w bibliotece (choć biblioteka jest czyszczona)
        // W praktyce, po ponownym załadowaniu strony, mediaLibrary jest pusta, więc playlist też powinna być.
        // Można by próbować odtworzyć mediaLibrary z localStorage, ale to wymagałoby przechowywania plików (np. IndexedDB), a nie tylko metadanych.
        // Na razie, playlista będzie pusta po załadowaniu, chyba że media są ponownie importowane.
        // state.playlist.items = parsedData.playlist.items.filter(itemId => state.mediaLibrary.some(libItem => libItem.id === itemId));
        state.playlist.items = []; // Bezpieczniej zacząć z pustą playlistą, jeśli media nie są trwale przechowywane
        if (typeof parsedData.playlist.shuffle === 'boolean') state.playlist.shuffle = parsedData.playlist.shuffle;
      }
      updatePlaylistUI(); // Zaktualizuj UI, aby odzwierciedlić (prawdopodobnie pustą) playlistę
    } catch (e) { console.error('Failed to load media data from localStorage:', e); localStorage.removeItem('flStudioWallpaper_media'); /* Usuń uszkodzone dane */ }
  };

  // UTILITY FUNCTIONS
  const formatFileSize = (bytes) => { if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'; };
  const showNotification = (message, type) => { if (typeof WallpaperApp !== 'undefined' && WallpaperApp.UI && typeof WallpaperApp.UI.showNotification === 'function') WallpaperApp.UI.showNotification(message, type); else console.log(`[${type.toUpperCase()}] ${message}`); };

  // Public API
  return { init };
})();

MediaModule.init();

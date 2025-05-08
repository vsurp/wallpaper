/**
 * FL Studio Wallpaper App - Enhanced Media Module
 * Naprawiona wersja z funkcjonalnością zaznaczania wielu elementów i podświetlaniem
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
      playlistControlsContainer: null,
      playbackControls: null
    },
    selection: {
      active: false,
      startPoint: null,
      items: new Set(), // Przechowuje ID zaznaczonych elementów
      shiftKeyActive: false,
      lastSelected: null // Ostatnio zaznaczony element (dla Shift+kliknięcie)
    },
    activeHighlight: {
      mediaId: null,
      sourceType: null // 'library' lub 'playlist'
    },
    fileInput: null
  };

  // INITIALIZATION
  const init = () => {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initMediaImporter, 1000));

    // Dodanie nasłuchiwania na klawisz Shift
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') {
        state.selection.shiftKeyActive = true;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        state.selection.shiftKeyActive = false;
      }
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

  // UI SETUP
  const setupMediaImportUI = () => {
    const menuContent = state.dom.importSubmenu.querySelector('.menu-content');
    if (!menuContent) {
      console.error("Menu content not found in import-media-submenu");
      return;
    }

    // Czyścimy istniejącą zawartość, aby uniknąć duplikatów
    menuContent.innerHTML = '';

    setupFileInput(); // Konfiguruje ukryty input file

    // Dodaj przycisk importu mediów
    const importButtonContainer = document.createElement('div');
    const importButton = document.createElement('button');
    importButton.className = 'submenu-item';
    importButton.setAttribute('data-action', 'import-media');
    importButton.textContent = 'IMPORT MEDIA';
    importButton.addEventListener('click', () => state.fileInput.click());
    importButtonContainer.appendChild(importButton);
    menuContent.appendChild(importButtonContainer);

    // Dodajemy separator
    menuContent.appendChild(document.createElement('hr')).className = 'divider';

    // Tworzenie i dodawanie sekcji biblioteki mediów
    const mediaLibrarySection = createMediaLibrarySection();
    menuContent.appendChild(mediaLibrarySection);

    // Dodawanie separatora
    const divider = document.createElement('hr');
    divider.className = 'divider';
    menuContent.appendChild(divider);

    // Tworzenie i dodawanie sekcji przycisków szybkiej nawigacji
    const quickNavSection = createQuickNavSection();
    menuContent.appendChild(quickNavSection);

    // Dodawanie separatora
    const divider2 = document.createElement('hr');
    divider2.className = 'divider';
    menuContent.appendChild(divider2);

    // Tworzenie i dodawanie sekcji playlisty
    const playlistSection = createPlaylistSection();
    menuContent.appendChild(playlistSection);

    // Inicjalizacja referencji do kontrolek odtwarzania
    state.dom.playbackControls = { style: { display: 'none' } };
  };

  const setupFileInput = () => {
    // Usuń istniejący input, jeśli istnieje
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
      e.target.value = ''; // Resetowanie inputu, aby umożliwić ponowne wybranie tego samego pliku
    });
  };

  const createMediaLibrarySection = () => {
    const section = document.createElement('div');
    section.id = 'media-library-section';

    const title = document.createElement('h3');
    title.textContent = 'MEDIA';
    title.style.fontSize = '14px';
    title.style.marginBottom = '10px';
    title.style.color = 'rgba(255, 255, 255, 0.7)';
    section.appendChild(title);

    // Dodanie info o zaznaczaniu wielu elementów
    const selectionInfo = document.createElement('div');
    selectionInfo.className = 'selection-info';
    selectionInfo.textContent = 'Shift+Click lub przeciągnij, aby zaznaczyć wiele';
    selectionInfo.style.fontSize = '10px';
    selectionInfo.style.color = 'rgba(255, 255, 255, 0.5)';
    selectionInfo.style.marginBottom = '8px';
    selectionInfo.style.textAlign = 'center';
    section.appendChild(selectionInfo);

    const gallery = document.createElement('div');
    gallery.id = 'media-gallery';
    gallery.style.msOverflowStyle = 'none'; // Dla Firefox (ukrycie scrollbara jeśli niepotrzebny)
    gallery.style.scrollbarWidth = 'none';  // Dla Firefox

    // Obsługa zaznaczania przez przeciągnięcie
    let selectionBox = null;
    let isSelecting = false;
    let startPoint = { x: 0, y: 0 };

    // Rozpoczęcie zaznaczania
    gallery.addEventListener('mousedown', (e) => {
      // Tylko lewy przycisk myszy i tylko jeśli kliknięto bezpośrednio w gallery (nie na jego dzieci)
      if (e.button !== 0 || e.target !== gallery) return;

      isSelecting = true;
      startPoint = { x: e.clientX, y: e.clientY };

      if (selectionBox) {
        gallery.removeChild(selectionBox);
      }

      selectionBox = document.createElement('div');
      selectionBox.className = 'selection-box';
      selectionBox.style.position = 'absolute';
      selectionBox.style.border = '1px solid var(--primary-color)';
      selectionBox.style.backgroundColor = 'rgba(var(--primary-color-rgb), 0.1)';
      selectionBox.style.pointerEvents = 'none';
      selectionBox.style.zIndex = '10';

      selectionBox.style.left = startPoint.x + 'px';
      selectionBox.style.top = startPoint.y + 'px';
      selectionBox.style.width = '0px';
      selectionBox.style.height = '0px';

      // Konwersja do koordynatów względem gallery
      const galleryRect = gallery.getBoundingClientRect();
      const scrollTop = gallery.scrollTop;
      const scrollLeft = gallery.scrollLeft;

      selectionBox.style.left = (startPoint.x - galleryRect.left + scrollLeft) + 'px';
      selectionBox.style.top = (startPoint.y - galleryRect.top + scrollTop) + 'px';

      gallery.appendChild(selectionBox);

      // Jeśli nie przytrzymano Shift, wyczyść poprzednie zaznaczenie
      if (!state.selection.shiftKeyActive) {
        clearSelection();
      }
    });

    // Aktualizacja zaznaczenia podczas przeciągania
    gallery.addEventListener('mousemove', (e) => {
      if (!isSelecting || !selectionBox) return;

      const galleryRect = gallery.getBoundingClientRect();
      const scrollTop = gallery.scrollTop;
      const scrollLeft = gallery.scrollLeft;

      const currentX = e.clientX - galleryRect.left + scrollLeft;
      const currentY = e.clientY - galleryRect.top + scrollTop;
      const startX = startPoint.x - galleryRect.left + scrollLeft;
      const startY = startPoint.y - galleryRect.top + scrollTop;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';

      // Sprawdź, które miniatury są w zaznaczeniu
      const selectionRect = {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height
      };

      // Aktualizuj zaznaczenie na bieżąco
      const thumbnails = gallery.querySelectorAll('.media-thumbnail');
      thumbnails.forEach(thumbnail => {
        const thumbnailRect = thumbnail.getBoundingClientRect();
        const thumbLeft = thumbnailRect.left - galleryRect.left + scrollLeft;
        const thumbTop = thumbnailRect.top - galleryRect.top + scrollTop;
        const thumbRight = thumbLeft + thumbnailRect.width;
        const thumbBottom = thumbTop + thumbnailRect.height;

        // Sprawdź czy miniatury przecinają się z zaznaczeniem
        if (
            thumbRight >= selectionRect.left &&
            thumbLeft <= selectionRect.right &&
            thumbBottom >= selectionRect.top &&
            thumbTop <= selectionRect.bottom
        ) {
          const mediaId = thumbnail.dataset.id;
          addToSelection(mediaId);
          thumbnail.classList.add('selected');
        } else if (!state.selection.shiftKeyActive) {
          const mediaId = thumbnail.dataset.id;
          removeFromSelection(mediaId);
          thumbnail.classList.remove('selected');
        }
      });
    });

    // Zakończenie zaznaczania
    gallery.addEventListener('mouseup', (e) => {
      if (!isSelecting) return;

      isSelecting = false;

      if (selectionBox && selectionBox.parentNode) {
        gallery.removeChild(selectionBox);
      }
      selectionBox = null;

      // Zapisz ostatni zaznaczony element
      if (state.selection.items.size > 0) {
        state.selection.lastSelected = Array.from(state.selection.items)[state.selection.items.size - 1];
      }

      updateMediaSelectionUI();
    });

    // Zatrzymanie zaznaczania, gdy mysz opuści galerię
    gallery.addEventListener('mouseleave', () => {
      if (isSelecting && selectionBox && selectionBox.parentNode) {
        // Nie kończymy zaznaczania, tylko ukrywamy wizualny box
        selectionBox.style.display = 'none';
      }
    });

    // Przywracanie zaznaczania, gdy mysz wraca do galerii
    gallery.addEventListener('mouseenter', () => {
      if (isSelecting && selectionBox) {
        selectionBox.style.display = 'block';
      }
    });

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

  const createQuickNavSection = () => {
    const section = document.createElement('div');
    section.id = 'quick-nav-section';
    section.style.display = 'flex';
    section.style.gap = '8px';
    section.style.marginBottom = '8px';

    // Przycisk Effects
    const effectsButton = document.createElement('button');
    effectsButton.textContent = 'EFFECTS';
    effectsButton.className = 'quick-nav-button btn btn-secondary';
    effectsButton.style.flex = '1';
    effectsButton.addEventListener('click', () => {
      // Zamknij aktywne submenu
      closeAllSubmenus();
      // Symuluj kliknięcie "EFFECTS" w menu głównym
      const effectsMenuItem = document.querySelector('.category-item[data-action="effects"]');
      if (effectsMenuItem) {
        effectsMenuItem.click();
      } else {
        showNotification('Nie znaleziono opcji EFFECTS w menu głównym', 'warning');
      }
    });

    // Przycisk Transitions
    const transitionsButton = document.createElement('button');
    transitionsButton.textContent = 'TRANSITIONS';
    transitionsButton.className = 'quick-nav-button btn btn-secondary';
    transitionsButton.style.flex = '1';
    transitionsButton.addEventListener('click', () => {
      // Zamknij aktywne submenu
      closeAllSubmenus();
      // Symuluj kliknięcie "TRANSITIONS" w menu głównym
      const transitionsMenuItem = document.querySelector('.category-item[data-action="transitions"]');
      if (transitionsMenuItem) {
        transitionsMenuItem.click();
      } else {
        showNotification('Nie znaleziono opcji TRANSITIONS w menu głównym', 'warning');
      }
    });

    section.appendChild(effectsButton);
    section.appendChild(transitionsButton);

    return section;
  };

  const createPlaylistSection = () => {
    const section = document.createElement('div');
    section.id = 'playlist-section';

    const title = document.createElement('h3');
    title.textContent = 'PLAYLIST';
    title.style.fontSize = '14px';
    title.style.marginBottom = '10px';
    title.style.color = 'rgba(255, 255, 255, 0.7)';
    section.appendChild(title);

    const playlistContainer = document.createElement('div');
    playlistContainer.id = 'playlist-container';
    playlistContainer.style.msOverflowStyle = 'none';
    playlistContainer.style.scrollbarWidth = 'none';
    playlistContainer.style.display = 'flex'; // Potrzebne dla flex-direction
    playlistContainer.style.flexDirection = 'column';
    playlistContainer.style.gap = '8px';

    playlistContainer.addEventListener('dragover', handlePlaylistDragOver);
    playlistContainer.addEventListener('drop', handlePlaylistDrop);
    playlistContainer.addEventListener('dragenter', e => {
      e.preventDefault();
      playlistContainer.style.backgroundColor = 'rgba(60, 60, 60, 0.3)';
    });
    playlistContainer.addEventListener('dragleave', e => {
      e.preventDefault();
      playlistContainer.style.backgroundColor = ''; // Usunięcie inline stylu, aby CSS mógł zadziałać
    });

    const emptyState = document.createElement('div');
    emptyState.id = 'playlist-empty-state';
    emptyState.textContent = 'Drag media here to create playlist';
    emptyState.style.padding = '15px';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(255, 255, 255, 0.5)';

    playlistContainer.appendChild(emptyState);
    section.appendChild(playlistContainer); // Dodajemy kontener listy do sekcji

    // Tworzenie kontenera dla przycisków playlisty
    let controlsContainer = document.getElementById('playlist-controls');
    if (!controlsContainer) {
      controlsContainer = document.createElement('div');
      controlsContainer.id = 'playlist-controls';
    }
    state.dom.playlistControlsContainer = controlsContainer;
    createPlaylistControls(controlsContainer); // Przekaż kontener do funkcji

    section.appendChild(controlsContainer); // Dodajemy kontrolki na końcu sekcji playlisty

    state.dom.playlistContainer = playlistContainer;
    return section;
  };

  const createPlaylistControls = (controlsContainer) => {
    controlsContainer.innerHTML = ''; // Czyścimy istniejące przyciski
    controlsContainer.style.visibility = 'hidden'; // Domyślnie ukryte

    const buttons = [
      { id: 'playlist-play-button', html: '<span style="filter: grayscale(100%);">▶</span> Play All', handler: playPlaylist, class: 'btn-primary' },
      { id: 'playlist-shuffle-button', html: '<span style="filter: grayscale(100%);">🔀</span> Shuffle', handler: toggleShuffle, class: 'btn-secondary' },
      { id: 'playlist-clear-button', html: '<span style="filter: grayscale(100%);">✕</span> Clear Playlist', handler: clearPlaylist, class: 'btn-danger' }
    ];

    buttons.forEach(btnData => {
      const button = document.createElement('button');
      button.id = btnData.id;
      button.innerHTML = btnData.html;
      button.className = `btn playlist-button ${btnData.class || 'btn-secondary'}`;
      button.addEventListener('click', btnData.handler);
      controlsContainer.appendChild(button);
    });
  };

  // FUNKCJE ZARZĄDZANIA ZAZNACZENIEM
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
    // Znajdujemy indeksy elementów w bibliotece
    const startIndex = state.mediaLibrary.findIndex(m => m.id === startId);
    const endIndex = state.mediaLibrary.findIndex(m => m.id === endId);

    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    // Dodaj wszystkie elementy w zakresie do zaznaczenia
    for (let i = minIndex; i <= maxIndex; i++) {
      addToSelection(state.mediaLibrary[i].id);
    }

    updateMediaSelectionUI();
  };

  const updateMediaSelectionUI = () => {
    const thumbnails = state.dom.mediaGallery.querySelectorAll('.media-thumbnail');
    thumbnails.forEach(thumbnail => {
      const mediaId = thumbnail.dataset.id;
      if (state.selection.items.has(mediaId)) {
        thumbnail.classList.add('selected');
      } else {
        thumbnail.classList.remove('selected');
      }
    });
  };

  // FUNKCJE ZARZĄDZANIA PODŚWIETLENIEM AKTYWNEGO MEDIA
  const updateActiveHighlight = (mediaId, sourceType) => {
    // Usuń wszystkie aktywne podświetlenia
    removeAllActiveHighlights();

    // Jeśli nie przekazano ID, po prostu usuń podświetlenia
    if (!mediaId) return;

    // Zapisz informacje o aktywnym elemencie
    state.activeHighlight.mediaId = mediaId;
    state.activeHighlight.sourceType = sourceType;

    // Dodaj podświetlenie do odpowiedniego elementu
    if (sourceType === 'library') {
      const thumbnail = state.dom.mediaGallery.querySelector(`.media-thumbnail[data-id="${mediaId}"]`);
      if (thumbnail) {
        thumbnail.classList.add('playing-from-here');
      }
    } else if (sourceType === 'playlist') {
      const playlistItem = state.dom.playlistContainer.querySelector(`.playlist-item[data-id="${mediaId}"]`);
      if (playlistItem) {
        playlistItem.classList.add('playing-from-here');
      }
    }
  };

  const removeAllActiveHighlights = () => {
    // Usuń klasę ze wszystkich elementów biblioteki
    const thumbnails = state.dom.mediaGallery.querySelectorAll('.media-thumbnail.playing-from-here');
    thumbnails.forEach(el => el.classList.remove('playing-from-here'));

    // Usuń klasę ze wszystkich elementów playlisty
    const playlistItems = state.dom.playlistContainer.querySelectorAll('.playlist-item.playing-from-here');
    playlistItems.forEach(el => el.classList.remove('playing-from-here'));

    // Resetuj stan
    state.activeHighlight.mediaId = null;
    state.activeHighlight.sourceType = null;
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
    updatePlaylistUI();
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
      // Domyślne ustawienia dla nowych klipów
      settings: {
        volume: 0, // Zaczynaj wyciszony
        playbackRate: 1,
        // trimSettings zostaną dodane po załadowaniu metadanych wideo
      },
      // trimSettings są teraz częścią 'settings' dla spójności, ale zachowujemy starą strukturę dla kompatybilności
      trimSettings: type === 'video' ? { trimEnabled: true, startTime: 0, endTime: null } : null
    };
    if (type === 'video' && mediaItem.settings) {
      mediaItem.settings.trimSettings = { trimEnabled: true, startTime: 0, endTime: null };
    }

    generateThumbnail(mediaItem, file).then(thumbnail => {
      mediaItem.thumbnail = thumbnail;
      if (type === 'video') {
        const video = document.createElement('video');
        video.preload = 'metadata'; // Zmieniono na 'metadata' dla szybszego ładowania
        video.onloadedmetadata = function() {
          const duration = video.duration;
          // Ustawienie domyślnego endTime dla trimSettings
          if (mediaItem.settings && mediaItem.settings.trimSettings) {
            mediaItem.settings.trimSettings.endTime = duration; // Domyślnie cały klip
          }
          // Dla starej struktury trimSettings
          if (mediaItem.trimSettings) {
            mediaItem.trimSettings.endTime = duration;
          }

          video.src = ''; // Zwolnij zasób
          URL.revokeObjectURL(video.src); // Dodatkowe zwolnienie
          updateMediaGallery();
          saveMediaList();
        };
        video.src = url; // URL.createObjectURL(file)
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
        video.muted = true; // Wyciszenie na potrzeby generowania miniatury
        video.onloadeddata = function() {
          video.currentTime = Math.min(1.0, video.duration / 3); // Próba ustawienia klatki dla miniatury
        };
        video.onseeked = function() {
          const canvas = document.createElement('canvas');
          // Ustawienie rozmiaru canvasa na bardziej standardowy dla miniaturek
          canvas.width = 120; canvas.height = 90; // Proporcje 4:3, można dostosować
          const ctx = canvas.getContext('2d');

          // Zachowanie proporcji obrazu wideo
          const videoAspectRatio = video.videoWidth / video.videoHeight;
          const canvasAspectRatio = canvas.width / canvas.height;
          let drawWidth = canvas.width;
          let drawHeight = canvas.height;
          let offsetX = 0;
          let offsetY = 0;

          if (videoAspectRatio > canvasAspectRatio) { // Wideo szersze niż canvas
            drawHeight = canvas.width / videoAspectRatio;
            offsetY = (canvas.height - drawHeight) / 2;
          } else { // Wideo wyższe niż canvas lub te same proporcje
            drawWidth = canvas.height * videoAspectRatio;
            offsetX = (canvas.width - drawWidth) / 2;
          }

          ctx.fillStyle = '#1A1A1A'; // Ciemniejsze tło dla miniaturek
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

          // Dodanie ikony "play" dla wideo
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          const centerX = canvas.width / 2, centerY = canvas.height / 2;
          const triangleSize = Math.min(canvas.width, canvas.height) * 0.2; // Rozmiar ikony play
          ctx.beginPath();
          ctx.moveTo(centerX - triangleSize / 2, centerY - triangleSize * 0.866 / 2); // lewy-górny
          ctx.lineTo(centerX - triangleSize / 2, centerY + triangleSize * 0.866 / 2); // lewy-dolny
          ctx.lineTo(centerX + triangleSize / 2, centerY); // prawy-środek
          ctx.closePath();
          ctx.fill();

          resolve(canvas.toDataURL('image/jpeg', 0.6)); // Lepsza kompresja dla mniejszych plików
          video.src = ''; // Zwolnij zasób
          URL.revokeObjectURL(video.src);
        };
        video.onerror = function() {
          console.error("Error loading video for thumbnail generation:", mediaItem.name);
          resolve(null); // Zwróć null lub placeholder w przypadku błędu
          video.src = '';
          URL.revokeObjectURL(video.src);
        }
        video.src = mediaItem.url;
      }
    });
  };

  // UI UPDATES
  const updateMediaGallery = () => {
    const gallery = state.dom.mediaGallery;
    const emptyState = document.getElementById('media-empty-state');
    if (!gallery) {
      console.error("Media gallery DOM element not found for update.");
      return;
    }
    if (emptyState) {
      emptyState.style.display = state.mediaLibrary.length === 0 ? 'block' : 'none';
    }

    // Usuń tylko elementy .media-thumbnail, zachowaj emptyState
    Array.from(gallery.querySelectorAll('.media-thumbnail')).forEach(child => child.remove());

    state.mediaLibrary.forEach(media => gallery.appendChild(createMediaThumbnail(media)));

    // Po dodaniu wszystkich miniatur, przywróć zaznaczenie (jeśli istnieje)
    updateMediaSelectionUI();

    // Przywróć podświetlenie aktywnego klipu (jeśli istnieje)
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'library') {
      updateActiveHighlight(state.activeHighlight.mediaId, 'library');
    }
  };

  const createMediaThumbnail = (media) => {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'media-thumbnail';
    thumbnail.dataset.id = media.id;
    thumbnail.draggable = true; // Umożliwia przeciąganie do playlisty

    // Element do podświetlenia aktywnego (obecnie odtwarzanego) klipu
    const highlightRing = document.createElement('div');
    highlightRing.className = 'media-active-highlight-ring';
    thumbnail.appendChild(highlightRing);

    thumbnail.addEventListener('dragstart', (e) => {
      // Jeśli element jest częścią zaznaczenia, a mamy więcej zaznaczonych elementów
      if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
        // Przygotuj dane dla przeciągania wielu elementów
        const selectedIds = Array.from(state.selection.items);
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'multiple-media',
          ids: selectedIds
        }));
      } else {
        // Pojedynczy element
        e.dataTransfer.setData('text/plain', media.id);
      }
      e.dataTransfer.effectAllowed = 'copy';
    });

    // Kontener na obrazek/podejrzenie wideo
    const imgContainer = document.createElement('div');
    imgContainer.className = 'media-thumbnail-img-container'; // Klasa dla stylizacji
    if (media.thumbnail) {
      imgContainer.style.backgroundImage = `url(${media.thumbnail})`;
    } else {
      imgContainer.style.backgroundColor = '#333'; // Placeholder, jeśli nie ma miniatury
      imgContainer.textContent = media.type.charAt(0).toUpperCase(); // Np. 'V' dla wideo
      imgContainer.style.display = 'flex';
      imgContainer.style.alignItems = 'center';
      imgContainer.style.justifyContent = 'center';
      imgContainer.style.fontSize = '24px';
      imgContainer.style.color = 'white';
    }
    thumbnail.appendChild(imgContainer);

    // Nazwa pliku
    const nameLabel = document.createElement('div');
    nameLabel.className = 'media-thumbnail-name';
    nameLabel.textContent = media.name;
    thumbnail.appendChild(nameLabel);

    // Badge typu media (Video/Image)
    const badge = document.createElement('div');
    badge.className = 'media-type-badge';
    badge.textContent = media.type.toUpperCase();
    thumbnail.appendChild(badge);

    // Przycisk ustawień (zębatka) - widoczny po najechaniu
    const settingsBtn = document.createElement('button'); // Używamy button dla lepszej semantyki i dostępności
    settingsBtn.className = 'media-settings-btn btn btn-icon'; // Dodajemy btn, btn-icon
    settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>';
    settingsBtn.setAttribute('aria-label', 'Clip settings');
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Zapobiega kliknięciu na thumbnail (selectMedia)
      openMediaSettingsDialog(media); // Nowa funkcja do otwierania dialogu ustawień
    });
    thumbnail.appendChild(settingsBtn);

    // Przycisk usuwania
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'media-delete-btn btn btn-icon btn-danger';
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    deleteBtn.setAttribute('aria-label', 'Delete clip');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Jeśli element jest częścią zaznaczenia, a mamy więcej zaznaczonych elementów, usuń wszystkie zaznaczone
      if (state.selection.items.has(media.id) && state.selection.items.size > 1) {
        const selectedIds = Array.from(state.selection.items);
        if (confirm(`Czy na pewno chcesz usunąć ${selectedIds.length} zaznaczonych klipów?`)) {
          selectedIds.forEach(id => deleteMedia(id));
        }
      } else {
        // Usuń pojedynczy element
        deleteMedia(media.id);
      }
    });
    thumbnail.appendChild(deleteBtn);

    // Tooltip z pełną nazwą (jeśli jest obcięta)
    thumbnail.setAttribute('data-tooltip', media.name); // Można użyć globalnego systemu tooltipów, jeśli istnieje

    // Obsługa kliknięcia - zaznaczanie i odtwarzanie
    thumbnail.addEventListener('click', (e) => {
      // Jeśli kliknięto na przyciski, nie reaguj (już obsługiwane przez ich własne event listenery)
      if (e.target === settingsBtn || settingsBtn.contains(e.target) ||
          e.target === deleteBtn || deleteBtn.contains(e.target)) {
        return;
      }

      // Obsługa zaznaczania
      if (state.selection.shiftKeyActive && state.selection.lastSelected) {
        // Zaznaczanie zakresu przez Shift+kliknięcie
        selectRange(state.selection.lastSelected, media.id);
      } else if (state.selection.shiftKeyActive) {
        // Shift+kliknięcie bez wcześniejszego zaznaczenia - zaznacz tylko ten element
        clearSelection();
        addToSelection(media.id);
        state.selection.lastSelected = media.id;
        updateMediaSelectionUI();
      } else if (state.selection.items.size > 0 && state.selection.items.has(media.id)) {
        // Kliknięcie na zaznaczony element - odtwarzanie
        selectMedia(media, true); // true oznacza odtwarzanie w pętli
      } else {
        // Kliknięcie na niezaznaczony element - wyczyść zaznaczenie i zaznacz tylko ten
        clearSelection();
        addToSelection(media.id);
        state.selection.lastSelected = media.id;
        updateMediaSelectionUI();

        // Odtwarzaj tylko jeśli był to pojedynczy klik (nie część zaznaczania)
        selectMedia(media, true); // true oznacza odtwarzanie w pętli
      }
    });

    return thumbnail;
  };

  const openMediaSettingsDialog = (media) => {
    // Zamykamy istniejące okno dialogowe, jeśli jest otwarte
    const existingDialog = document.getElementById('media-settings-dialog-backdrop');
    if (existingDialog) {
      existingDialog.remove();
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'media-settings-dialog-backdrop';
    backdrop.className = 'media-settings-dialog-backdrop acrylic acrylic-dark'; // Dodajemy klasy acrylic

    const dialog = document.createElement('div');
    dialog.id = 'media-settings-dialog';
    dialog.className = 'media-settings-dialog'; // Klasa dla stylizacji

    // Animacja otwarcia
    setTimeout(() => {
      dialog.classList.add('open');
      backdrop.classList.add('open');
    }, 10); // Małe opóźnienie dla CSS transition

    // Nagłówek dialogu
    const header = document.createElement('div');
    header.className = 'media-settings-dialog-header';
    const title = document.createElement('h3');
    title.textContent = `Settings: ${media.name}`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-icon dialog-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close settings');
    closeBtn.onclick = () => {
      dialog.classList.remove('open');
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 300); // Czas animacji zamknięcia
    };
    header.appendChild(title);
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    // Ciało dialogu z ustawieniami
    const body = document.createElement('div');
    body.className = 'media-settings-dialog-body';

    // Tooltip o stosowaniu ustawień
    const settingsTooltip = document.createElement('div');
    settingsTooltip.className = 'settings-tooltip';
    settingsTooltip.textContent = 'Ustawienia zostaną zastosowane zarówno podczas odtwarzania z biblioteki jak i z playlisty';
    settingsTooltip.style.backgroundColor = 'rgba(var(--primary-color-rgb), 0.1)';
    settingsTooltip.style.padding = '8px';
    settingsTooltip.style.borderRadius = '4px';
    settingsTooltip.style.fontSize = '12px';
    settingsTooltip.style.marginBottom = '15px';
    settingsTooltip.style.color = 'var(--primary-color)';
    settingsTooltip.style.textAlign = 'center';
    body.appendChild(settingsTooltip);

    // 1. Edycja nazwy klipu
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = `media-name-${media.id}`;
    nameLabel.textContent = 'Clip Name:';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `media-name-${media.id}`;
    nameInput.value = media.name;
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    body.appendChild(nameGroup);

    // Referencje dla zintegrowanego przycinania wideo
    let videoPreview = null;
    let trimContainer = null;
    let trimRegion = null;
    let timeDisplay = null;
    let videoDuration = 0;
    let startTime = 0;
    let endTime = 0;

    if (media.type === 'video') {
      // 2. Przycinanie (Trim Settings) - ZINTEGROWANE w tym oknie
      const trimGroup = document.createElement('div');
      trimGroup.className = 'form-group';
      const trimLabel = document.createElement('label');
      trimLabel.textContent = 'Trim Video:';
      trimGroup.appendChild(trimLabel);

      // Podgląd wideo
      videoPreview = document.createElement('video');
      videoPreview.src = media.url;
      videoPreview.controls = true;
      videoPreview.muted = !(media.settings?.volume > 0);
      videoPreview.style.width = '100%';
      videoPreview.style.marginBottom = '10px';
      videoPreview.style.backgroundColor = '#000';
      videoPreview.style.borderRadius = '4px';
      trimGroup.appendChild(videoPreview);

      // Używamy trimSettings z obiektu media.settings, jeśli istnieje, inaczej z media.trimSettings
      let currentTrimSettings = media.settings?.trimSettings || media.trimSettings || { trimEnabled: true, startTime: 0, endTime: null };
      startTime = currentTrimSettings.startTime || 0;
      endTime = currentTrimSettings.endTime;

      videoPreview.onloadedmetadata = function() {
        videoDuration = videoPreview.duration;
        if (endTime === null || endTime === 0 || endTime > videoDuration) {
          endTime = videoDuration;
        }
        // Ustawienie początkowego czasu wideo na startTime dla podglądu
        videoPreview.currentTime = startTime;
        updateTimeDisplay();
      };

      // Opis instrukcji
      const trimDescription = document.createElement('div');
      trimDescription.className = 'trim-description';
      trimDescription.textContent = 'Dostosuj punkty początkowy i końcowy klipu za pomocą suwaków:';
      trimDescription.style.fontSize = '12px';
      trimDescription.style.marginBottom = '10px';
      trimDescription.style.color = 'rgba(255, 255, 255, 0.7)';
      trimGroup.appendChild(trimDescription);

      // Kontener na UI przycinania
      trimContainer = document.createElement('div');

      // Suwak dla punktu początkowego (startTime)
      const startTimeGroup = document.createElement('div');
      startTimeGroup.className = 'form-group';
      startTimeGroup.style.marginBottom = '15px';
      const startTimeLabel = document.createElement('label');
      startTimeLabel.htmlFor = `trim-start-${media.id}`;
      startTimeLabel.textContent = 'Start Point:';
      const startTimeInput = document.createElement('input');
      startTimeInput.type = 'range';
      startTimeInput.id = `trim-start-${media.id}`;
      startTimeInput.min = '0';
      startTimeInput.max = '100'; // Używamy procentów, później przeliczamy
      startTimeInput.step = '0.1';
      startTimeInput.value = (startTime / videoDuration) * 100 || 0;

      const startTimeDisplay = document.createElement('span');
      startTimeDisplay.textContent = formatTimeSimple(startTime);
      startTimeDisplay.style.marginLeft = '10px';

      startTimeInput.oninput = () => {
        const percent = parseFloat(startTimeInput.value) / 100;
        startTime = percent * videoDuration;
        // Zapewniamy, że startTime nie przekroczy endTime
        if (startTime >= endTime) {
          startTime = Math.max(0, endTime - 0.1);
          startTimeInput.value = (startTime / videoDuration) * 100;
        }
        startTimeDisplay.textContent = formatTimeSimple(startTime);
        videoPreview.currentTime = startTime; // Aktualizuj podgląd wideo
        updateTimeDisplay();
      };

      startTimeGroup.appendChild(startTimeLabel);
      startTimeGroup.appendChild(startTimeInput);
      startTimeGroup.appendChild(startTimeDisplay);
      trimContainer.appendChild(startTimeGroup);

      // Suwak dla punktu końcowego (endTime)
      const endTimeGroup = document.createElement('div');
      endTimeGroup.className = 'form-group';
      const endTimeLabel = document.createElement('label');
      endTimeLabel.htmlFor = `trim-end-${media.id}`;
      endTimeLabel.textContent = 'End Point:';
      const endTimeInput = document.createElement('input');
      endTimeInput.type = 'range';
      endTimeInput.id = `trim-end-${media.id}`;
      endTimeInput.min = '0';
      endTimeInput.max = '100'; // Używamy procentów, później przeliczamy
      endTimeInput.step = '0.1';
      endTimeInput.value = (endTime / videoDuration) * 100 || 100;

      const endTimeDisplay = document.createElement('span');
      endTimeDisplay.textContent = formatTimeSimple(endTime);
      endTimeDisplay.style.marginLeft = '10px';

      endTimeInput.oninput = () => {
        const percent = parseFloat(endTimeInput.value) / 100;
        endTime = percent * videoDuration;
        // Zapewniamy, że endTime nie będzie mniejszy niż startTime
        if (endTime <= startTime) {
          endTime = startTime + 0.1;
          endTimeInput.value = (endTime / videoDuration) * 100;
        }
        endTimeDisplay.textContent = formatTimeSimple(endTime);
        videoPreview.currentTime = endTime; // Aktualizuj podgląd wideo
        updateTimeDisplay();
      };

      endTimeGroup.appendChild(endTimeLabel);
      endTimeGroup.appendChild(endTimeInput);
      endTimeGroup.appendChild(endTimeDisplay);
      trimContainer.appendChild(endTimeGroup);

      // Wizualizacja zakresu przycinania
      const trimUIContainer = document.createElement('div');
      Object.assign(trimUIContainer.style, {
        position: 'relative',
        height: '20px',
        backgroundColor: '#111',
        borderRadius: '4px',
        overflow: 'hidden',
        marginTop: '15px',
        marginBottom: '15px'
      });

      const timeline = document.createElement('div');
      Object.assign(timeline.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: '#333'
      });

      trimRegion = document.createElement('div');
      Object.assign(trimRegion.style, {
        position: 'absolute',
        top: '0',
        height: '100%',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.5)',
        borderLeft: '2px solid var(--primary-color)',
        borderRight: '2px solid var(--primary-color)',
        boxSizing: 'border-box'
      });

      timeDisplay = document.createElement('div');
      timeDisplay.style.marginTop = '5px';
      timeDisplay.style.fontSize = '12px';
      timeDisplay.style.textAlign = 'center';
      timeDisplay.style.color = 'rgba(255, 255, 255, 0.7)';

      // Funkcja aktualizacji wyświetlania czasu i wizualizacji przycinania
      const updateTimeDisplay = () => {
        if (videoDuration === 0) return; // Unikaj dzielenia przez zero
        const startPercent = (startTime / videoDuration) * 100;
        const endPercent = (endTime / videoDuration) * 100;
        trimRegion.style.left = startPercent + '%';
        trimRegion.style.width = Math.max(0, endPercent - startPercent) + '%'; // Zapobiegaj ujemnej szerokości
        timeDisplay.textContent = `Start: ${formatTimeSimple(startTime)} | End: ${formatTimeSimple(endTime)} | Duration: ${formatTimeSimple(Math.max(0, endTime - startTime))}`;

        // Aktualizuj wartości suwaków
        if (startTimeInput) startTimeInput.value = (startTime / videoDuration) * 100;
        if (endTimeInput) endTimeInput.value = (endTime / videoDuration) * 100;
        if (startTimeDisplay) startTimeDisplay.textContent = formatTimeSimple(startTime);
        if (endTimeDisplay) endTimeDisplay.textContent = formatTimeSimple(endTime);
      };

      // Dodaj możliwość kliknięcia na timeline, aby przejść do tego punktu
      timeline.addEventListener('click', (e) => {
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

      // 3. Regulacja głośności (Volume)
      const volumeGroup = document.createElement('div');
      volumeGroup.className = 'form-group';
      const volumeLabel = document.createElement('label');
      volumeLabel.htmlFor = `media-volume-${media.id}`;
      volumeLabel.textContent = 'Volume:';
      const volumeInput = document.createElement('input');
      volumeInput.type = 'range';
      volumeInput.id = `media-volume-${media.id}`;
      volumeInput.min = '0';
      volumeInput.max = '1';
      volumeInput.step = '0.01';
      volumeInput.value = media.settings?.volume ?? 0; // Domyślnie wyciszony
      const volumeValueDisplay = document.createElement('span');
      volumeValueDisplay.textContent = `${Math.round(volumeInput.value * 100)}%`;
      volumeInput.oninput = () => {
        volumeValueDisplay.textContent = `${Math.round(volumeInput.value * 100)}%`;
        // Aktualizuj głośność podglądu
        if (videoPreview) {
          videoPreview.volume = volumeInput.value;
          videoPreview.muted = volumeInput.value === 0;
        }
      };
      volumeGroup.appendChild(volumeLabel);
      volumeGroup.appendChild(volumeInput);
      volumeGroup.appendChild(volumeValueDisplay);
      body.appendChild(volumeGroup);

      // 4. Szybkość odtwarzania (Playback Rate)
      const rateGroup = document.createElement('div');
      rateGroup.className = 'form-group';
      const rateLabel = document.createElement('label');
      rateLabel.htmlFor = `media-rate-${media.id}`;
      rateLabel.textContent = 'Playback Speed:';
      const rateInput = document.createElement('input');
      rateInput.type = 'range';
      rateInput.id = `media-rate-${media.id}`;
      rateInput.min = '0.25';
      rateInput.max = '2';
      rateInput.step = '0.25';
      rateInput.value = media.settings?.playbackRate ?? 1;
      const rateValueDisplay = document.createElement('span');
      rateValueDisplay.textContent = `${rateInput.value}x`;
      rateInput.oninput = () => {
        rateValueDisplay.textContent = `${rateInput.value}x`;
        // Aktualizuj szybkość podglądu
        if (videoPreview) {
          videoPreview.playbackRate = parseFloat(rateInput.value);
        }
      };
      rateGroup.appendChild(rateLabel);
      rateGroup.appendChild(rateInput);
      rateGroup.appendChild(rateValueDisplay);
      body.appendChild(rateGroup);
    }

    // 5. Przyciski nawigacji do efektów i przejść
    const navButtonsContainer = document.createElement('div');
    navButtonsContainer.style.display = 'flex';
    navButtonsContainer.style.gap = '10px';
    navButtonsContainer.style.marginTop = '20px';

    // Przycisk do efektów
    const effectsLink = document.createElement('button');
    effectsLink.textContent = 'Go to Effects';
    effectsLink.className = 'btn btn-secondary setting-btn';
    effectsLink.style.flex = '1';
    effectsLink.onclick = () => {
      // Zamknij dialog ustawień
      closeBtn.click();
      // Zamknij aktywne submenu
      closeAllSubmenus();
      // Otwórz sekcję efektów
      const effectsMenuItem = document.querySelector('.category-item[data-action="effects"]');
      if (effectsMenuItem) {
        effectsMenuItem.click();
      } else {
        showNotification('Nie znaleziono opcji EFFECTS w menu głównym', 'warning');
      }
    };

    // Przycisk do przejść
    const transitionsLink = document.createElement('button');
    transitionsLink.textContent = 'Go to Transitions';
    transitionsLink.className = 'btn btn-secondary setting-btn';
    transitionsLink.style.flex = '1';
    transitionsLink.onclick = () => {
      // Zamknij dialog ustawień
      closeBtn.click();
      // Zamknij aktywne submenu
      closeAllSubmenus();
      // Otwórz sekcję przejść
      const transitionsMenuItem = document.querySelector('.category-item[data-action="transitions"]');
      if (transitionsMenuItem) {
        transitionsMenuItem.click();
      } else {
        showNotification('Nie znaleziono opcji TRANSITIONS w menu głównym', 'warning');
      }
    };

    navButtonsContainer.appendChild(effectsLink);
    navButtonsContainer.appendChild(transitionsLink);
    body.appendChild(navButtonsContainer);

    dialog.appendChild(body);

    // Stopka dialogu z przyciskami
    const footer = document.createElement('div');
    footer.className = 'media-settings-dialog-footer';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save Changes';
    saveBtn.onclick = () => {
      // Zapisz zmiany
      media.name = nameInput.value;
      if (media.type === 'video') {
        if (!media.settings) media.settings = {};
        media.settings.volume = parseFloat(document.getElementById(`media-volume-${media.id}`).value);
        media.settings.playbackRate = parseFloat(document.getElementById(`media-rate-${media.id}`).value);

        // Zapisz ustawienia przycinania
        if (!media.settings.trimSettings) {
          media.settings.trimSettings = { trimEnabled: true, startTime: 0, endTime: videoDuration };
        }
        media.settings.trimSettings.startTime = startTime;
        media.settings.trimSettings.endTime = endTime;

        // Zachowaj kompatybilność ze starą strukturą
        if (media.trimSettings) {
          media.trimSettings.startTime = startTime;
          media.trimSettings.endTime = endTime;
        }
      }
      updateMediaGallery(); // Odśwież miniaturkę (np. nazwę)
      updatePlaylistUI();   // Odśwież element na playliście, jeśli tam jest
      saveMediaList();
      showNotification('Settings saved!', 'success');
      closeBtn.click();
    };
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => closeBtn.click();

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    dialog.appendChild(footer);

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Focus na pierwszym inputie
    nameInput.focus();

    // Zwróć funkcję aktualizacji wyświetlania czasu, aby można było jej użyć w innych miejscach
    return { updateTimeDisplay };
  };

  // PLAYLIST DRAG & DROP HANDLERS
  const handlePlaylistDragOver = (e) => {
    e.preventDefault();
    // Sprawdź, czy przeciągany jest element z biblioteki mediów lub element playlisty
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
    e.currentTarget.style.backgroundColor = ''; // Usuń inline styl

    try {
      const jsonDataText = e.dataTransfer.getData('application/json');
      if (jsonDataText) { // Próba odczytania jako JSON (dla reorderowania lub wielu elementów)
        const jsonData = JSON.parse(jsonDataText);

        if (jsonData && jsonData.type === 'multiple-media') {
          // Dodaj wiele elementów do playlisty
          const { ids } = jsonData;
          if (Array.isArray(ids) && ids.length > 0) {
            ids.forEach(id => {
              addToPlaylist(id, state.playlist.items.length); // Dodaj każdy na końcu
            });
            showNotification(`Added ${ids.length} items to playlist`, 'success');
          }
          return;
        }
        else if (jsonData && jsonData.type === 'playlist-reorder') {
          // Jeśli upuszczono na pusty obszar playlisty (nie na inny element)
          // Przesuń na koniec playlisty
          const fromIndex = parseInt(jsonData.index);
          if (!isNaN(fromIndex) && fromIndex >= 0 && fromIndex < state.playlist.items.length) {
            reorderPlaylistItem(fromIndex, state.playlist.items.length - 1);
          }
          return;
        }
      }

      // Jeśli nie JSON lub nieprawidłowy typ, spróbuj jako text/plain (ID z biblioteki)
      const mediaId = e.dataTransfer.getData('text/plain');
      if (mediaId) {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) {
          addToPlaylist(mediaId, state.playlist.items.length); // Dodaj na końcu
        } else {
          console.warn(`Media ID ${mediaId} not found in library on drop onto playlist area.`);
        }
      }
    } catch (err) {
      console.error('Error in handlePlaylistDrop (on container):', err);
    }
  };

  // PLAYLIST MANAGEMENT
  const addToPlaylist = (mediaId, insertAtIndex = -1) => {
    const media = state.mediaLibrary.find(m => m.id === mediaId);
    if (!media) {
      console.error(`Cannot add media ID ${mediaId} to playlist - not found in library`);
      return;
    }

    const wasEmpty = state.playlist.items.length === 0;

    if (insertAtIndex === -1 || insertAtIndex >= state.playlist.items.length) {
      state.playlist.items.push(mediaId); // Dodaj na końcu
    } else {
      state.playlist.items.splice(insertAtIndex, 0, mediaId); // Wstaw na określonej pozycji
      // Aktualizacja currentIndex, jeśli wstawiono przed aktualnie odtwarzanym
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
          // Jeśli usunięto aktualnie odtwarzany, przejdź do następnego (lub pierwszego, jeśli to był ostatni)
          if (state.playlist.currentIndex >= state.playlist.items.length) {
            state.playlist.currentIndex = 0; // Lub state.playlist.items.length - 1 jeśli chcemy poprzedni
          }
          // Nie zmieniaj currentIndex, playNextItem lub playMediaByIndex sobie poradzi
          playMediaByIndex(state.playlist.currentIndex); // Odtwórz element, który jest teraz na tym indeksie
        } else {
          stopPlaylist(); // Playlista jest pusta
        }
      } else if (index < state.playlist.currentIndex) {
        state.playlist.currentIndex--; // Zaktualizuj indeks, jeśli usunięto element przed aktualnym
      }
    } else {
      // Jeśli playlista nie gra, a usunięto element przed currentIndex, lub sam currentIndex
      if (state.playlist.currentIndex >= state.playlist.items.length) {
        state.playlist.currentIndex = Math.max(0, state.playlist.items.length - 1);
      } else if (index < state.playlist.currentIndex) {
        state.playlist.currentIndex--;
      }
      // Jeśli currentIndex był na usuniętym elemencie, a playlista nie grała,
      // currentIndex może teraz wskazywać na element "poza" lub być -1 jeśli playlista pusta
      if (state.playlist.items.length === 0) state.playlist.currentIndex = -1;
    }

    updatePlaylistUI();
    saveMediaList();
    if (media) showNotification(`Removed from playlist: ${media.name}`, 'info');
  };

  const reorderPlaylistItem = (fromIndex, toIndex) => {
    if (fromIndex < 0 || fromIndex >= state.playlist.items.length || toIndex < 0 || toIndex >= state.playlist.items.length) {
      console.warn("Invalid indices for reordering playlist item:", fromIndex, toIndex);
      return;
    }
    if (fromIndex === toIndex) return; // Nie ma potrzeby przesuwać

    try {
      const itemToMove = state.playlist.items.splice(fromIndex, 1)[0];
      state.playlist.items.splice(toIndex, 0, itemToMove);

      // Aktualizacja currentIndex, jeśli przesuwany element był aktualnie odtwarzany
      // lub jeśli przesunięcie wpłynęło na pozycję aktualnie odtwarzanego elementu
      if (state.playlist.isPlaying) {
        if (fromIndex === state.playlist.currentIndex) {
          state.playlist.currentIndex = toIndex;
        } else {
          // Jeśli element został przesunięty sprzed currentIndex na pozycję za currentIndex
          if (fromIndex < state.playlist.currentIndex && toIndex >= state.playlist.currentIndex) {
            state.playlist.currentIndex--;
          }
          // Jeśli element został przesunięty zza currentIndex na pozycję przed currentIndex
          else if (fromIndex > state.playlist.currentIndex && toIndex <= state.playlist.currentIndex) {
            state.playlist.currentIndex++;
          }
        }
      } else { // Jeśli nie gra, ale currentIndex jest ustawiony
        if (fromIndex === state.playlist.currentIndex) {
          state.playlist.currentIndex = toIndex;
        } else {
          if (fromIndex < state.playlist.currentIndex && toIndex >= state.playlist.currentIndex) {
            state.playlist.currentIndex--;
          } else if (fromIndex > state.playlist.currentIndex && toIndex <= state.playlist.currentIndex) {
            state.playlist.currentIndex++;
          }
        }
      }
      updatePlaylistUI();
      saveMediaList();
    } catch (e) {
      console.error('Error reordering playlist item:', e);
    }
  };

  const clearPlaylist = () => {
    try {
      stopPlaylist(); // Zatrzymaj odtwarzanie i wyczyść wyświetlacz
      state.playlist.items = [];
      state.playlist.currentIndex = -1;
      clearPlaybackTimers();
      updatePlaylistUI();
      saveMediaList();
      showNotification('Playlist cleared', 'info');
    } catch (e) {
      console.error('Error in clearPlaylist:', e);
    }
  };

  // MEDIA PLAYBACK
  const selectMedia = (media, loopSingle = false) => { // Dodano argument loopSingle
    console.log(`Selecting media: ${media.name} for playback. Loop: ${loopSingle}`);
    stopPlaylist(false); // Zatrzymaj playlistę, ale nie resetuj jej currentIndex całkowicie
    clearMediaDisplay();

    const element = createMediaElement(media, !loopSingle, loopSingle); // isPlaylist = !loopSingle, loopOverride = loopSingle
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      showNotification(`Now playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');
      // Jeśli to pojedynczy klip, nie ustawiamy playlist.isPlaying
      state.playlist.isPlaying = !loopSingle; // Tylko jeśli to część playlisty (nawet jednoelementowej)
      if (loopSingle) {
        state.playlist.currentIndex = -1; // Wskazuje, że nie gramy z playlisty
        // Dodaj podświetlenie do klikniętego elementu w bibliotece
        updateActiveHighlight(media.id, 'library');
      } else {
        updateActiveHighlight(null); // Usuń wszystkie podświetlenia (będzie dodane w playMediaByIndex)
      }
      updatePlaylistUI(); // Aby odznaczyć poprzedni element playlisty, jeśli był
    }
  };

  const createMediaElement = (media, isPlaylistContext = false, loopOverride = false) => {
    let element;
    if (!media || !media.type) {
      console.error("Cannot create media element: invalid media object provided.", media);
      return null;
    }

    const useTrim = media.type === 'video' && (media.settings?.trimSettings?.trimEnabled || media.trimSettings?.trimEnabled);
    const trimSettingsToUse = media.settings?.trimSettings || media.trimSettings;

    if (media.type === 'image') {
      element = document.createElement('img');
      element.src = media.url;
      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });
      if (isPlaylistContext) { // Tylko w kontekście playlisty używamy timera dla obrazów
        clearPlaybackTimers();
        state.playlist.playbackTimer = setTimeout(() => {
          if (state.playlist.isPlaying) playNextItem();
        }, 5000); // Czas wyświetlania obrazu
      }
    } else if (media.type === 'video') {
      element = document.createElement('video');
      element.src = media.url;
      element.autoplay = true;
      element.loop = loopOverride; // Użyj loopOverride dla pojedynczych klipów
      element.muted = (media.settings?.volume === 0) || (media.settings?.volume === undefined && !isPlaylistContext); // Wycisz, jeśli głośność 0 lub nie jest zdefiniowana i nie jest z playlisty
      element.volume = media.settings?.volume ?? (isPlaylistContext ? 0.5 : 0); // Ustaw głośność, domyślnie 0.5 dla playlisty, 0 dla pojedynczego
      element.playbackRate = media.settings?.playbackRate ?? 1;

      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: '0', left: '0' });

      element.addEventListener('error', function(e) {
        console.error(`Error loading video: ${media.name}`, e);
        if (isPlaylistContext && state.playlist.isPlaying) {
          setTimeout(() => playNextItem(), 100); // Spróbuj następny po krótkiej chwili
        }
      });

      if (useTrim && trimSettingsToUse) {
        element.addEventListener('loadedmetadata', function() {
          this.currentTime = trimSettingsToUse.startTime || 0;
        });
        element.addEventListener('timeupdate', function() {
          // Wymuszenie startTime, jeśli wideo cofnęło się przed
          if (this.currentTime < (trimSettingsToUse.startTime - 0.1)) { // Mała tolerancja
            this.currentTime = trimSettingsToUse.startTime;
          }
          if (trimSettingsToUse.endTime && this.currentTime >= trimSettingsToUse.endTime) {
            if (isPlaylistContext && state.playlist.isPlaying && !loopOverride) {
              playNextItem();
            } else if (loopOverride) { // Jeśli loopOverride jest true, zapętlaj w ramach trim
              this.currentTime = trimSettingsToUse.startTime || 0;
              this.play(); // Upewnij się, że gra
            } else {
              // Jeśli nie jest w kontekście playlisty i nie ma loopOverride, zatrzymaj na końcu trimu
              this.pause();
            }
          }
        });
      }
      // Standardowe 'ended' dla wideo bez trim lub jeśli trim się nie aplikuje
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
      showNotification('Playlist is empty. Add media to play.', 'info');
      return;
    }
    // Jeśli kliknięto "Play All", a playlista już gra, potraktuj to jako pauzę.
    // Jeśli kliknięto konkretny element na playliście (currentIndex już ustawiony), to zawsze odtwarzaj.
    const playAllButton = document.getElementById('playlist-play-button');
    const isPlayAllClick = playAllButton && playAllButton.contains(event?.target);

    if (state.playlist.isPlaying && isPlayAllClick) {
      pausePlaylist();
      return;
    }

    clearPlaybackTimers();
    state.playlist.advancingInProgress = false; // Reset flagi

    // Jeśli currentIndex jest nieprawidłowy lub nieustawiony, zacznij od początku (lub losowo)
    if (state.playlist.currentIndex < 0 || state.playlist.currentIndex >= state.playlist.items.length) {
      state.playlist.currentIndex = state.playlist.shuffle ? Math.floor(Math.random() * state.playlist.items.length) : 0;
    }

    state.playlist.isPlaying = true;
    clearMediaDisplay(); // Wyczyść poprzednie media
    playMediaByIndex(state.playlist.currentIndex);
    updatePlaylistUI(); // Aktualizuj UI (np. przycisk Play/Pause)
  };

  const pausePlaylist = () => {
    state.playlist.isPlaying = false;
    clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) videoElement.pause();
    updatePlaylistUI();
    showNotification("Playlist paused", "info");
  };

  const playMediaByIndex = (index) => {
    if (index < 0 || index >= state.playlist.items.length) {
      if (state.playlist.items.length > 0) {
        index = 0; // Wróć na początek, jeśli indeks jest poza zakresem
        state.playlist.currentIndex = 0;
      } else {
        stopPlaylist(); // Playlista jest pusta
        return;
      }
    }

    const mediaId = state.playlist.items[index];
    const media = state.mediaLibrary.find(m => m.id === mediaId);

    if (!media) {
      console.error(`Media not found for ID: ${mediaId} at index ${index}. Skipping.`);
      // Spróbuj odtworzyć następny element, jeśli playlista nadal gra
      if (state.playlist.isPlaying) {
        // Usuń błędny element z playlisty, aby uniknąć pętli błędów
        state.playlist.items.splice(index, 1);
        if (index < state.playlist.currentIndex) state.playlist.currentIndex--; // Popraw currentIndex
        // Jeśli usunięto ostatni element, zatrzymaj
        if (state.playlist.items.length === 0) {
          stopPlaylist();
          return;
        }
        // Spróbuj odtworzyć element, który jest teraz na tym indeksie (lub następny)
        const nextIndexToTry = Math.min(index, state.playlist.items.length - 1);
        playNextItem(nextIndexToTry); // Przekaż indeks do próby
      }
      return;
    }

    state.playlist.currentIndex = index;
    state.playlist.isPlaying = true; // Upewnij się, że stan odtwarzania jest poprawny

    clearMediaDisplay(); // Wyczyść poprzednio wyświetlane media
    const element = createMediaElement(media, true); // true oznacza kontekst playlisty
    if (element) {
      state.dom.mediaContainer.appendChild(element);
      if (element.tagName.toLowerCase() === 'video' && typeof element.load === 'function') {
        element.load(); // Upewnij się, że wideo jest ładowane (szczególnie po zmianie src)
        element.play().catch(e => console.warn("Autoplay prevented for video:", media.name, e));
      }

      // Aktualizuj podświetlenie aktywnego elementu w playliście
      updateActiveHighlight(media.id, 'playlist');

      updatePlaylistUI(); // Aktualizuj UI, aby podświetlić bieżący element
    } else {
      // Jeśli nie udało się stworzyć elementu, spróbuj następny
      if (state.playlist.isPlaying) playNextItem();
    }
  };

  const playNextItem = (startIndex = -1) => {
    if (!state.playlist.isPlaying || state.playlist.items.length === 0) {
      stopPlaylist(); // Jeśli nie ma co grać, zatrzymaj
      return;
    }
    if (state.playlist.advancingInProgress) return; // Zapobieganie wielokrotnemu wywołaniu
    state.playlist.advancingInProgress = true;

    clearPlaybackTimers();
    let nextIndex;

    if (startIndex !== -1 && startIndex < state.playlist.items.length) { // Jeśli przekazano konkretny indeks startowy (np. po błędzie)
      nextIndex = startIndex;
    } else if (state.playlist.shuffle) {
      if (state.playlist.items.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * state.playlist.items.length);
        } while (nextIndex === state.playlist.currentIndex); // Unikaj odtwarzania tego samego pod rząd w shuffle
      } else {
        nextIndex = 0; // Tylko jeden element, odtwórz go
      }
    } else {
      nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
    }

    state.playlist.currentIndex = nextIndex;
    // state.playlist.isPlaying = true; // Już powinno być true
    playMediaByIndex(nextIndex);

    // Użyj małego opóźnienia przed zresetowaniem flagi, aby uniknąć problemów z szybkimi przejściami
    setTimeout(() => { state.playlist.advancingInProgress = false; }, 100);
  };

  const clearPlaybackTimers = () => { if (state.playlist.playbackTimer) { clearTimeout(state.playlist.playbackTimer); state.playlist.playbackTimer = null; } };
  const toggleShuffle = () => { state.playlist.shuffle = !state.playlist.shuffle; updatePlaylistUI(); showNotification(state.playlist.shuffle ? 'Shuffle mode: On' : 'Shuffle mode: Off', 'info'); };

  const stopPlaylist = (resetIndexAndDisplay = true) => {
    state.playlist.isPlaying = false;
    clearPlaybackTimers();
    const videoElement = state.dom.mediaContainer.querySelector('video');
    if (videoElement) {
      videoElement.pause();
      // Nie resetuj currentTime, jeśli chcemy wznowić później
    }
    if (resetIndexAndDisplay) {
      state.playlist.currentIndex = -1;
      clearMediaDisplay();
    }
    updatePlaylistUI();
  };

  const clearMediaDisplay = () => {
    try {
      clearPlaybackTimers();
      // Usuń wszystkie dzieci z mediaContainer
      while (state.dom.mediaContainer.firstChild) {
        const el = state.dom.mediaContainer.firstChild;
        if (el.tagName && (el.tagName.toLowerCase() === 'video' || el.tagName.toLowerCase() === 'audio')) {
          el.pause();
          el.removeAttribute('src'); // Ważne, aby zwolnić zasób
          if (typeof el.load === 'function') el.load(); // Próba zresetowania elementu
        }
        state.dom.mediaContainer.removeChild(el);
      }
      // state.dom.mediaContainer.innerHTML = ''; // Prostsze, ale może być mniej wydajne i gorsze dla GC
    } catch (e) {
      console.error("Error clearing media display:", e);
      if (state.dom.mediaContainer) state.dom.mediaContainer.innerHTML = ''; // Fallback
    }
  };

  // MEDIA MANAGEMENT
  const deleteMedia = (id) => {
    const indexInLibrary = state.mediaLibrary.findIndex(m => m.id === id);
    if (indexInLibrary === -1) return;

    const mediaToDelete = state.mediaLibrary[indexInLibrary];
    URL.revokeObjectURL(mediaToDelete.url); // Zwolnij zasób ObjectURL
    state.mediaLibrary.splice(indexInLibrary, 1);

    // Usuń ze wszystkich instancji na playliście
    let wasPlayingDeletedItem = false;
    let deletedItemCurrentIndex = -1;

    for (let i = state.playlist.items.length - 1; i >= 0; i--) {
      if (state.playlist.items[i] === id) {
        if (state.playlist.isPlaying && i === state.playlist.currentIndex) {
          wasPlayingDeletedItem = true;
          deletedItemCurrentIndex = i; // Zapamiętaj, że to był aktualny
        }
        state.playlist.items.splice(i, 1);
        // Popraw currentIndex, jeśli usunięto element przed nim
        if (i < state.playlist.currentIndex) {
          state.playlist.currentIndex--;
        }
      }
    }

    if (wasPlayingDeletedItem) {
      if (state.playlist.items.length > 0) {
        // Spróbuj odtworzyć element, który jest teraz na deletedItemCurrentIndex (lub następny, jeśli to był ostatni)
        const nextIndexToPlay = Math.min(deletedItemCurrentIndex, state.playlist.items.length - 1);
        playMediaByIndex(nextIndexToPlay);
      } else {
        stopPlaylist(); // Playlista pusta
      }
    } else if (state.playlist.currentIndex >= state.playlist.items.length && state.playlist.items.length > 0) {
      // Jeśli currentIndex jest teraz poza zakresem (np. usunięto ostatni element, ale nie był on odtwarzany)
      state.playlist.currentIndex = state.playlist.items.length - 1;
    }

    // Jeśli aktualnie wyświetlany (pojedynczo) element został usunięty
    const currentMediaElement = state.dom.mediaContainer.querySelector('img, video');
    if (currentMediaElement && currentMediaElement.src === mediaToDelete.url) {
      clearMediaDisplay();
      // Jeśli playlista nie grała, a usunięto pojedynczy element, nie ma potrzeby nic więcej robić
      // Jeśli playlista grała, a usunięty element nie był z playlisty, to playlista powinna grać dalej (jeśli była aktywna)
    }

    if (state.mediaLibrary.length === 0) {
      // Jeśli biblioteka jest pusta, wyczyść też playlistę
      clearPlaylist();
    } else {
      updatePlaylistUI(); // Aktualizuj UI playlisty
    }

    updateMediaGallery(); // Aktualizuj UI biblioteki
    saveMediaList();
    showNotification(`Removed: ${mediaToDelete.name}`, 'info');
  };

  // PLAYLIST UI UPDATE
  const updatePlaylistUI = () => {
    const playlistContainer = state.dom.playlistContainer;
    const emptyState = document.getElementById('playlist-empty-state');
    const controlsContainer = state.dom.playlistControlsContainer;

    if (!playlistContainer || !controlsContainer) {
      console.error("Required DOM elements for playlist UI not found.");
      return;
    }

    // Usuń tylko elementy .playlist-item, zachowaj emptyState
    Array.from(playlistContainer.querySelectorAll('.playlist-item')).forEach(child => child.remove());

    if (state.playlist.items.length === 0) {
      if(emptyState) emptyState.style.display = 'block';
      controlsContainer.style.visibility = 'hidden';
    } else {
      if(emptyState) emptyState.style.display = 'none';
      controlsContainer.style.visibility = 'visible';

      state.playlist.items.forEach((mediaId, index) => {
        const media = state.mediaLibrary.find(m => m.id === mediaId);
        if (media) playlistContainer.appendChild(createPlaylistItem(media, index));
        else console.warn(`Media ID ${mediaId} at index ${index} not found in library for playlist UI`);
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

    // Odśwież podświetlenie aktywnego elementu playlisty (jeśli istnieje)
    if (state.activeHighlight.mediaId && state.activeHighlight.sourceType === 'playlist') {
      updateActiveHighlight(state.activeHighlight.mediaId, 'playlist');
    }
  };

  // CREATE PLAYLIST ITEM
  const createPlaylistItem = (media, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.dataset.id = media.id;
    item.dataset.index = index;
    if (index === state.playlist.currentIndex) item.classList.add('current');

    // Element do podświetlenia aktywnego (obecnie odtwarzanego) klipu
    const highlightRing = document.createElement('div');
    highlightRing.className = 'media-active-highlight-ring';
    item.appendChild(highlightRing);

    item.draggable = true;
    // Eventy drag & drop dla reorderowania wewnątrz playlisty
    item.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'playlist-reorder', id: media.id, index: index }));
      e.dataTransfer.effectAllowed = 'move';
      this.classList.add('dragging'); // Wizualny feedback
    });
    item.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      // Usuń klasy 'drag-over- ऊपर/नीचे' ze wszystkich elementów
      document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom').forEach(i => {
        i.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });
    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = this.getBoundingClientRect();
      const isOverTopHalf = e.clientY < rect.top + rect.height / 2;
      document.querySelectorAll('.playlist-item.drag-over-top, .playlist-item.drag-over-bottom').forEach(i => {
        i.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      if (isOverTopHalf) {
        this.classList.add('drag-over-top');
      } else {
        this.classList
            .add('drag-over-bottom');
      }
    });
    item.addEventListener('dragleave', function() {
      this.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    item.addEventListener('drop', function(e) {
      e.preventDefault(); e.stopPropagation();
      this.classList.remove('drag-over-top', 'drag-over-bottom');
      try {
        const dataText = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        if (!dataText) return;

        let droppedData;
        try {
          droppedData = JSON.parse(dataText);
        } catch (err) {
          // Jeśli nie JSON, to prawdopodobnie ID z biblioteki mediów
          const mediaId = dataText;
          const targetIndex = parseInt(this.dataset.index);
          const rect = this.getBoundingClientRect();
          const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
          const insertAtIndex = isDroppedOnTopHalf ? targetIndex : targetIndex + 1;

          addToPlaylist(mediaId, insertAtIndex); // Dodaj na konkretnej pozycji
          return;
        }

        if (droppedData && droppedData.type === 'playlist-reorder') {
          const fromIndex = parseInt(droppedData.index);
          let toIndex = parseInt(this.dataset.index);
          if (fromIndex === toIndex) return; // Nie upuszczono na samego siebie w tej samej pozycji

          const rect = this.getBoundingClientRect();
          const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;

          if (!isDroppedOnTopHalf && fromIndex < toIndex) {
            // Przesuwanie w dół, upuszczono na dolną połowę elementu docelowego
            // toIndex pozostaje bez zmian (za elementem docelowym)
          } else if (isDroppedOnTopHalf && fromIndex > toIndex) {
            // Przesuwanie w górę, upuszczono na górną połowę elementu docelowego
            // toIndex pozostaje bez zmian (przed elementem docelowym)
          } else if (fromIndex < toIndex) { // Przesuwanie w dół
            toIndex = isDroppedOnTopHalf ? toIndex -1 : toIndex;
          } else { // Przesuwanie w górę
            toIndex = isDroppedOnTopHalf ? toIndex : toIndex +1;
          }
          if (fromIndex < toIndex) toIndex--; // Korekta dla splice

          reorderPlaylistItem(fromIndex, toIndex);
        } else if (droppedData && droppedData.type === 'multiple-media') {
          // Obsługa upuszczenia wielu zaznaczonych elementów
          const { ids } = droppedData;
          if (Array.isArray(ids) && ids.length > 0) {
            const targetIndex = parseInt(this.dataset.index);
            const rect = this.getBoundingClientRect();
            const isDroppedOnTopHalf = e.clientY < rect.top + rect.height / 2;
            const insertAtIndex = isDroppedOnTopHalf ? targetIndex : targetIndex + 1;

            // Dodaj wszystkie elementy, zaczynając od określonego indeksu
            ids.forEach((id, i) => {
              addToPlaylist(id, insertAtIndex + i);
            });

            showNotification(`Added ${ids.length} items to playlist`, 'success');
          }
        }
      } catch (err) { console.error('Error during playlist drop handling:', err); }
    });


    const thumbnail = document.createElement('div');
    thumbnail.className = 'playlist-item-thumbnail';
    if (media.thumbnail) {
      thumbnail.style.backgroundImage = `url(${media.thumbnail})`;
    } else {
      thumbnail.style.backgroundColor = '#333';
      thumbnail.textContent = media.type.charAt(0).toUpperCase();
    }
    // Wskaźnik przycięcia
    let isTrimmed = false;
    if (media.type === 'video') {
      const trimSettings = media.settings?.trimSettings || media.trimSettings;
      if (trimSettings && trimSettings.trimEnabled) {
        // Sprawdź, czy startTime lub endTime różnią się od pełnej długości (wymaga dostępu do duration)
        // Na razie uproszczone: jeśli trimEnabled jest true
        isTrimmed = true;
      }
    }
    if (isTrimmed) {
      const trimIndicator = document.createElement('div');
      trimIndicator.className = 'playlist-item-trim-indicator';
      trimIndicator.innerHTML = '<span style="filter: grayscale(100%);">✂️</span>';
      thumbnail.appendChild(trimIndicator);
    }


    const infoContainer = document.createElement('div');
    infoContainer.className = 'playlist-item-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'playlist-item-name';
    nameEl.textContent = media.name;
    infoContainer.appendChild(nameEl);

    const detailsEl = document.createElement('div');
    detailsEl.className = 'playlist-item-details';
    let detailsText = `${media.type} · ${formatFileSize(media.size)}`;
    if (isTrimmed && media.type === 'video') {
      const trimSettings = media.settings?.trimSettings || media.trimSettings;
      // Aby pokazać czas trwania przycięcia, potrzebujemy videoDuration, co nie jest łatwo dostępne tutaj.
      // Można by przechowywać duration w obiekcie media po pierwszym załadowaniu.
      // Na razie:
      detailsText += ` · Trimmed`;
      if (trimSettings.startTime !== undefined && trimSettings.endTime !== undefined) {
        const duration = trimSettings.endTime - trimSettings.startTime;
        if (duration > 0) {
          detailsText += ` (${formatTimeSimple(duration)})`;
        }
      }
    }
    detailsEl.textContent = detailsText;
    infoContainer.appendChild(detailsEl);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-icon btn-danger playlist-item-delete';
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="0.8em" height="0.8em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    deleteBtn.setAttribute('aria-label', 'Remove from playlist');

    // Odtwarzanie po kliknięciu na element playlisty
    item.addEventListener('click', function(e) {
      if (e.target === deleteBtn || deleteBtn.contains(e.target)) return; // Nie odtwarzaj, jeśli kliknięto przycisk usuwania
      if (state.playlist.isPlaying && state.playlist.currentIndex === index) {
        // Jeśli kliknięto na aktualnie odtwarzany element, można by zaimplementować pauzę/wznowienie
        pausePlaylist();
        return;
      }
      state.playlist.currentIndex = index;
      playPlaylist(); // Rozpoczyna odtwarzanie od tego elementu

      // Aktualizuj podświetlenie aktywnego elementu na playliście
      updateActiveHighlight(media.id, 'playlist');
    });
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      removeFromPlaylist(index);
    });

    item.appendChild(thumbnail);
    item.appendChild(infoContainer);
    item.appendChild(deleteBtn);

    // Wskaźnik odtwarzania
    if (index === state.playlist.currentIndex && state.playlist.isPlaying) {
      const playingIndicator = document.createElement('div');
      playingIndicator.className = 'playlist-item-playing-indicator';
      playingIndicator.innerHTML = '<span style="filter: grayscale(100%);">▶</span>';
      // Można dodać do thumbnail lub item
      thumbnail.appendChild(playingIndicator); // Dodajemy do miniatury
    }

    return item;
  };

  // STORAGE FUNCTIONS
  const saveMediaList = () => {
    try {
      // Przechowuj tylko metadane, bez URL (bo ObjectURL są tymczasowe)
      // Można by przechowywać FileSystemHandle.name lub path, jeśli używamy File System Access API
      const mediaForStorage = state.mediaLibrary.map(media => {
        const { url, thumbnail, ...mediaMeta } = media; // Usuń url i thumbnail (który może być dataURL)
        return { ...mediaMeta, name: media.name, type: media.type, mimeType: media.mimeType, size: media.size, dateAdded: media.dateAdded, settings: media.settings, trimSettings: media.trimSettings };
      });
      const storageData = {
        media: mediaForStorage,
        playlist: {
          items: state.playlist.items, // Przechowuj ID, które będą mapowane do mediaForStorage po załadowaniu
          shuffle: state.playlist.shuffle,
          // Nie zapisuj currentIndex, bo może być nieaktualny
        }
      };
      localStorage.setItem('flStudioWallpaper_media_v2', JSON.stringify(storageData));
    } catch (e) {
      console.error('Failed to save media list to localStorage:', e);
      // Można dodać powiadomienie dla użytkownika
      showNotification('Error saving media library. Some data might be lost on refresh.', 'error');
    }
  };

  const loadSavedMedia = () => {
    try {
      const savedData = localStorage.getItem('flStudioWallpaper_media_v2');
      if (!savedData) return;
      const parsedData = JSON.parse(savedData);

      if (parsedData.media && Array.isArray(parsedData.media)) {
        // TODO: Implementacja ponownego ładowania plików na podstawie zapisanych ścieżek/nazw
        // Obecnie, ponieważ URL.createObjectURL() jest tymczasowy, nie możemy odtworzyć plików.
        // Można by prosić użytkownika o ponowne wskazanie folderu/plików.
        // Na razie, tylko informacja.
        if (parsedData.media.length > 0) {
          showNotification(
              `Found ${parsedData.media.length} media entries from previous session. Please re-import files to use them.`,
              'info'
          );
          // Można by spróbować odtworzyć metadane, ale bez działających URLi to mało użyteczne.
          // state.mediaLibrary = parsedData.media.map(item => ({...item, url: null, thumbnail: null}));
        }
      }

      if (parsedData.playlist) {
        // state.playlist.items = []; // Zacznij z pustą playlistą, bo media nie są ładowane
        // Jeśli jednak chcemy próbować odtworzyć playlistę na podstawie ID, które mogą pasować do
        // potencjalnie zaimportowanych później plików, można by to zrobić.
        // Na razie bezpieczniej jest czyścić playlistę.
        state.playlist.shuffle = parsedData.playlist.shuffle || false;
      }

      updateMediaGallery(); // Odśwież UI biblioteki (będzie pusta)
      updatePlaylistUI();   // Odśwież UI playlisty (też pusta)

    } catch (e) {
      console.error('Failed to load media data from localStorage:', e);
      localStorage.removeItem('flStudioWallpaper_media_v2'); // Usuń uszkodzone dane
    }
  };

  // UTILITY FUNCTIONS
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const formatTimeSimple = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Funkcja do wyświetlania powiadomień - używamy istniejącej funkcji jeśli jest dostępna,
  // ale upewniamy się, że działa nawet jeśli nie mamy dostępu do globalnego obiektu WallpaperApp
  const showNotification = (message, type) => {
    if (typeof WallpaperApp !== 'undefined' && WallpaperApp.UI && typeof WallpaperApp.UI.showNotification === 'function') {
      WallpaperApp.UI.showNotification(message, type);
    } else {
      console.log(`[${type ? type.toUpperCase() : 'INFO'}] ${message}`);
      // Implementacja własnego tooltipa jeśli nie ma globalnej funkcji
      const body = document.querySelector('body');
      if (body) {
        const notification = document.createElement('div');
        notification.className = `custom-notification ${type || 'info'}`;
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        notification.style.color = 'white';
        notification.style.padding = '10px 15px';
        notification.style.borderRadius = '4px';
        notification.style.zIndex = '9999';
        notification.style.maxWidth = '300px';
        notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(20px)';

        if (type === 'success') {
          notification.style.borderLeft = '4px solid #4caf50';
        } else if (type === 'warning') {
          notification.style.borderLeft = '4px solid #ff9800';
        } else if (type === 'error') {
          notification.style.borderLeft = '4px solid #f44336';
        } else {
          notification.style.borderLeft = '4px solid #2196f3';
        }

        body.appendChild(notification);

        // Dajmy chwilę na dodanie do DOM, zanim animujemy
        setTimeout(() => {
          notification.style.opacity = '1';
          notification.style.transform = 'translateX(0)';
        }, 10);

        // Automatycznie usuwamy po 3 sekundach
        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transform = 'translateX(20px)';
          setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
          }, 300);
        }, 3000);
      }
    }
  };

  // Funkcja zamykająca submenu
  const closeAllSubmenus = () => {
    // Znajdź wszystkie aktywne submenu
    const activeSubmenus = document.querySelectorAll('.slide-submenu.active');
    const submenuWrapper = document.querySelector('.submenu-wrapper');

    if (submenuWrapper && submenuWrapper.classList.contains('active')) {
      activeSubmenus.forEach(submenu => {
        submenu.classList.remove('active');
      });
      submenuWrapper.classList.remove('active');
    }

    // Usuń klasę 'selected' z elementów menu
    document.querySelectorAll('.category-item').forEach(item => {
      item.classList.remove('selected');
    });
  };

  // Public API
  return {
    init,
    // Eksportujemy dodatkowe funkcje, które mogą być przydatne z zewnątrz
    getCurrentPlaylist: () => state.playlist,
    getMediaLibrary: () => state.mediaLibrary,
    openMediaSettings: (mediaId) => {
      const media = state.mediaLibrary.find(m => m.id === mediaId);
      if (media) {
        openMediaSettingsDialog(media);
      }
    }
  };
})();

MediaModule.init();
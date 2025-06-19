/**
 * FL Studio Wallpaper App - Player Engine Module
 * Version 0.7.2 - Assignment Error Fix by Gemini
 *
 * This dedicated module handles all media playback, transitions, and highlighting.
 */

const PlayerEngine = (() => {
  "use strict";

  let state = null; // Private reference to MediaManager's state
  let PlaylistManager = null; // Private reference to MediaManager's PlaylistManager

  // Initialize and link to the main manager's state and necessary components
  const init = (managerState, managerPlaylistManager) => {
    console.log("[PlayerEngine] Initializing and linking state...");
    state = managerState;
    PlaylistManager = managerPlaylistManager;
    if(state && PlaylistManager) {
      console.log("[PlayerEngine] State and managers linked successfully.");
    } else {
      console.error("[PlayerEngine] Failed to link state or managers from MediaManager.");
    }
  };

  const CONSTANTS = {
    IMAGE_DISPLAY_DURATION: 5000,
  };

  // --- MediaPlayer Logic ---
  const MediaPlayer = {
    selectMedia(media, loopSingle = false) {
      this.stopPlaylist(false);
      this.clearDisplay();
      const element = this.createMediaElement(media, !loopSingle, loopSingle);
      if (element) {
        state.dom.mediaContainer.appendChild(element);
        WallpaperApp.UI.showNotification(`Playing: ${media.name}${loopSingle ? ' (looping)' : ''}`, 'info');
        state.playlist.isPlaying = !loopSingle;
        const playlistIdx = state.playlist.items.indexOf(media.id);

        if (loopSingle) {
          state.playlist.currentIndex = -1;
          HighlightManager.updateActiveHighlight(media.id, 'library');
        } else if (playlistIdx !== -1) {
          state.playlist.currentIndex = playlistIdx;
          HighlightManager.updateActiveHighlight(media.id, 'playlist');
        } else {
          state.playlist.currentIndex = -1;
          HighlightManager.updateActiveHighlight(media.id, 'library');
        }
        PlaylistManager.updateUI();
      } else {
        WallpaperApp.UI.showNotification(`Cannot play ${media.name}.`, 'error');
      }
    },

    createMediaElement(media, isPlaylistContext = false, loopOverride = false) {
      if (!media || !media.type || !media.url) return null;
      let element;

      if (media.type === 'image') {
        element = document.createElement('img');
        element.src = media.url;
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

        element.addEventListener('error', () => { if (isPlaylistContext) setTimeout(() => this.playNextItem(), 100); });

        if (isPlaylistContext && !loopOverride) {
          const timeUpdateHandler = () => {
            // Check for the *upcoming* transition to get the correct duration
            const nextIndex = (state.playlist.currentIndex + 1) % state.playlist.items.length;
            const transitionData = state.playlist.transitions[nextIndex];
            const prefetchTime = ((transitionData?.params?.duration || 700) / 1000) / 2;

            if (element.duration && (element.duration - element.currentTime) < prefetchTime) {
              element.removeEventListener('timeupdate', timeUpdateHandler);
              if (state.playlist.isPlaying) this.playNextItem();
            }
          };
          element.addEventListener('timeupdate', timeUpdateHandler);
          element.addEventListener('ended', () => { if (state.playlist.isPlaying) this.playNextItem(); });
        }
      }

      if (element) {
        Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover' });
        this.applyEffectsToElement(element, media.settings?.effects || []);
      }
      return element;
    },

    applyEffectsToElement(element, effects) {
      let filterString = effects.map(eff => {
        const pVal = eff.params?.intensity ?? eff.params?.level ?? 100;
        const intensity = parseFloat(pVal);
        if (isNaN(intensity)) return '';
        switch (eff.effectId) {
          case 'blur': return `blur(${intensity/10}px)`;
          case 'grayscale': return `grayscale(${intensity}%)`;
          case 'sepia': return `sepia(${intensity}%)`;
          case 'brightness': return `brightness(${intensity}%)`;
          default: return '';
        }
      }).join(' ');
      element.style.filter = filterString.trim() || 'none';
    },

    playPlaylist() {
      if (state.playlist.items.length === 0) return;
      if (state.playlist.isPlaying) return this.pausePlaylist();
      this.clearPlaybackTimers();
      state.playlist.isPlaying = true;
      if (state.playlist.shuffle) {
        state.playlist.playedInShuffle.clear();
        if (state.playlist.currentIndex < 0) state.playlist.currentIndex = Math.floor(Math.random() * state.playlist.items.length);
        state.playlist.playedInShuffle.add(state.playlist.items[state.playlist.currentIndex]);
      } else {
        if (state.playlist.currentIndex < 0) state.playlist.currentIndex = 0;
      }
      this.clearDisplay();
      this.playByIndex(state.playlist.currentIndex);
      PlaylistManager.updateUI();
    },

    pausePlaylist() {
      state.playlist.isPlaying = false;
      this.clearPlaybackTimers();
      const videoEl = state.dom.mediaContainer.querySelector('video');
      if (videoEl && !videoEl.paused) videoEl.pause();
      PlaylistManager.updateUI();
      WallpaperApp.UI.showNotification("Playlist paused.", "info");
    },

    stopPlaylist(reset = true) {
      state.playlist.isPlaying = false;
      this.clearPlaybackTimers();
      if (reset) {
        state.playlist.currentIndex = -1;
        this.clearDisplay();
        HighlightManager.updateActiveHighlight(null);
      }
      state.playlist.playedInShuffle.clear();
      PlaylistManager.updateUI();
    },

    playByIndex(index, isTransitioning = false) {
      if (index < 0 || index >= state.playlist.items.length) {
        if (state.playlist.items.length > 0) index = 0; else { this.stopPlaylist(); return null; }
      }
      const media = state.mediaLibrary.find(m => m.id === state.playlist.items[index]);
      if (!media) {
        WallpaperApp.UI.showNotification(`Media not found, removing from playlist.`, 'warning');
        PlaylistManager.removeItem(index);
        this.playNextItem(); // Try to play the next one
        return null;
      }
      state.playlist.currentIndex = index;
      state.playlist.isPlaying = true;
      const newElement = this.createMediaElement(media, true);
      if (!newElement) return null;
      if (!isTransitioning) {
        this.clearDisplay();
        state.dom.mediaContainer.appendChild(newElement);
        if (newElement.tagName === 'VIDEO' && newElement.paused) newElement.play().catch(()=>{});
      }
      HighlightManager.updateActiveHighlight(media.id, 'playlist');
      if (state.playlist.shuffle) state.playlist.playedInShuffle.add(media.id);
      PlaylistManager.updateUI();
      return newElement;
    },

    applyTransition(oldElement, newElement, transitionData) {
      const { duration = 700 } = transitionData.params;
      newElement.style.opacity = '0';
      Object.assign(newElement.style, { position: 'absolute', top: 0, left: 0, zIndex: 1, width: '100%', height: '100%' });
      state.dom.mediaContainer.appendChild(newElement);
      Object.assign(oldElement.style, { position: 'absolute', top: 0, left: 0, zIndex: 2, width: '100%', height: '100%' });
      if (newElement.tagName === 'VIDEO' && newElement.paused) newElement.play().catch(()=>{});

      const cleanup = () => {
        if(oldElement.parentNode) oldElement.remove();
        Object.assign(newElement.style, { position: 'relative', zIndex: 0 });
      };

      oldElement.style.transition = `opacity ${duration}ms ease-out`;
      newElement.style.transition = `opacity ${duration}ms ease-in`;

      requestAnimationFrame(() => {
        oldElement.style.opacity = '0';
        newElement.style.opacity = '1';
      });
      setTimeout(cleanup, duration + 50);
    },

    playNextItem() {
      if (!state.playlist.isPlaying || state.playlist.items.length < 1) {
        if (state.playlist.items.length < 1) state.playlist.isPlaying = false;
        return;
      }
      if (state.playlist.advancingInProgress) return;
      state.playlist.advancingInProgress = true;
      this.clearPlaybackTimers();

      let nextIndex;
      const { items, currentIndex, shuffle, playedInShuffle } = state.playlist;

      if (items.length === 1) { // Only one item, just let it loop (or end)
        state.playlist.advancingInProgress = false;
        return;
      }

      if (shuffle) {
        let available = items.filter(id => !playedInShuffle.has(id));
        if (available.length === 0) {
          playedInShuffle.clear();
          available = items.filter(id => id !== items[currentIndex]); // Avoid playing the same track twice in a row
        }
        if (available.length === 0) { // If still empty (e.g. only 1 song in playlist)
          available = items;
        }
        const randomId = available[Math.floor(Math.random() * available.length)];
        nextIndex = items.indexOf(randomId);
      } else {
        nextIndex = (currentIndex + 1) % items.length;
      }

      const oldElement = state.dom.mediaContainer.firstChild;
      const transitionData = state.playlist.transitions[nextIndex];
      const newElement = this.playByIndex(nextIndex, !!transitionData);

      if (transitionData && oldElement && newElement) {
        this.applyTransition(oldElement, newElement, transitionData);
      }

      setTimeout(() => { state.playlist.advancingInProgress = false; }, 500);
    },

    clearPlaybackTimers() {
      if (state.playlist.playbackTimer) clearTimeout(state.playlist.playbackTimer);
      state.playlist.playbackTimer = null;
    },

    clearDisplay() {
      this.clearPlaybackTimers();
      const container = state.dom.mediaContainer;
      while (container.firstChild) {
        const el = container.firstChild;
        if (el.tagName === 'VIDEO') { el.pause(); el.src = ''; el.load(); }
        container.removeChild(el);
      }
    }
  };

  // --- HighlightManager Logic ---
  const HighlightManager = {
    updateActiveHighlight(mediaId, sourceType) {
      this.removeAllHighlights();
      if (!mediaId) {
        state.activeHighlight = { mediaId: null, sourceType: null };
        return;
      }
      state.activeHighlight = { mediaId, sourceType };
      let elementToHighlight;
      if (sourceType === 'library') {
        elementToHighlight = state.dom.mediaGallery?.querySelector(`.media-thumbnail[data-id="${mediaId}"]`);
      } else if (sourceType === 'playlist') {
        state.dom.playlistContainer?.querySelectorAll('.playlist-item').forEach(el => {
          if (el.dataset.id === mediaId && parseInt(el.dataset.index) === state.playlist.currentIndex) {
            elementToHighlight = el;
            el.classList.add('current');
            if(state.playlist.isPlaying) {
              // ** FIX: Safe way to add the indicator **
              const thumb = el.querySelector('.playlist-item-thumbnail');
              if (thumb && !thumb.querySelector('.playlist-item-playing-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'playlist-item-playing-indicator';
                indicator.innerHTML = '<span>▶</span>';
                thumb.appendChild(indicator);
              }
            }
          }
        });
      }
      if (elementToHighlight) elementToHighlight.classList.add('playing-from-here');
    },
    removeAllHighlights() {
      document.querySelectorAll('.playing-from-here').forEach(el => el.classList.remove('playing-from-here'));
      document.querySelectorAll('.playlist-item.current').forEach(el => el.classList.remove('current'));
      document.querySelectorAll('.playlist-item-playing-indicator').forEach(el => el.remove());
    }
  };

  // Public API for PlayerEngine
  return {
    init,
    selectMedia: MediaPlayer.selectMedia,
    playPlaylist: MediaPlayer.playPlaylist,
    pausePlaylist: MediaPlayer.pausePlaylist,
    stopPlaylist: MediaPlayer.stopPlaylist,
    playByIndex: MediaPlayer.playByIndex,
    applyEffectsToElement: MediaPlayer.applyEffectsToElement,
    HighlightManager,
  };
})();

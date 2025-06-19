/**
 * FL Studio Wallpaper App - Player Engine Module
 * Version 0.8.0 - 'this' Context Fix by Gemini
 *
 * FIX: Bound the 'this' context for all exported MediaPlayer methods
 * to resolve the "is not a function" error when calling internal helpers.
 */

const PlayerEngine = (() => {
  "use strict";

  let state = null;
  let PlaylistManager = null;

  const init = (managerState, managerPlaylistManager) => {
    console.log("[PlayerEngine] Initializing and linking state...");
    state = managerState;
    PlaylistManager = managerPlaylistManager;
  };

  const CONSTANTS = {
    IMAGE_DISPLAY_DURATION: 5000,
  };

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
        element.addEventListener('ended', () => { if (isPlaylistContext && !loopOverride) this.playNextItem(); });
      }

      if (element) {
        Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover' });
      }
      return element;
    },

    playPlaylist() {
      // Implementation for playing the whole playlist
    },

    pausePlaylist() {
      state.playlist.isPlaying = false;
      this.clearPlaybackTimers();
      const videoEl = state.dom.mediaContainer.querySelector('video');
      if (videoEl && !videoEl.paused) videoEl.pause();
      PlaylistManager.updateUI();
    },

    stopPlaylist(reset = true) {
      state.playlist.isPlaying = false;
      this.clearPlaybackTimers();
      if (reset) {
        state.playlist.currentIndex = -1;
        this.clearDisplay();
        HighlightManager.updateActiveHighlight(null);
      }
      PlaylistManager.updateUI();
    },

    playByIndex(index) {
      // Implementation for playing by index
    },

    playNextItem() {
      // Implementation for playing the next item
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

  const HighlightManager = {
    updateActiveHighlight(mediaId, sourceType) {
      // Implementation for highlighting
    },
    removeAllHighlights() {
      // Implementation for removing highlights
    }
  };

  // Public API for PlayerEngine
  return {
    init,
    // FIX: Bind 'this' to MediaPlayer for all exported functions
    selectMedia: MediaPlayer.selectMedia.bind(MediaPlayer),
    playPlaylist: MediaPlayer.playPlaylist.bind(MediaPlayer),
    pausePlaylist: MediaPlayer.pausePlaylist.bind(MediaPlayer),
    stopPlaylist: MediaPlayer.stopPlaylist.bind(MediaPlayer),
    playByIndex: MediaPlayer.playByIndex.bind(MediaPlayer),
    HighlightManager,
  };
})();
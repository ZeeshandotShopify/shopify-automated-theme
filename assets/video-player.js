// 1. Child Component: Play Button
if (!customElements.get("play-video")) {
  class PlayVideo extends HTMLElement {
    constructor() {
      super();
    }
  }
  customElements.define("play-video", PlayVideo);
}

// 2. Child Component: Pause Button
if (!customElements.get("pause-video")) {
  class PauseVideo extends HTMLElement {
    constructor() {
      super();
    }
  }
  customElements.define("pause-video", PauseVideo);
}

// 3. Parent Component: Video Player Logic
if (!customElements.get("video-player")) {
  class VideoPlayer extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      // Selector Requirement: Use data-target attributes instead of classes
      this.video = this.querySelector('[data-target="video-source"]');
      this.playBtn = this.querySelector("play-video");
      this.pauseBtn = this.querySelector("pause-video");

      if (!this.video) return;

      this.init();
    }

    init() {
      // Bind click events to custom control components
      if (this.playBtn)
        this.playBtn.addEventListener("click", (e) => this.play(e));
      if (this.pauseBtn)
        this.pauseBtn.addEventListener("click", (e) => this.pause(e));

      // Container click handling (optional: toggle on clicking the video itself)
      this.addEventListener("click", (e) => {
        // Ignore if clicked directly on a button (prevents double firing)
        if (e.target.closest("play-video") || e.target.closest("pause-video"))
          return;
        this.togglePlay();
      });

      // Double click for fullscreen
      this.addEventListener("dblclick", (e) => this.handleFullscreen(e));

      // Sync State Listeners
      this.video.addEventListener("play", () => this.updateUIState(true));
      this.video.addEventListener("pause", () => this.updateUIState(false));
      this.video.addEventListener("ended", () => this.updateUIState(false));

      // Initial check
      this.updateUIState(!this.video.paused);
    }

    play(e) {
      if (e) e.stopPropagation();
      this.video.play();
    }

    pause(e) {
      if (e) e.stopPropagation();
      this.video.pause();
    }

    togglePlay() {
      this.video.paused ? this.play() : this.pause();
    }

    updateUIState(isPlaying) {
      if (isPlaying) {
        this.setAttribute("data-state", "playing");
      } else {
        this.setAttribute("data-state", "paused");
      }
    }

    handleFullscreen(e) {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        if (this.requestFullscreen) this.requestFullscreen();
        else if (this.webkitRequestFullscreen) this.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }
  }
  customElements.define("video-player", VideoPlayer);
}

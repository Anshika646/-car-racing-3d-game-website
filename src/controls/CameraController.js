/**
 * CameraController.js
 *
 * Manages browser webcam permissions, secure-context validation, an uninterrupted
 * master <video> decoder element for MediaPipe inference, UI preview binding,
 * and deterministic MediaStreamTrack cleanup on exit.
 * Never uploads or transmits frames externally.
 */

export class CameraController {
  constructor() {
    this.stream = null;
    this.masterVideo = null;
    this.activeVideoElements = new Set();
    this.isActive = false;

    this._handlePageUnload = () => {
      this.stopCamera();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this._handlePageUnload);
      window.addEventListener('beforeunload', this._handlePageUnload);
    }
  }

  /**
   * Ensures a persistent, never-display-none <video> element exists so browser
   * hardware frame decoding never pauses when UI modals switch or PiP is minimized.
   */
  _ensureMasterVideo() {
    if (this.masterVideo || typeof document === 'undefined' || !document.body) {
      return this.masterVideo;
    }
    const v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.setAttribute('autoplay', '');
    v.setAttribute('muted', '');
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    // Keep 2x2px with non-zero opacity & off-pointer so Chromium/Safari keep decoding at full FPS
    v.style.position = 'fixed';
    v.style.left = '0px';
    v.style.bottom = '0px';
    v.style.width = '2px';
    v.style.height = '2px';
    v.style.opacity = '0.01';
    v.style.pointerEvents = 'none';
    v.style.zIndex = '-1';
    v.setAttribute('aria-hidden', 'true');
    document.body.appendChild(v);
    this.masterVideo = v;
    return v;
  }

  /**
   * Returns the best active <video> element with live decoded frames for MediaPipe.
   */
  getDetectionVideo(fallbackVideo = null) {
    if (
      this.masterVideo &&
      this.masterVideo.readyState >= 2 &&
      this.masterVideo.videoWidth > 0
    ) {
      return this.masterVideo;
    }
    if (fallbackVideo && fallbackVideo.readyState >= 2 && fallbackVideo.videoWidth > 0) {
      return fallbackVideo;
    }
    for (const v of this.activeVideoElements) {
      if (v && v.readyState >= 2 && v.videoWidth > 0) {
        return v;
      }
    }
    return this.masterVideo || fallbackVideo || null;
  }

  /**
   * Checks whether webcam APIs are supported in the current browsing context.
   */
  checkAvailability() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        supported: false,
        code: 'NO_BROWSER',
        message: 'Webcam access requires a browser environment.',
      };
    }

    if (window.isSecureContext === false) {
      return {
        supported: false,
        code: 'INSECURE_CONTEXT',
        message:
          'Camera access requires a secure context (HTTPS in production or http://localhost during local development).',
      };
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return {
        supported: false,
        code: 'NO_MEDIA_DEVICES',
        message:
          'Your browser does not expose navigator.mediaDevices.getUserMedia. Try Chrome, Edge, or Safari over HTTPS/localhost.',
      };
    }

    return { supported: true, code: 'OK', message: 'Ready' };
  }

  /**
   * Requests webcam access ONLY when explicitly invoked by a player action.
   */
  async requestCamera(videoElements = []) {
    const check = this.checkAvailability();
    if (!check.supported) {
      const err = new Error(check.message);
      err.code = check.code;
      throw err;
    }

    const master = this._ensureMasterVideo();
    const allTargets = master ? [master, ...videoElements] : [...videoElements];

    // Reuse active stream if tracks are still live
    if (this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live')) {
      await this.attachToVideos(allTargets);
      await this._waitForVideoReady(master);
      this.isActive = true;
      return this.stream;
    }

    this.stopCamera();
    const freshMaster = this._ensureMasterVideo();
    const targets = freshMaster ? [freshMaster, ...videoElements] : [...videoElements];

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });
      } catch (firstErr) {
        // If permission was explicitly denied, do not retry; otherwise fallback to unconstrained video
        const errName = firstErr?.name || '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          throw firstErr;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      this.stream = stream;
      this.isActive = true;
      await this.attachToVideos(targets);
      await this._waitForVideoReady(freshMaster);
      return stream;
    } catch (rawError) {
      this.stopCamera();
      throw this._normalizeError(rawError);
    }
  }

  /**
   * Waits briefly (up to 900ms) for actual decoded video dimensions in real browsers,
   * while resolving immediately in headless/mocked test environments.
   */
  async _waitForVideoReady(videoEl) {
    if (!videoEl || typeof videoEl.addEventListener !== 'function') return;
    if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) return;

    // In JSDOM unit tests, srcObject streams do not emit loadeddata — avoid delaying tests
    const isJsDom =
      typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
    if (isJsDom) return;

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearInterval(pollId);
        clearTimeout(timeoutId);
        videoEl.removeEventListener('loadeddata', finish);
        videoEl.removeEventListener('playing', finish);
        resolve();
      };
      videoEl.addEventListener('loadeddata', finish, { once: true });
      videoEl.addEventListener('playing', finish, { once: true });
      const pollId = setInterval(() => {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          finish();
        } else {
          const p = videoEl.play?.();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      }, 60);
      const timeoutId = setTimeout(finish, 900);
    });
  }

  /**
   * Attaches the live MediaStream to one or more <video> preview elements.
   */
  async attachToVideos(videoElements = []) {
    if (!this.stream) return;
    const playPromises = [];

    if (this.masterVideo && !videoElements.includes(this.masterVideo)) {
      videoElements = [this.masterVideo, ...videoElements];
    }

    for (const video of videoElements) {
      if (!video) continue;
      this.activeVideoElements.add(video);
      if (video.srcObject !== this.stream) {
        video.srcObject = this.stream;
      }
      video.muted = true;
      video.playsInline = true;
      const p = video.play?.();
      if (p && typeof p.catch === 'function') {
        playPromises.push(p.catch(() => {}));
      }
    }

    await Promise.all(playPromises);
  }

  /**
   * Stops every MediaStreamTrack immediately and detaches video elements.
   */
  stopCamera() {
    if (this.stream) {
      const tracks = this.stream.getTracks ? this.stream.getTracks() : [];
      for (const track of tracks) {
        try {
          track.stop();
        } catch {
          // Ignore already stopped track
        }
      }
      this.stream = null;
    }

    for (const video of this.activeVideoElements) {
      try {
        video.pause?.();
        video.srcObject = null;
      } catch {
        // Ignore DOM cleanup errors
      }
    }
    this.activeVideoElements.clear();

    if (this.masterVideo) {
      try {
        this.masterVideo.pause?.();
        this.masterVideo.srcObject = null;
        this.masterVideo.remove?.();
      } catch {
        // Ignore
      }
      this.masterVideo = null;
    }

    this.isActive = false;
  }

  _normalizeError(err) {
    const name = err?.name || '';
    let title = 'Webcam Access Failed';
    let detail =
      'Could not open your camera. You can still play immediately with Touch or Keyboard Controls.';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      title = 'Camera Permission Denied';
      detail =
        'Webcam permission was declined. Allow camera access in your browser address bar and try again, or choose Touch / Keyboard.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      title = 'No Webcam Detected';
      detail =
        'No camera device was found on this device. Connect a webcam or switch to Touch / Keyboard Controls.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      title = 'Camera Currently in Use';
      detail =
        'Another app or browser tab is using your camera. Close other camera apps and retry, or play with Touch / Keyboard.';
    } else if (err?.message) {
      detail = err.message;
    }

    const formatted = new Error(detail);
    formatted.title = title;
    formatted.originalName = name;
    return formatted;
  }

  dispose() {
    this.stopCamera();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this._handlePageUnload);
      window.removeEventListener('beforeunload', this._handlePageUnload);
    }
  }
}

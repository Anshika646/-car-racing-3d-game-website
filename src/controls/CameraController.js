/**
 * CameraController.js
 *
 * Manages browser webcam permissions, secure-context validation, local video stream
 * binding, and deterministic MediaStreamTrack cleanup on exit.
 * Never uploads or transmits frames externally.
 */

export class CameraController {
  constructor() {
    this.stream = null;
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
          'Your browser does not expose navigator.mediaDevices.getUserMedia. Try Chrome, Edge, or Firefox over HTTPS/localhost.',
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

    // Reuse active stream if tracks are still live
    if (this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live')) {
      await this.attachToVideos(videoElements);
      this.isActive = true;
      return this.stream;
    }

    this.stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });

      this.stream = stream;
      this.isActive = true;
      await this.attachToVideos(videoElements);
      return stream;
    } catch (rawError) {
      this.stopCamera();
      throw this._normalizeError(rawError);
    }
  }

  /**
   * Attaches the live MediaStream to one or more <video> preview elements.
   */
  async attachToVideos(videoElements = []) {
    if (!this.stream) return;
    const playPromises = [];

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
    this.isActive = false;
  }

  _normalizeError(err) {
    const name = err?.name || '';
    let title = 'Webcam Access Failed';
    let detail =
      'Could not open your camera. You can still play immediately with Keyboard Controls.';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      title = 'Camera Permission Denied';
      detail =
        'Webcam permission was declined. Allow camera access in your browser address bar and try again, or choose Play with Keyboard.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      title = 'No Webcam Detected';
      detail =
        'No camera device was found on this computer. Connect a webcam or switch to Keyboard Controls.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      title = 'Camera Currently in Use';
      detail =
        'Another application or browser tab is using your webcam. Close other camera apps and retry, or play with Keyboard.';
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

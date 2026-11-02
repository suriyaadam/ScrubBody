export function initHeroVideo(config, product, root = document) {
  const container = root.querySelector('.hero-art');
  const wrapper = root.querySelector('#hero-sequence');
  const source = typeof config?.videoSrc === 'string' ? config.videoSrc.trim() : '';
  if (!source || !container || !wrapper) return null;

  const initialChildren = [...container.childNodes];
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 767px)');
  const label = config.label || 'Présentation du gommage corporel ZÉMAYA';
  const posterSource = config.poster || (product?.imageReady ? product.image : null);
  let disposeMode = () => {};
  let destroyed = false;
  wrapper.classList.add('has-hero-media');

  function clearSequenceState(mode) {
    wrapper.classList.remove('is-scroll-sequence');
    wrapper.dataset.sequenceMode = mode;
    wrapper.dataset.scrollProgress = '0';
    container.classList.remove('has-hero-video', 'has-scroll-canvas');
    delete container.dataset.currentFrame;
  }

  function showPoster(src = posterSource, mode = 'poster') {
    clearSequenceState(mode);
    if (!src) {
      container.replaceChildren(...initialChildren);
      return;
    }
    const image = new Image();
    image.alt = 'Gommage corporel ZÉMAYA présenté dans la vidéo';
    image.loading = 'eager';
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.addEventListener('error', () => {
      if (product?.imageReady && image.src !== new URL(product.image, document.baseURI).href) {
        image.src = product.image;
      }
    }, { once: true });
    container.replaceChildren(image);
    container.classList.add('has-product-image');
    image.src = src;
  }

  function showNativeVideo() {
    clearSequenceState('video');
    const video = document.createElement('video');
    video.controls = true;
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', 'Vidéo du gommage corporel ZÉMAYA');
    if (posterSource) video.poster = posterSource;
    video.addEventListener('error', () => {
      if (!destroyed && container.contains(video)) showPoster();
    }, { once: true });
    container.replaceChildren(video);
    container.classList.add('has-hero-video');
    video.src = source;
    disposeMode = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }

  function startSequence() {
    showPoster();
    const canvas = document.createElement('canvas');
    let context;
    try { context = canvas.getContext('2d', { alpha: false }); } catch { context = null; }
    const frameCount = Number(config.frameCount);
    const variant = mobileQuery.matches ? 'mobile' : 'desktop';
    const pattern = variant === 'mobile' ? config.mobileFramePattern : config.framePattern;
    const embedded = config.embeddedFrames?.[variant];
    if (!context || !Number.isInteger(frameCount) || frameCount < 2 ||
        (!Array.isArray(embedded) && (typeof pattern !== 'string' || !pattern.includes('{index}')))) {
      showNativeVideo();
      return;
    }

    const cacheLimit = variant === 'mobile' ? 24 : 36;
    const radius = variant === 'mobile' ? 10 : 16;
    const concurrency = 4;
    const cache = new Map();
    const inFlight = new Map();
    const failed = new Set();
    let queue = [];
    let desiredFrame = 0;
    let lastRequested = 0;
    let direction = 1;
    let displayedFrame = -1;
    let firstFrameReady = false;
    let disposed = false;
    let animationFrame = 0;
    let sceneTop = 0;
    let scrollDistance = 1;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
    wrapper.classList.add('is-scroll-sequence');
    wrapper.dataset.sequenceMode = 'scroll';

    function release(image) {
      if (typeof image.close === 'function') image.close();
    }

    function trimCache() {
      for (const [index, image] of cache) {
        if (cache.size <= cacheLimit) break;
        if (index === desiredFrame || (!firstFrameReady && index === 0)) continue;
        cache.delete(index);
        release(image);
      }
    }

    function measure() {
      sceneTop = wrapper.getBoundingClientRect().top + window.scrollY;
      const scene = wrapper.querySelector('.hero');
      scrollDistance = Math.max(1, wrapper.offsetHeight - scene.offsetHeight);
    }

    function frameSource(index) {
      if (Array.isArray(embedded) && embedded[index]) return embedded[index];
      return pattern.replace('{index}', String(index + 1).padStart(config.frameDigits || 3, '0'));
    }

    async function decodeFrame(index, signal) {
      const response = await fetch(frameSource(index), { signal });
      if (!response.ok) throw new Error('Image de la séquence indisponible');
      const blob = await response.blob();
      if (signal.aborted) throw new DOMException('Chargement interrompu', 'AbortError');
      if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
      const objectUrl = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }

    function draw(index) {
      const image = cache.get(index);
      if (!image || disposed) return false;
      if (displayedFrame === index) return true;
      const width = image.width || image.naturalWidth;
      const height = image.height || image.naturalHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.drawImage(image, 0, 0, width, height);
      if (!container.contains(canvas)) {
        container.replaceChildren(canvas);
        container.classList.add('has-scroll-canvas');
      }
      displayedFrame = index;
      container.dataset.currentFrame = String(index + 1);
      cache.delete(index);
      cache.set(index, image);
      return true;
    }

    function schedule() {
      if (!disposed && !animationFrame && !document.hidden) {
        animationFrame = requestAnimationFrame(render);
      }
    }

    function fillQueue() {
      const order = firstFrameReady ? [desiredFrame] : [0, desiredFrame];
      for (let offset = 1; offset <= radius; offset++) {
        order.push(desiredFrame + direction * offset, desiredFrame - direction * offset);
      }
      queue = order.filter(index => index >= 0 && index < frameCount &&
        !cache.has(index) && !inFlight.has(index) && !failed.has(index));
      for (const [index, controller] of inFlight) {
        if (Math.abs(index - desiredFrame) > radius && (firstFrameReady || index !== 0)) {
          controller.abort();
        }
      }
      pump();
    }

    function pump() {
      if (disposed || document.hidden) return;
      while (queue.length && inFlight.size < concurrency) {
        const index = queue.shift();
        if (cache.has(index) || inFlight.has(index) || failed.has(index)) continue;
        const controller = new AbortController();
        inFlight.set(index, controller);
        decodeFrame(index, controller.signal).then(image => {
          if (disposed || controller.signal.aborted) {
            release(image);
            return;
          }
          cache.set(index, image);
          if (!firstFrameReady && index === 0) {
            firstFrameReady = true;
            draw(0);
          }
          trimCache();
          if (index === desiredFrame || index === 0) schedule();
        }).catch(error => {
          if (disposed || controller.signal.aborted || error.name === 'AbortError') return;
          failed.add(index);
          if (!firstFrameReady && index === 0) {
            dispose();
            showNativeVideo();
          }
        }).finally(() => {
          if (inFlight.get(index) === controller) inFlight.delete(index);
          if (!disposed && controller.signal.aborted) schedule();
          pump();
        });
      }
    }

    function render() {
      animationFrame = 0;
      if (disposed) return;
      const rawProgress = Math.min(1, Math.max(0, (window.scrollY - sceneTop) / scrollDistance));
      // Les derniers 8 % de la zone épinglée conservent le produit final.
      const progress = Math.min(1, rawProgress / 0.92);
      wrapper.dataset.scrollProgress = progress.toFixed(4);
      wrapper.dataset.sceneProgress = rawProgress.toFixed(4);
      desiredFrame = Math.round(progress * (frameCount - 1));
      if (desiredFrame !== lastRequested) direction = desiredFrame > lastRequested ? 1 : -1;
      lastRequested = desiredFrame;
      if (firstFrameReady) draw(desiredFrame);
      fillQueue();
    }

    function resize() {
      measure();
      schedule();
    }

    function visibilityChange() {
      if (document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        for (const controller of inFlight.values()) controller.abort();
      } else schedule();
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      for (const controller of inFlight.values()) controller.abort();
      for (const image of cache.values()) release(image);
      cache.clear();
      queue = [];
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibilityChange);
      wrapper.classList.remove('is-scroll-sequence');
    }

    disposeMode = dispose;
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', visibilityChange);
    fillQueue();
    schedule();
  }

  function changeMode() {
    disposeMode();
    if (destroyed) return;
    if (motionQuery.matches) {
      showPoster(config.reducedMotionPoster || posterSource, 'reduced-motion');
      disposeMode = () => {};
    } else startSequence();
  }

  motionQuery.addEventListener('change', changeMode);
  mobileQuery.addEventListener('change', changeMode);
  changeMode();
  return {
    element: container,
    destroy() {
      destroyed = true;
      disposeMode();
      motionQuery.removeEventListener('change', changeMode);
      mobileQuery.removeEventListener('change', changeMode);
      showPoster();
    }
  };
}

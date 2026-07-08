import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Rasterizes our SVG silhouette to a PNG data URL so Photopea has an
// unambiguous format to open — broadest compatibility of anything it accepts.
function rasterizeSvgToPng(svgMarkup, width, height) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Embeds Photopea (photopea.com) as the canvas editor. Communication happens
// over postMessage: Photopea accepts either a raw file ArrayBuffer (opens it
// directly) or a string of script code to eval in its own scripting context
// (Photoshop-like: app.open(url), app.activeDocument, etc). Sending
// `app.activeDocument.saveToOE('png')` makes it render the flattened doc and
// post the PNG bytes back to us as an ArrayBuffer — that's the capture path.
const PhotopeaEditor = forwardRef(function PhotopeaEditor({ svgMarkup, file, onStatusChange }, ref) {
  const iframeRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const pendingCapture = useRef(null);

  useEffect(() => { onStatusChange?.(status); }, [status]); // eslint-disable-line

  useEffect(() => {
    function handleMessage(e) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data instanceof ArrayBuffer && pendingCapture.current) {
        const blob = new Blob([e.data], { type: 'image/png' });
        pendingCapture.current.resolve(URL.createObjectURL(blob));
        pendingCapture.current = null;
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useImperativeHandle(ref, () => ({
    capture: () => new Promise((resolve, reject) => {
      const win = iframeRef.current?.contentWindow;
      if (!win || status !== 'ready') { reject(new Error('Canvas is not ready yet')); return; }
      pendingCapture.current = { resolve, reject };
      win.postMessage("app.activeDocument.saveToOE('png');", '*');
      setTimeout(() => {
        if (pendingCapture.current) {
          pendingCapture.current.reject(new Error('Capture timed out'));
          pendingCapture.current = null;
        }
      }, 8000);
    }),
  }));

  const handleLoad = async () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    // Photopea's own app needs a beat to boot after the iframe document loads.
    await new Promise(r => setTimeout(r, 2200));
    try {
      if (file) {
        const buf = await file.arrayBuffer();
        win.postMessage(buf, '*');
      } else if (svgMarkup) {
        const png = await rasterizeSvgToPng(svgMarkup, 900, 1080);
        win.postMessage(`app.open("${png}")`, '*');
      }
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  return (
    <iframe
      ref={iframeRef}
      title="Photopea design canvas"
      src="https://www.photopea.com#"
      onLoad={handleLoad}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      allow="clipboard-read; clipboard-write"
    />
  );
});

export default PhotopeaEditor;

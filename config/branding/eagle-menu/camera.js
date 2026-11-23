// EAGLE-OS camera test
  const video = document.getElementById("video"), cams = document.getElementById("cams"),
        status = document.getElementById("status"), level = document.getElementById("level");
  let stream, audioCtx;

  async function listCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const list = devices.filter(d => d.kind === "videoinput");
    cams.innerHTML = "";
    list.forEach((d, i) => cams.add(new Option(d.label || `Camera ${i + 1}`, d.deviceId)));
    return list.length;
  }

  async function start() {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const id = cams.value;
      stream = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id } } : true, audio: true });
      video.srcObject = stream;
      const n = await listCameras();
      const track = stream.getVideoTracks()[0];
      if (track) cams.value = track.getSettings().deviceId || cams.value;
      const s = track ? track.getSettings() : {};
      status.textContent = `Camera working: ${track ? track.label : "?"} (${s.width || "?"}×${s.height || "?"}). ${n > 1 ? "Pick another camera above to switch." : ""}`;
      meter();
    } catch (e) {
      const msg = { NotFoundError: "No camera was found. Plug in a USB webcam and try again.",
                    NotAllowedError: "Camera access was blocked. Press the camera icon in the address bar to allow it.",
                    NotReadableError: "The camera is busy or not supported. Unplug it, plug it back in and try again." }[e.name];
      status.textContent = msg || `Camera problem: ${e.message}`;
    }
  }

  function meter() {
    if (!stream.getAudioTracks().length) return;
    if (audioCtx) audioCtx.close();
    audioCtx = new AudioContext();
    const an = audioCtx.createAnalyser(); an.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    (function tick() {
      an.getByteTimeDomainData(buf);
      let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      level.style.width = Math.min(100, peak * 1.6) + "%";
      requestAnimationFrame(tick);
    })();
  }

  document.getElementById("start").onclick = start;
  cams.onchange = start;
  listCameras();

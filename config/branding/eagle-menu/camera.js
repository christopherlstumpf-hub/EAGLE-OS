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
      if (e.name === "NotFoundError") macCamera();
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

  // Mac FaceTime HD camera: its driver needs a file from Apple, downloaded once the Mac is online.
  const MAC_MSG = {
    starting: "Getting the Mac's FaceTime camera ready…",
    "waiting-online": "The Mac's FaceTime camera needs a file from Apple. Connect to Wi-Fi and it downloads by itself.",
    downloading: "Downloading the FaceTime camera file from Apple (about 18 MB)…",
    "failed-offline": "Couldn't reach Apple to set up the FaceTime camera. Check Wi-Fi, then press Try again.",
    "failed-download": "The FaceTime camera file didn't download. Press Try again.",
    "failed-driver": "The FaceTime camera file is in place, but the camera didn't start. Restart the Mac and try again.",
  };
  let macTimer = null;
  async function macCamera() {
    let st = null;
    try { st = await browser.runtime.sendNativeMessage("eagle", { action: "camera_status" }); } catch (e) { return; }
    if (!st || !st.facetime) return;
    const retry = document.getElementById("retry");
    if (st.videos > 0 && (st.firmware || st.state === "ready")) {
      retry.hidden = true;
      if (macTimer) { clearInterval(macTimer); macTimer = null; status.textContent = "FaceTime camera ready. Press Turn on camera."; }
      return;
    }
    status.textContent = MAC_MSG[st.state] || MAC_MSG.starting;
    retry.hidden = !String(st.state).startsWith("failed");
    if (!macTimer) macTimer = setInterval(macCamera, 5000);
  }
  document.getElementById("retry").onclick = async () => {
    try { await browser.runtime.sendNativeMessage("eagle", { action: "camera_retry" }); } catch (e) { /* ignore */ }
    status.textContent = MAC_MSG.starting;
    document.getElementById("retry").hidden = true;
    if (!macTimer) macTimer = setInterval(macCamera, 5000);
  };
  macCamera();

  document.getElementById("start").onclick = start;
  cams.onchange = start;
  listCameras();

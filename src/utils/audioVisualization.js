// Ses görselleştirme utility'si
// Waveform ve ses analizi için fonksiyonlar

/**
 * Ses dosyasından waveform verilerini çıkarır
 * @param {string} audioUrl - Ses dosyası URL'i
 * @param {number} samples - Kaç örnek alınacak (varsayılan: 100)
 * @returns {Promise<Array>} - Waveform verileri (0-1 arası değerler)
 */
export async function extractWaveform(audioUrl, samples = 100) {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const request = new XMLHttpRequest();

    request.open("GET", audioUrl, true);
    request.responseType = "arraybuffer";

    request.onload = async () => {
      try {
        const audioBuffer = await audioContext.decodeAudioData(request.response);
        const channelData = audioBuffer.getChannelData(0); // İlk kanalı al
        const blockSize = Math.floor(channelData.length / samples);
        const waveform = [];

        // Her blok için RMS (Root Mean Square) hesapla
        for (let i = 0; i < samples; i++) {
          let sumSquares = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channelData.length);

          for (let j = start; j < end; j++) {
            sumSquares += channelData[j] * channelData[j];
          }

          const rms = Math.sqrt(sumSquares / (end - start));
          waveform.push(rms);
        }

        await audioContext.close();
        resolve(waveform);
      } catch (error) {
        audioContext.close();
        reject(new Error("Waveform çıkarılamadı: " + error.message));
      }
    };

    request.onerror = () => {
      reject(new Error("Dosya yüklenemedi"));
    };

    request.send();
  });
}

/**
 * Canvas'a waveform çizer
 * @param {HTMLCanvasElement} canvas - Canvas elementi
 * @param {Array} waveform - Waveform verileri
 * @param {string} color - Çizgi rengi (varsayılan: #667eea)
 */
export function drawWaveform(canvas, waveform, color = "#667eea") {
  const ctx = canvas.getContext("2d");
  
  // Canvas'ın gerçek boyutunu al (CSS ile ölçeklenmiş olabilir)
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  
  // Canvas'ın internal resolution'ını ayarla (retina display için)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  
  const centerY = height / 2;

  // Canvas'ı temizle (scaled coordinates)
  ctx.clearRect(0, 0, width, height);

  // Arka plan şeffaf (overlay için)
  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, width, height);

  // Waveform çiz (daha ince ve şeffaf)
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.4; // Daha şeffaf (progress bar görünsün)
  ctx.beginPath();

  const step = width / waveform.length;

  for (let i = 0; i < waveform.length; i++) {
    const x = i * step;
    const amplitude = waveform[i] * centerY * 0.6; // %60 yükseklik (daha kompakt)

    if (i === 0) {
      ctx.moveTo(x, centerY - amplitude);
    } else {
      ctx.lineTo(x, centerY - amplitude);
    }
  }

  // Alt kısmı çiz
  for (let i = waveform.length - 1; i >= 0; i--) {
    const x = i * step;
    const amplitude = waveform[i] * centerY * 0.6;
    ctx.lineTo(x, centerY + amplitude);
  }

  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.15; // Çok şeffaf fill
  ctx.fill();
  ctx.globalAlpha = 0.4; // Stroke için biraz daha opak
  ctx.stroke();
  ctx.globalAlpha = 1; // Reset
}

/**
 * Canvas'a waveform progress bar çizer (oynatılan kısım vurgulanır)
 * @param {HTMLCanvasElement} canvas - Canvas elementi
 * @param {Array} waveform - Waveform verileri
 * @param {number} progress - Progress (0-1 arası)
 * @param {string} playedColor - Oynatılan kısım rengi (varsayılan: #667eea)
 * @param {string} unplayedColor - Oynatılmayan kısım rengi (varsayılan: #ccc)
 */
export function drawWaveformProgress(canvas, waveform, progress = 0, playedColor = "#667eea", unplayedColor = "#ccc") {
  const ctx = canvas.getContext("2d");
  
  // Canvas'ın gerçek boyutunu al
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  
  // Canvas'ın internal resolution'ını ayarla (retina display için)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  
  const centerY = height / 2;
  const progressX = width * Math.max(0, Math.min(1, progress));

  // Canvas'ı temizle
  ctx.clearRect(0, 0, width, height);

  // Arka plan (daha açık, waveform'un daha belirgin görünmesi için)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const step = width / waveform.length;
  const progressIndex = Math.floor((progressX / width) * waveform.length);

  // Önce tüm waveform'u çiz (oynatılmayan kısım - gri, daha belirgin)
  ctx.strokeStyle = unplayedColor;
  ctx.fillStyle = unplayedColor;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.7; // Daha belirgin
  ctx.beginPath();

  // Üst kısım
  for (let i = 0; i < waveform.length; i++) {
    const x = i * step;
    const amplitude = waveform[i] * centerY * 0.7;
    if (i === 0) {
      ctx.moveTo(x, centerY - amplitude);
    } else {
      ctx.lineTo(x, centerY - amplitude);
    }
  }

  // Alt kısım
  for (let i = waveform.length - 1; i >= 0; i--) {
    const x = i * step;
    const amplitude = waveform[i] * centerY * 0.7;
    ctx.lineTo(x, centerY + amplitude);
  }

  ctx.closePath();
  ctx.globalAlpha = 0.25; // Fill daha belirgin
  ctx.fill();
  ctx.globalAlpha = 0.7; // Stroke daha belirgin
  ctx.stroke();

  // Oynatılan kısım (mavi/mor) - progress'e kadar (progress > 0 ise)
  if (progress > 0) {
    ctx.strokeStyle = playedColor;
    ctx.fillStyle = playedColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 1;
    ctx.beginPath();

    // Üst kısım (oynatılan)
    for (let i = 0; i <= progressIndex && i < waveform.length; i++) {
      const x = i * step;
      const amplitude = waveform[i] * centerY * 0.7;
      if (i === 0) {
        ctx.moveTo(x, centerY - amplitude);
      } else {
        ctx.lineTo(x, centerY - amplitude);
      }
    }

    // Alt kısım (oynatılan)
    for (let i = Math.min(progressIndex, waveform.length - 1); i >= 0; i--) {
      const x = i * step;
      const amplitude = waveform[i] * centerY * 0.7;
      ctx.lineTo(x, centerY + amplitude);
    }

    ctx.closePath();
    ctx.globalAlpha = 0.6; // Fill daha belirgin
    ctx.fill();
    ctx.globalAlpha = 1; // Stroke tam opak
    ctx.stroke();
  }

  // Playhead çizgisi (beyaz dikey çizgi) - her zaman göster (progress 0 olsa bile)
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(progressX, 0);
  ctx.lineTo(progressX, height);
  ctx.stroke();

  // Playhead gölgesi (daha belirgin görünmesi için)
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(progressX - 1, 0);
  ctx.lineTo(progressX - 1, height);
  ctx.stroke();

  // Playhead'in üstünde ve altında küçük noktalar (daha belirgin)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(progressX, 5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(progressX, height - 5, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1; // Reset
}

// AudioContext ve source cache'i (her audio element için bir kez oluşturulmalı)
const audioContextCache = new WeakMap();
const sourceCache = new WeakMap();

/**
 * Gerçek zamanlı ses seviyesi analizi için AnalyserNode oluşturur
 * @param {HTMLAudioElement} audioElement - Audio elementi
 * @param {Function} onUpdate - Güncelleme callback'i (data: Uint8Array)
 * @returns {Function} - Analizi durdurma fonksiyonu
 */
export function createRealtimeAnalyzer(audioElement, onUpdate) {
  try {
    // Cache'den kontrol et - eğer daha önce oluşturulmuşsa tekrar oluşturma
    let audioContext = audioContextCache.get(audioElement);
    let source = sourceCache.get(audioElement);
    let analyser;

    if (!audioContext) {
      // Yeni AudioContext oluştur
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextCache.set(audioElement, audioContext);

      // AudioContext suspended durumundaysa resume et
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => {
          console.warn("AudioContext resume hatası:", err);
        });
      }

      // MediaElementSource oluştur (sadece bir kez)
      try {
        source = audioContext.createMediaElementSource(audioElement);
        sourceCache.set(audioElement, source);
      } catch (error) {
        console.error("MediaElementSource oluşturma hatası:", error);
        // Hata durumunda null döndür, ses çıkışı korunur
        return () => {};
      }
    } else {
      // Mevcut context'i kullan
      source = sourceCache.get(audioElement);
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => {
          console.warn("AudioContext resume hatası:", err);
        });
      }
    }

    // Analyser oluştur
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // Bağlantıları yap
    if (source) {
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    } else {
      // Source yoksa sadece analyser'ı bağla (ses çıkışı korunur)
      analyser.connect(audioContext.destination);
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId = null;
    let isRunning = true;

    const update = () => {
      if (!isRunning) return;
      
      try {
        analyser.getByteFrequencyData(dataArray);
        onUpdate(dataArray);
        animationFrameId = requestAnimationFrame(update);
      } catch (error) {
        console.error("Analiz güncelleme hatası:", error);
        isRunning = false;
      }
    };

    update();

    // Durdurma fonksiyonu
    return () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      // Analyser'ı disconnect et ama AudioContext'i ve source'u cache'de tut
      try {
        analyser.disconnect();
      } catch (error) {
        console.error("Analyser disconnect hatası:", error);
      }
    };
  } catch (error) {
    console.error("Realtime analyzer oluşturma hatası:", error);
    // Hata durumunda boş bir cleanup fonksiyonu döndür
    return () => {};
  }
}

/**
 * Ses seviyesi verilerinden ortalama seviyeyi hesaplar
 * @param {Uint8Array} dataArray - AnalyserNode'dan gelen veri
 * @returns {number} - Ortalama seviye (0-100)
 */
export function calculateAverageLevel(dataArray) {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  return sum / dataArray.length;
}

// Ses dosyası metadata çıkarma utility'si
// AI model eğitimi için ses dosyalarının teknik bilgilerini çıkarır

/**
 * Ses dosyasından metadata bilgilerini çıkarır
 * @param {File} audioFile - Analiz edilecek ses dosyası (.wav veya .mp3)
 * @returns {Promise<Object>} - Metadata bilgileri (duration, sample_rate, channels, audio_level)
 */
export async function extractAudioMetadata(audioFile) {
  return new Promise((resolve, reject) => {
    // FileReader ile dosyayı oku
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        // AudioContext oluştur
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();

        // Ses dosyasını decode et (hem .mp3 hem .wav için çalışır)
        const audioBuffer = await audioContext.decodeAudioData(e.target.result);

        // Metadata bilgilerini çıkar
        const metadata = {
          duration: audioBuffer.duration, // Süre (saniye)
          sample_rate: audioBuffer.sampleRate, // Sample rate (Hz)
          channels: audioBuffer.numberOfChannels, // Kanal sayısı (1 = mono, 2 = stereo)
          audio_level: calculateAudioLevel(audioBuffer), // Ortalama ses seviyesi (dB)
        };

        // AudioContext'i kapat (bellek tasarrufu)
        await audioContext.close();

        resolve(metadata);
      } catch (error) {
        reject(
          new Error("Ses dosyası analiz edilemedi: " + error.message)
        );
      }
    };

    reader.onerror = (error) => {
      reject(new Error("Dosya okunamadı: " + error.message));
    };

    // Dosyayı ArrayBuffer olarak oku
    reader.readAsArrayBuffer(audioFile);
  });
}

/**
 * AudioBuffer'dan ortalama ses seviyesini hesaplar (dB cinsinden)
 * @param {AudioBuffer} audioBuffer - Analiz edilecek AudioBuffer
 * @returns {number} - Ortalama ses seviyesi (dB, -60 ile 0 arası)
 */
function calculateAudioLevel(audioBuffer) {
  // Tüm kanalları birleştir ve RMS (Root Mean Square) hesapla
  let sumSquares = 0;
  let sampleCount = 0;

  // Her kanal için
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    
    // Her sample'ın karesini al ve topla
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
      sampleCount++;
    }
  }

  // RMS hesapla
  const rms = Math.sqrt(sumSquares / sampleCount);

  // dB'e çevir (0 = maksimum, -60 = çok düşük)
  // RMS değeri 0-1 arası olduğu için logaritmik dönüşüm yapıyoruz
  const db = rms > 0 ? 20 * Math.log10(rms) : -60;

  // -60 ile 0 arasında sınırla
  return Math.max(-60, Math.min(0, db));
}

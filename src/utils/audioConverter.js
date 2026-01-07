// Ses dosyası format çevirme utility'si
// .mp3 dosyalarını .wav formatına çevirir

/**
 * MP3 dosyasını WAV formatına çevirir
 * @param {File} mp3File - Çevrilecek MP3 dosyası
 * @returns {Promise<File>} - WAV formatında dosya
 */
export async function convertMp3ToWav(mp3File) {
  return new Promise((resolve, reject) => {
    // FileReader ile dosyayı oku
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        // AudioContext oluştur
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();

        // MP3 dosyasını decode et
        const audioBuffer = await audioContext.decodeAudioData(e.target.result);

        // AudioBuffer'ı WAV formatına çevir
        const wavBlob = audioBufferToWav(audioBuffer);

        // WAV dosyası oluştur
        const wavFileName = mp3File.name.replace(/\.mp3$/i, ".wav");
        const wavFile = new File([wavBlob], wavFileName, {
          type: "audio/wav",
        });

        resolve(wavFile);
      } catch (error) {
        reject(new Error("MP3 dosyası çevrilemedi: " + error.message));
      }
    };

    reader.onerror = (error) => {
      reject(new Error("Dosya okunamadı: " + error.message));
    };

    // Dosyayı ArrayBuffer olarak oku
    reader.readAsArrayBuffer(mp3File);
  });
}

/**
 * AudioBuffer'ı WAV Blob'una çevirir
 * @param {AudioBuffer} audioBuffer - Çevrilecek AudioBuffer
 * @returns {Blob} - WAV formatında Blob
 */
function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM format
  const bitDepth = 16; // 16-bit

  const length = audioBuffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(arrayBuffer);

  // WAV header yaz
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true); // number of channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, bitDepth, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, length * numChannels * 2, true); // data chunk size

  // Audio data yaz
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, audioBuffer.getChannelData(channel)[i])
      );
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

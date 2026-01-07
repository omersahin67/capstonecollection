// Dosya yükleme component'i
// Kullanıcıların ses dosyalarını yüklemesini sağlar

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import { convertMp3ToWav } from "../utils/audioConverter";
import { extractAudioMetadata } from "../utils/audioMetadata";
import "./FileUpload.css";

function FileUpload({ onUploadSuccess }) {
  const { t } = useLanguage();
  // Takım üyeleri listesi
  const teamMembers = ["Ömer", "Hüseyin", "Hossein", "Celina", "Faruk"];

  // Duygu seçenekleri
  const emotions = ["Mutlu", "Üzgün", "Kızgın", "Korkulu", "Şaşkın", "Nötr"];

  // Form state'leri
  const [file, setFile] = useState(null); // Seçilen dosya
  const [uploadedBy, setUploadedBy] = useState(""); // Yükleyen kişi adı (dropdown'dan seçilecek)
  const [emotion, setEmotion] = useState(""); // Duygu (dropdown'dan seçilecek)
  const [description, setDescription] = useState(""); // Açıklama (opsiyonel)
  const [loading, setLoading] = useState(false); // Yükleme durumu
  const [error, setError] = useState(""); // Hata mesajı
  const [success, setSuccess] = useState(""); // Başarı mesajı

  // Dosya seçildiğinde
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Dosya formatı kontrolü (.mp3 veya .wav)
    const fileName = selectedFile.name.toLowerCase();
    const isValidFormat =
      fileName.endsWith(".mp3") || fileName.endsWith(".wav");

    if (!isValidFormat) {
      setError(t("fileUpload.fileFormatError"));
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  // Dosya yükleme fonksiyonu
  const handleUpload = async (e) => {
    if (e) {
      e.preventDefault(); // Form submit'i engelle
    }
    setLoading(true);
    setError("");
    setSuccess("");

    // Validasyon
    if (!file) {
      setError(t("fileUpload.fileRequired"));
      setLoading(false);
      return;
    }

    if (!uploadedBy.trim()) {
      setError(t("fileUpload.uploaderRequired"));
      setLoading(false);
      return;
    }

    try {
      // 1. Dosyayı .wav formatına çevir (eğer .mp3 ise)
      let finalFile = file;
      let isConverted = false;
      let originalFormat = file.name.toLowerCase().endsWith(".wav")
        ? "wav"
        : "mp3";

      if (originalFormat === "mp3") {
        // .mp3 → .wav çevirme
        setSuccess(t("fileUpload.converting"));
        try {
          finalFile = await convertMp3ToWav(file);
          isConverted = true;
          setSuccess(""); // Çevirme mesajını temizle, yükleme mesajı gösterilecek
        } catch (conversionError) {
          console.error("Çevirme hatası:", conversionError);
          throw new Error(
            t("fileUpload.converting") + ": " + conversionError.message
          );
        }
      }

      // 1.5. Ses metadata'sını çıkar (AI model eğitimi için)
      setSuccess(t("fileUpload.analyzing"));
      let audioMetadata = null;
      try {
        // Metadata'yı orijinal dosyadan çıkar (çevrilmiş dosyadan değil, çünkü orijinal bilgileri korumak istiyoruz)
        audioMetadata = await extractAudioMetadata(finalFile);
        console.log("Ses metadata:", audioMetadata);
      } catch (metadataError) {
        console.warn("Metadata çıkarılamadı:", metadataError);
        // Metadata çıkarılamazsa devam et (kritik değil)
      }

      // 2. Storage'a yükle
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/\.[^/.]+$/, "")}.wav`;
      const filePath = `audio-files/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("audio-files")
        .upload(filePath, finalFile, {
          contentType: "audio/wav",
          upsert: false, // Aynı dosya varsa hata ver
        });

      if (uploadError) throw uploadError;

      // 3. Veritabanına kaydet (metadata bilgileriyle birlikte)
      const { data: dbData, error: dbError } = await supabase
        .from("audio_files")
        .insert({
          filename: fileName,
          original_filename: file.name,
          file_path: filePath,
          file_size: finalFile.size,
          original_file_size: file.size,
          mime_type: "audio/wav",
          original_format: originalFormat,
          is_converted: isConverted,
          uploaded_by: uploadedBy.trim(),
          emotion: emotion || null, // Duygu bilgisi
          description: description.trim() || null,
          current_version: 1,
          // Metadata bilgileri (AI model eğitimi için)
          duration: audioMetadata?.duration || null,
          sample_rate: audioMetadata?.sample_rate || null,
          channels: audioMetadata?.channels || null,
          audio_level: audioMetadata?.audio_level || null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 4. Versiyon kaydı oluştur (metadata bilgileriyle birlikte)
      const { error: versionError } = await supabase
        .from("audio_versions")
        .insert({
          audio_file_id: dbData.id,
          version_number: 1,
          file_path: filePath,
          file_size: finalFile.size,
          original_format: originalFormat,
          is_converted: isConverted,
          uploaded_by: uploadedBy.trim(),
          notes: description.trim() || null,
          // Metadata bilgileri (versiyon geçmişi için)
          duration: audioMetadata?.duration || null,
          sample_rate: audioMetadata?.sample_rate || null,
          channels: audioMetadata?.channels || null,
          audio_level: audioMetadata?.audio_level || null,
        });

      if (versionError) throw versionError;

      // Başarılı!
      const successMessage = isConverted
        ? `Dosya başarıyla WAV formatına çevrildi ve yüklendi: ${file.name}`
        : `Dosya başarıyla yüklendi: ${file.name}`;
      setSuccess(successMessage);
      
      // Formu temizle
      setFile(null);
      setUploadedBy("");
      setEmotion("");
      setDescription("");
      document.getElementById("file-input").value = ""; // Input'u temizle

      // Ana sayfayı güncelle
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error("Yükleme hatası:", error);
          setError(error.message || t("fileUpload.uploadError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="file-upload-container">
      <h2>{t("fileUpload.title")}</h2>

      {/* Hata mesajı */}
      {error && <div className="error-message">{error}</div>}

      {/* Başarı mesajı */}
      {success && <div className="success-message">{success}</div>}

      {/* Yükleme formu */}
      <form onSubmit={(e) => { e.preventDefault(); }} className="upload-form">
        <div className="form-group">
          <label htmlFor="file-input">{t("fileUpload.fileLabel")}</label>
          <input
            type="file"
            id="file-input"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            onChange={handleFileChange}
            disabled={loading}
            required
          />
          {file && (
            <div className="file-info">
              <strong>{t("fileUpload.selectedFile")}</strong> {file.name} (
              {(file.size / 1024 / 1024).toFixed(2)} {t("fileList.mb")})
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="uploaded-by">{t("fileUpload.uploaderLabel")}</label>
          <select
            id="uploaded-by"
            value={uploadedBy}
            onChange={(e) => setUploadedBy(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">{t("fileUpload.selectPerson")}</option>
            {teamMembers.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="emotion">{t("fileUpload.emotionLabel")}</label>
          <select
            id="emotion"
            value={emotion}
            onChange={(e) => setEmotion(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">{t("fileUpload.selectEmotion")}</option>
            {emotions.map((emotionOption) => (
              <option key={emotionOption} value={emotionOption}>
                {t(`emotions.${emotionOption}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">{t("fileUpload.descriptionLabel")}</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("fileUpload.descriptionPlaceholder")}
            rows="3"
            disabled={loading}
          />
        </div>

        <button type="button" onClick={handleUpload} disabled={loading} className="upload-button">
          {loading ? t("fileUpload.uploading") : t("fileUpload.uploadButton")}
        </button>
      </form>
    </div>
  );
}

export default FileUpload;

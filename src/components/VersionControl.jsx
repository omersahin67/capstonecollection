// Versiyon kontrolü component'i
// Bir dosyanın versiyon geçmişini gösterir ve yeni versiyon yüklemeye izin verir

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import { convertMp3ToWav } from "../utils/audioConverter";
import { extractAudioMetadata } from "../utils/audioMetadata";
import AudioPlayer from "./AudioPlayer";
import "./VersionControl.css";

function VersionControl({ file, onVersionUpdate }) {
  const { t } = useLanguage();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [versionNotes, setVersionNotes] = useState("");
  const [versionAudioUrls, setVersionAudioUrls] = useState({});

  // Versiyonları yükle
  useEffect(() => {
    if (showVersions && file) {
      loadVersions();
    }
  }, [showVersions, file]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audio_versions")
        .select("*")
        .eq("audio_file_id", file.id)
        .order("version_number", { ascending: false });

      if (error) throw error;

      setVersions(data || []);

      // Her versiyon için signed URL oluştur
      const urls = {};
      for (const version of data || []) {
        const { data: urlData } = await supabase.storage
          .from("audio-files")
          .createSignedUrl(version.file_path, 3600);
        if (urlData) {
          urls[version.id] = urlData.signedUrl;
        }
      }
      setVersionAudioUrls(urls);
    } catch (error) {
      console.error("Versiyonlar yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  // Yeni versiyon yükleme
  const handleUploadNewVersion = async () => {
    if (!newVersionFile) {
      alert(t("fileUpload.fileRequired"));
      return;
    }

    setUploading(true);
    try {
      // Dosya formatı kontrolü
      const fileName = newVersionFile.name.toLowerCase();
      const isValidFormat = fileName.endsWith(".mp3") || fileName.endsWith(".wav");
      if (!isValidFormat) {
        alert(t("fileUpload.fileFormatError"));
        setUploading(false);
        return;
      }

      // MP3 → WAV çevirme
      let finalFile = newVersionFile;
      let isConverted = false;
      let originalFormat = fileName.endsWith(".wav") ? "wav" : "mp3";

      if (originalFormat === "mp3") {
        finalFile = await convertMp3ToWav(newVersionFile);
        isConverted = true;
      }

      // Metadata çıkar
      let audioMetadata = null;
      try {
        audioMetadata = await extractAudioMetadata(finalFile);
      } catch (error) {
        console.warn("Metadata çıkarılamadı:", error);
      }

      // Yeni versiyon numarası
      const newVersionNumber = file.current_version + 1;

      // Storage'a yükle
      const timestamp = Date.now();
      const versionFileName = `${timestamp}_v${newVersionNumber}_${file.original_filename.replace(/\.[^/.]+$/, "")}.wav`;
      const versionFilePath = `audio-files/${versionFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("audio-files")
        .upload(versionFilePath, finalFile, {
          contentType: "audio/wav",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Versiyon kaydı oluştur
      const { error: versionError } = await supabase
        .from("audio_versions")
        .insert({
          audio_file_id: file.id,
          version_number: newVersionNumber,
          file_path: versionFilePath,
          file_size: finalFile.size,
          original_format: originalFormat,
          is_converted: isConverted,
          uploaded_by: file.uploaded_by, // Mevcut kullanıcı
          notes: versionNotes.trim() || null,
          duration: audioMetadata?.duration || null,
          sample_rate: audioMetadata?.sample_rate || null,
          channels: audioMetadata?.channels || null,
          audio_level: audioMetadata?.audio_level || null,
        });

      if (versionError) throw versionError;

      // Ana dosyanın current_version ve file_path'ini güncelle (yeni versiyon artık ana dosya)
      const { error: updateError } = await supabase
        .from("audio_files")
        .update({ 
          current_version: newVersionNumber,
          file_path: versionFilePath, // Yeni versiyonun dosya yolu artık ana dosya yolu
          filename: versionFileName, // Dosya adını da güncelle
          file_size: finalFile.size, // Dosya boyutunu güncelle
          duration: audioMetadata?.duration || null,
          sample_rate: audioMetadata?.sample_rate || null,
          channels: audioMetadata?.channels || null,
          audio_level: audioMetadata?.audio_level || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", file.id);

      if (updateError) throw updateError;

      alert(t("versionControl.uploadVersionSuccess"));
      setNewVersionFile(null);
      setVersionNotes("");
      setShowUploadForm(false);
      loadVersions();
      if (onVersionUpdate) {
        await onVersionUpdate(); // Ana listedeki dosyaları ve URL'leri güncelle
      }
    } catch (error) {
      console.error("Versiyon yükleme hatası:", error);
      alert(t("versionControl.uploadVersionError") + " " + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Versiyona geri dönme
  const handleRestoreVersion = async (version) => {
    if (
      !window.confirm(
        `${t("versionControl.restoreConfirm")}\n\n${t("versionControl.versionNumber")}: ${version.version_number}`
      )
    ) {
      return;
    }

    try {
      // Mevcut dosyayı yeni versiyon olarak kaydet (yedekleme)
      const currentVersionNumber = file.current_version + 1;
      const timestamp = Date.now();
      const backupFileName = `${timestamp}_v${currentVersionNumber}_backup_${file.filename}`;
      const backupFilePath = `audio-files/${backupFileName}`;

      // Mevcut dosyayı Storage'dan indir ve yedekle
      const { data: currentFileData, error: downloadError } = await supabase.storage
        .from("audio-files")
        .download(file.file_path);

      if (downloadError) throw downloadError;

      // Yedek dosyayı yükle
      const { error: backupError } = await supabase.storage
        .from("audio-files")
        .upload(backupFilePath, currentFileData, {
          contentType: "audio/wav",
        });

      if (backupError) throw backupError;

      // Yedek versiyon kaydı oluştur
      await supabase.from("audio_versions").insert({
        audio_file_id: file.id,
        version_number: currentVersionNumber,
        file_path: backupFilePath,
        file_size: file.file_size,
        original_format: file.original_format,
        is_converted: file.is_converted,
        uploaded_by: file.uploaded_by,
        notes: "Otomatik yedek (geri dönme işlemi)",
        duration: file.duration,
        sample_rate: file.sample_rate,
        channels: file.channels,
        audio_level: file.audio_level,
      });

      // Geri dönülecek versiyonun dosyasını ana dosya olarak kopyala
      const { data: versionFileData, error: versionDownloadError } = await supabase.storage
        .from("audio-files")
        .download(version.file_path);

      if (versionDownloadError) throw versionDownloadError;

      // Ana dosyayı güncelle (üzerine yaz)
      const { error: updateError } = await supabase.storage
        .from("audio-files")
        .update(file.file_path, versionFileData, {
          contentType: "audio/wav",
          upsert: true,
        });

      if (updateError) throw updateError;

      // current_version ve file_path'i güncelle
      const { error: updateVersionError } = await supabase
        .from("audio_files")
        .update({ 
          current_version: version.version_number,
          file_path: version.file_path, // Geri dönülen versiyonun dosya yolu
          filename: version.file_path.split('/').pop(), // Dosya adını güncelle
          file_size: version.file_size,
          duration: version.duration,
          sample_rate: version.sample_rate,
          channels: version.channels,
          audio_level: version.audio_level,
          updated_at: new Date().toISOString(),
        })
        .eq("id", file.id);

      if (updateVersionError) throw updateVersionError;

      alert(t("versionControl.restoreSuccess"));
      loadVersions();
      if (onVersionUpdate) {
        await onVersionUpdate(); // Ana listedeki dosyaları ve URL'leri güncelle
      }
    } catch (error) {
      console.error("Versiyon geri yükleme hatası:", error);
      alert(t("versionControl.restoreError") + " " + error.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="version-control-container">
      <button
        className="version-toggle-btn"
        onClick={() => setShowVersions(!showVersions)}
      >
        {showVersions ? "🔽" : "📋"} {showVersions ? t("versionControl.hideVersions") : t("versionControl.showVersions")} ({file.current_version})
      </button>

      {showVersions && (
        <div className="versions-panel">
          <div className="versions-header">
            <h3>{t("versionControl.versionHistory")}</h3>
            <button
              className="upload-version-btn"
              onClick={() => setShowUploadForm(!showUploadForm)}
            >
              ➕ {t("versionControl.uploadNewVersion")}
            </button>
          </div>

          {/* Yeni Versiyon Yükleme Formu */}
          {showUploadForm && (
            <div className="upload-version-form">
              <h4>{t("versionControl.newVersion")}</h4>
              <div className="form-group">
                <label>{t("fileUpload.fileLabel")}</label>
                <input
                  type="file"
                  accept=".mp3,.wav,audio/mpeg,audio/wav"
                  onChange={(e) => setNewVersionFile(e.target.files[0])}
                  disabled={uploading}
                />
                {newVersionFile && (
                  <div className="file-info">
                    {t("fileUpload.selectedFile")}: {newVersionFile.name}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>{t("versionControl.versionNotes")}</label>
                <textarea
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder={t("versionControl.versionNotesPlaceholder")}
                  rows="2"
                  disabled={uploading}
                />
              </div>
              <div className="form-actions">
                <button
                  onClick={handleUploadNewVersion}
                  disabled={uploading || !newVersionFile}
                  className="upload-btn"
                >
                  {uploading ? t("common.loading") : t("fileUpload.uploadButton")}
                </button>
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setNewVersionFile(null);
                    setVersionNotes("");
                  }}
                  className="cancel-btn"
                  disabled={uploading}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {/* Versiyon Listesi */}
          {loading ? (
            <p>{t("common.loading")}</p>
          ) : versions.length === 0 ? (
            <p className="no-versions">{t("versionControl.noVersions")}</p>
          ) : (
            <div className="versions-list">
              {versions.map((version) => {
                const audioUrl = versionAudioUrls[version.id];
                const isCurrentVersion = version.version_number === file.current_version;

                return (
                  <div
                    key={version.id}
                    className={`version-item ${isCurrentVersion ? "current-version" : ""}`}
                  >
                    <div className="version-header">
                      <div className="version-info">
                        <span className="version-badge">
                          {t("versionControl.versionNumber")} {version.version_number}
                          {isCurrentVersion && ` (${t("versionControl.currentVersion")})`}
                        </span>
                        <span className="version-meta">
                          {t("versionControl.uploadedBy")}: {version.uploaded_by} |{" "}
                          {t("versionControl.uploadDate")}: {formatDate(version.created_at)}
                        </span>
                      </div>
                      {!isCurrentVersion && (
                        <button
                          className="restore-btn"
                          onClick={() => handleRestoreVersion(version)}
                        >
                          🔄 {t("versionControl.restoreVersion")}
                        </button>
                      )}
                    </div>

                    {version.notes && (
                      <p className="version-notes">
                        <strong>{t("versionControl.notes")}:</strong> {version.notes}
                      </p>
                    )}

                    {/* Versiyon Metadata */}
                    {(version.duration || version.sample_rate || version.channels || version.audio_level) && (
                      <div className="version-metadata">
                        {version.duration && (
                          <span>
                            {t("versionControl.duration")}: {version.duration.toFixed(2)}s
                          </span>
                        )}
                        {version.sample_rate && (
                          <span>
                            {t("versionControl.sampleRate")}: {version.sample_rate.toLocaleString()} {t("fileList.hz")}
                          </span>
                        )}
                        {version.channels && (
                          <span>
                            {t("versionControl.channels")}:{" "}
                            {version.channels === 1 ? t("fileList.mono") : version.channels === 2 ? t("fileList.stereo") : version.channels}
                          </span>
                        )}
                        {version.audio_level !== null && version.audio_level !== undefined && (
                          <span>
                            {t("versionControl.audioLevel")}: {version.audio_level.toFixed(1)} dB
                          </span>
                        )}
                        <span>
                          {t("versionControl.fileSize")}: {(version.file_size / 1024 / 1024).toFixed(2)} {t("fileList.mb")}
                        </span>
                      </div>
                    )}

                    {/* Audio Player */}
                    {audioUrl && (
                      <div className="version-audio-player">
                        <AudioPlayer audioUrl={audioUrl} fileName={`${file.original_filename} (v${version.version_number})`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VersionControl;

// Ana uygulama component'i
// Giriş durumunu kontrol eder ve uygun sayfayı gösterir

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { useLanguage } from "./contexts/LanguageContext";
import Login from "./components/Login";
import FileUpload from "./components/FileUpload";
import Statistics from "./components/Statistics";
import AudioPlayer from "./components/AudioPlayer";
import LanguageSelector from "./components/LanguageSelector";
import VersionControl from "./components/VersionControl";
import {
  exportToCSV,
  exportToJSON,
  downloadCSV,
  downloadJSON,
  filterByDatasetType,
  parseCSV,
  downloadAudioFilesAsZip,
} from "./utils/dataExport";
import "./App.css";

function App() {
  // Dil desteği
  const { t } = useLanguage();
  
  // Giriş durumu kontrolü
  const [user, setUser] = useState(null); // Kullanıcı bilgisi
  const [loading, setLoading] = useState(true); // İlk yükleme durumu
  const [files, setFiles] = useState([]); // Yüklenen dosyalar listesi
  const [filesLoading, setFilesLoading] = useState(false); // Dosya listesi yükleme durumu
  const [statsRefreshKey, setStatsRefreshKey] = useState(0); // İstatistikler yenileme anahtarı
  const [audioUrls, setAudioUrls] = useState({}); // Dosya ID'leri için signed URL'ler
  const [emotionFilter, setEmotionFilter] = useState(""); // Duygu filtresi
  
  // Gelişmiş filtreleme state'leri
  const [durationMin, setDurationMin] = useState(""); // Minimum süre (saniye)
  const [durationMax, setDurationMax] = useState(""); // Maksimum süre (saniye)
  const [sampleRateFilter, setSampleRateFilter] = useState(""); // Sample rate filtresi
  const [channelsFilter, setChannelsFilter] = useState(""); // Kanal filtresi (Mono/Stereo)
  const [fileSizeMin, setFileSizeMin] = useState(""); // Minimum dosya boyutu (MB)
  const [fileSizeMax, setFileSizeMax] = useState(""); // Maksimum dosya boyutu (MB)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false); // Gelişmiş filtreleri göster/gizle
  
  // Toplu işlemler state'leri
  const [selectedFiles, setSelectedFiles] = useState(new Set()); // Seçili dosya ID'leri
  
  // Import state'leri
  const [importLoading, setImportLoading] = useState(false);
  
  // Audio download state'leri
  const [audioDownloadLoading, setAudioDownloadLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  // Dosya düzenleme state'leri
  const [editingFileId, setEditingFileId] = useState(null);
  const [editEmotion, setEditEmotion] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDatasetType, setEditDatasetType] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Duygu seçenekleri
  const emotions = ["Mutlu", "Üzgün", "Kızgın", "Korkulu", "Şaşkın", "Nötr"];

  // Filtrelenmiş dosyalar (tüm filtreleri uygula)
  const filteredFiles = files.filter((file) => {
    // Duygu filtresi
    if (emotionFilter && file.emotion !== emotionFilter) {
      return false;
    }

    // Süre filtresi
    if (file.duration) {
      if (durationMin && file.duration < parseFloat(durationMin)) {
        return false;
      }
      if (durationMax && file.duration > parseFloat(durationMax)) {
        return false;
      }
    }

    // Sample rate filtresi
    if (sampleRateFilter && file.sample_rate) {
      const rate = parseInt(sampleRateFilter);
      if (file.sample_rate !== rate) {
        return false;
      }
    }

    // Kanal filtresi
    if (channelsFilter && file.channels) {
      const channels = channelsFilter === "Mono" ? 1 : channelsFilter === "Stereo" ? 2 : null;
      if (channels !== null && file.channels !== channels) {
        return false;
      }
    }

    // Dosya boyutu filtresi (MB cinsinden)
    if (file.file_size) {
      const fileSizeMB = file.file_size / 1024 / 1024;
      if (fileSizeMin && fileSizeMB < parseFloat(fileSizeMin)) {
        return false;
      }
      if (fileSizeMax && fileSizeMB > parseFloat(fileSizeMax)) {
        return false;
      }
    }

    return true;
  });

  // Filtreleri temizle
  const clearFilters = () => {
    setEmotionFilter("");
    setDurationMin("");
    setDurationMax("");
    setSampleRateFilter("");
    setChannelsFilter("");
    setFileSizeMin("");
    setFileSizeMax("");
  };

  // Aktif filtre sayısını hesapla
  const activeFilterCount = [
    emotionFilter,
    durationMin,
    durationMax,
    sampleRateFilter,
    channelsFilter,
    fileSizeMin,
    fileSizeMax,
  ].filter(Boolean).length;

  // Sayfa yüklendiğinde giriş durumunu kontrol et
  useEffect(() => {
    // Mevcut oturumu kontrol et
    checkUser();

    // Auth durumu değişikliklerini dinle
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Component unmount olduğunda subscription'ı temizle
    return () => subscription.unsubscribe();
  }, []);

  // Kullanıcı giriş yaptığında dosyaları yükle
  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [user]);

  // Kullanıcı kontrolü
  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    setLoading(false);
  };

  // Giriş başarılı olduğunda
  const handleLoginSuccess = () => {
    checkUser(); // Kullanıcı bilgisini güncelle
  };

  // Çıkış yapma
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFiles([]); // Dosya listesini temizle
  };

  // Dosyaları yükle
  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const { data, error } = await supabase
        .from("audio_files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);

      // Her dosya için signed URL oluştur
      if (data && data.length > 0) {
        const urls = {};
        for (const file of data) {
          try {
            const { data: urlData, error: urlError } = await supabase.storage
              .from("audio-files")
              .createSignedUrl(file.file_path, 3600); // 1 saat geçerli
            if (urlError) {
              console.error(`URL oluşturma hatası (${file.original_filename}):`, urlError);
            } else if (urlData) {
              urls[file.id] = urlData.signedUrl;
              console.log(`URL güncellendi: ${file.original_filename} -> ${file.file_path}`);
            }
          } catch (err) {
            console.error(`URL oluşturma hatası (${file.original_filename}):`, err);
          }
        }
        setAudioUrls(urls);
      }
    } catch (error) {
      console.error("Dosyalar yüklenirken hata:", error);
    } finally {
      setFilesLoading(false);
    }
  };

  // Dosya yükleme başarılı olduğunda
  const handleUploadSuccess = () => {
    loadFiles(); // Dosya listesini yenile
    setStatsRefreshKey((prev) => prev + 1); // İstatistikleri yenile
  };

  // Dosya düzenleme fonksiyonları
  const handleEditFile = (file) => {
    setEditingFileId(file.id);
    setEditEmotion(file.emotion || "");
    setEditDescription(file.description || "");
    setEditDatasetType(file.dataset_type || "");
  };

  const handleCancelEdit = () => {
    setEditingFileId(null);
    setEditEmotion("");
    setEditDescription("");
    setEditDatasetType("");
  };

  const handleSaveEdit = async (fileId) => {
    setEditLoading(true);
    try {
      const updateData = {
        emotion: editEmotion || null,
        description: editDescription.trim() || null,
        dataset_type: editDatasetType || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("audio_files")
        .update(updateData)
        .eq("id", fileId);

      if (error) throw error;

      alert(t("fileEdit.updateSuccess"));
      handleCancelEdit();
      loadFiles();
      setStatsRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Dosya güncelleme hatası:", error);
      alert(t("fileEdit.updateError") + " " + error.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Dosya silme fonksiyonu
  const handleDeleteFile = async (file) => {
    // Onay mesajı
    const confirmDelete = window.confirm(
      `"${file.original_filename}" ${t("fileList.deleteConfirm")}\n\n${t("common.delete")}?`
    );

    if (!confirmDelete) return;

    try {
      // 1. Storage'dan dosyayı sil
      const { error: storageError } = await supabase.storage
        .from("audio-files")
        .remove([file.file_path]);

      if (storageError) {
        console.error("Storage silme hatası:", storageError);
        // Storage hatası olsa bile veritabanından silmeye devam et
      }

      // 2. Veritabanından kaydı sil (CASCADE ile versiyonlar da silinecek)
      const { error: dbError } = await supabase
        .from("audio_files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      // 3. Başarılı - listeyi ve istatistikleri güncelle
      alert(t("fileList.deleteSuccess"));
      loadFiles(); // Dosya listesini yenile
      setStatsRefreshKey((prev) => prev + 1); // İstatistikleri yenile
    } catch (error) {
      console.error("Silme hatası:", error);
      alert(t("fileList.deleteError") + " " + error.message);
    }
  };

  // Toplu işlemler fonksiyonları
  const toggleFileSelection = (fileId) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map((file) => file.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) {
      alert(t("bulkActions.selected") + " " + t("common.select"));
      return;
    }

    const confirmDelete = window.confirm(
      `${selectedFiles.size} ${t("bulkActions.selected")} ${t("common.delete")}?\n\n${t("common.delete")}?`
    );

    if (!confirmDelete) return;

    try {
      const selectedFilesArray = Array.from(selectedFiles);
      const filesToDelete = filteredFiles.filter((file) =>
        selectedFilesArray.includes(file.id)
      );

      let successCount = 0;
      let errorCount = 0;

      for (const file of filesToDelete) {
        try {
          // Storage'dan sil
          await supabase.storage
            .from("audio-files")
            .remove([file.file_path]);

          // Veritabanından sil
          const { error } = await supabase
            .from("audio_files")
            .delete()
            .eq("id", file.id);

          if (error) throw error;
          successCount++;
        } catch (error) {
          console.error(`Dosya silme hatası (${file.original_filename}):`, error);
          errorCount++;
        }
      }

      // Seçimi temizle
      setSelectedFiles(new Set());

      // Sonuç mesajı
      if (errorCount === 0) {
        alert(`${successCount} ${t("bulkActions.deleteSuccess")}`);
      } else {
        alert(`${successCount} ${t("bulkActions.deleteSuccess")}, ${errorCount} ${t("bulkActions.deleteError")}`);
      }

      // Listeyi ve istatistikleri güncelle
      loadFiles();
      setStatsRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Toplu silme hatası:", error);
      alert(t("bulkActions.deleteError") + " " + error.message);
    }
  };

  const handleBulkDatasetAssignment = async (datasetType) => {
    if (selectedFiles.size === 0) {
      alert(t("bulkActions.selected") + " " + t("common.select"));
      return;
    }

    const datasetTypeNames = {
      train: t("fileList.train"),
      test: t("fileList.test"),
      validation: t("fileList.validation"),
    };

    const confirmAssign = window.confirm(
      `${selectedFiles.size} ${t("bulkActions.selected")} "${datasetTypeNames[datasetType]}" ${t("bulkActions.assignToTrain")}?`
    );

    if (!confirmAssign) return;

    try {
      const selectedFilesArray = Array.from(selectedFiles);

      const { error } = await supabase
        .from("audio_files")
        .update({ dataset_type: datasetType })
        .in("id", selectedFilesArray);

      if (error) throw error;

      // Seçimi temizle
      setSelectedFiles(new Set());

      alert(
        `${selectedFiles.size} ${t("bulkActions.assignSuccess")}`
      );

      // Listeyi güncelle
      loadFiles();
    } catch (error) {
      console.error("Toplu atama hatası:", error);
      alert(t("bulkActions.assignError") + " " + error.message);
    }
  };

  // Export fonksiyonları
  const handleExportCSV = (datasetType = null) => {
    const filesToExport = datasetType
      ? filterByDatasetType(filteredFiles, datasetType)
      : filteredFiles;

    if (filesToExport.length === 0) {
      alert("Export edilecek dosya bulunamadı.");
      return;
    }

    const csvContent = exportToCSV(filesToExport);
    const filename = datasetType
      ? `audio_dataset_${datasetType}_${new Date().toISOString().split("T")[0]}.csv`
      : `audio_dataset_all_${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleExportJSON = (datasetType = null) => {
    const filesToExport = datasetType
      ? filterByDatasetType(filteredFiles, datasetType)
      : filteredFiles;

    if (filesToExport.length === 0) {
      alert("Export edilecek dosya bulunamadı.");
      return;
    }

    const jsonContent = exportToJSON(filesToExport);
    const filename = datasetType
      ? `audio_dataset_${datasetType}_${new Date().toISOString().split("T")[0]}.json`
      : `audio_dataset_all_${new Date().toISOString().split("T")[0]}.json`;
    downloadJSON(jsonContent, filename);
  };

  // Import fonksiyonu
  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportLoading(true);
    try {
      const text = await file.text();
      const csvData = parseCSV(text);

      if (csvData.length === 0) {
        alert(t("exportImport.importError") + " " + t("fileList.noFiles"));
        setImportLoading(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of csvData) {
        try {
          const fileId = row["ID"] || row["id"];
          if (!fileId) continue;

          const updateData = {};

          // Dataset type güncelle
          if (row["Dataset Type"] || row["dataset_type"]) {
            const datasetType = row["Dataset Type"] || row["dataset_type"];
            if (["train", "test", "validation"].includes(datasetType.toLowerCase())) {
              updateData.dataset_type = datasetType.toLowerCase();
            } else if (datasetType === "") {
              updateData.dataset_type = null;
            }
          }

          // Emotion güncelle
          if (row["Duygu"] || row["emotion"]) {
            const emotion = row["Duygu"] || row["emotion"];
            if (emotions.includes(emotion)) {
              updateData.emotion = emotion;
            } else if (emotion === "") {
              updateData.emotion = null;
            }
          }

          // Description güncelle
          if (row["Açıklama"] || row["description"]) {
            updateData.description = row["Açıklama"] || row["description"] || null;
          }

          // Sadece güncellenecek alanlar varsa güncelle
          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from("audio_files")
              .update(updateData)
              .eq("id", fileId);

            if (error) throw error;
            successCount++;
          }
        } catch (error) {
          console.error("Satır güncelleme hatası:", error);
          errorCount++;
        }
      }

      // Input'u temizle
      event.target.value = "";

      if (errorCount === 0) {
        alert(`${successCount} ${t("exportImport.importSuccess")}`);
      } else {
        alert(`${successCount} ${t("exportImport.importSuccess")}, ${errorCount} ${t("exportImport.importError")}`);
      }

      // Listeyi güncelle
      loadFiles();
    } catch (error) {
      console.error("Import hatası:", error);
      alert(t("exportImport.importError") + " " + error.message);
    } finally {
      setImportLoading(false);
    }
  };

  // Ses dosyalarını ZIP olarak indirme fonksiyonu
  const handleDownloadAudioFiles = async (datasetType = null) => {
    // Debug: Hangi dosyaların dataset_type'ı var kontrol et
    const filesWithDatasetType = filteredFiles.filter(f => f.dataset_type);
    const trainCount = filteredFiles.filter(f => f.dataset_type === "train").length;
    const testCount = filteredFiles.filter(f => f.dataset_type === "test").length;
    const validationCount = filteredFiles.filter(f => f.dataset_type === "validation").length;
    
    console.log("Dataset Type Filter Debug:", {
      totalFiles: filteredFiles.length,
      filesWithDatasetType: filesWithDatasetType.length,
      train: trainCount,
      test: testCount,
      validation: validationCount,
      requestedType: datasetType
    });

    const filesToDownload = datasetType
      ? filterByDatasetType(filteredFiles, datasetType)
      : filteredFiles;

    console.log("Files to download:", filesToDownload.length, "for type:", datasetType);

    if (filesToDownload.length === 0) {
      const totalCount = filteredFiles.length;
      const datasetCount = datasetType 
        ? filteredFiles.filter(f => f.dataset_type === datasetType).length
        : 0;
      const message = datasetType
        ? `${t("fileList.datasetType")} "${datasetType}" ${t("fileList.noFilteredFiles")}\n\nToplam dosya: ${totalCount}\n${datasetType} dosyası: ${datasetCount}\n\nNot: Dosyalara dataset tipi atamak için toplu işlemler kullanın.`
        : t("fileList.noFiles");
      alert(message);
      return;
    }

    setAudioDownloadLoading(true);
    setDownloadProgress({ current: 0, total: filesToDownload.length });

    try {
      const filename = datasetType
        ? `audio_files_${datasetType}_${new Date().toISOString().split("T")[0]}.zip`
        : `audio_files_all_${new Date().toISOString().split("T")[0]}.zip`;

      await downloadAudioFilesAsZip(
        filesToDownload,
        filename,
        supabase,
        (current, total) => {
          setDownloadProgress({ current, total });
        }
      );

      const datasetTypeLabel = datasetType 
        ? `${t("fileList.datasetType")} "${datasetType}"`
        : t("filters.allEmotions");
      const successMessage = `${filesToDownload.length} ${t("exportImport.downloadComplete")}\n${datasetTypeLabel}\nDosya: ${filename}`;
      alert(successMessage);
    } catch (error) {
      console.error("Ses dosyası indirme hatası:", error);
      alert(t("exportImport.downloadProgress") + " " + error.message);
    } finally {
      setAudioDownloadLoading(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  // Seçili dosyaları ZIP olarak indirme
  const handleDownloadSelectedAudioFiles = async () => {
    if (selectedFiles.size === 0) {
      alert(t("bulkActions.selected") + " " + t("common.select"));
      return;
    }

    const filesToDownload = filteredFiles.filter((file) =>
      selectedFiles.has(file.id)
    );

    setAudioDownloadLoading(true);
    setDownloadProgress({ current: 0, total: filesToDownload.length });

    try {
      const filename = `audio_files_selected_${new Date().toISOString().split("T")[0]}.zip`;

      await downloadAudioFilesAsZip(
        filesToDownload,
        filename,
        supabase,
        (current, total) => {
          setDownloadProgress({ current, total });
        }
      );

      alert(`${filesToDownload.length} ${t("exportImport.downloadComplete")}`);
    } catch (error) {
      console.error("Ses dosyası indirme hatası:", error);
      alert(t("exportImport.downloadProgress") + " " + error.message);
    } finally {
      setAudioDownloadLoading(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  // İlk yükleme sırasında loading göster
  if (loading) {
  return (
      <div className="loading">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  // Giriş yapılmamışsa Login sayfasını göster
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Giriş yapılmışsa ana sayfayı göster
  return (
    <div className="app">
      <header className="app-header">
        <h1>{t("fileList.title")}</h1>
        <div className="user-info">
          <LanguageSelector />
          <span>{user.email}</span>
          <button onClick={handleLogout} className="logout-button">
            {t("common.close")}
          </button>
        </div>
      </header>
      <main className="app-main">
        {/* İstatistikler */}
        <Statistics refreshKey={statsRefreshKey} />

        {/* Veri Seti Export/Import Paneli */}
        <div className="export-section">
          <h2>📥 {t("exportImport.exportCSV")} / {t("exportImport.importCSV")}</h2>
          <div className="export-controls">
            {/* Metadata Export */}
            <div className="export-group">
              <h3 className="export-group-title">📋 {t("exportImport.exportCSV")}</h3>
              <div className="export-buttons">
                <button
                  className="export-btn export-csv-btn"
                  onClick={() => handleExportCSV()}
                  title={t("exportImport.exportCSV")}
                >
                  📊 {t("exportImport.exportCSV")} ({t("filters.allEmotions")})
                </button>
                <button
                  className="export-btn export-json-btn"
                  onClick={() => handleExportJSON()}
                  title={t("exportImport.exportJSON")}
                >
                  📄 {t("exportImport.exportJSON")} ({t("filters.allEmotions")})
                </button>
                <label className="import-btn-label">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    disabled={importLoading}
                    style={{ display: "none" }}
                  />
                  <span className={`export-btn import-btn ${importLoading ? "loading" : ""}`}>
                    {importLoading ? `⏳ ${t("exportImport.importing")}` : `📤 ${t("exportImport.importCSV")}`}
                  </span>
                </label>
              </div>
            </div>

            {/* Ses Dosyaları İndirme */}
            <div className="export-group">
              <h3 className="export-group-title">🎵 {t("exportImport.exportAudio")}</h3>
              <div className="export-buttons">
                <button
                  className="export-btn download-audio-btn"
                  onClick={() => handleDownloadAudioFiles()}
                  disabled={audioDownloadLoading}
                  title={t("exportImport.exportAudio")}
                >
                  {audioDownloadLoading
                    ? `⏳ ${t("exportImport.downloadProgress")} (${downloadProgress.current}/${downloadProgress.total})`
                    : `🎵 ${t("exportImport.exportAudio")}`}
                </button>
                {selectedFiles.size > 0 && (
                  <button
                    className="export-btn download-selected-btn"
                    onClick={handleDownloadSelectedAudioFiles}
                    disabled={audioDownloadLoading}
                    title={t("exportImport.exportAudio")}
                  >
                    {audioDownloadLoading
                      ? `⏳ ${t("exportImport.downloadProgress")} (${downloadProgress.current}/${downloadProgress.total})`
                      : `🎵 ${t("exportImport.exportAudio")} (${selectedFiles.size} ${t("bulkActions.selected")})`}
                  </button>
                )}
              </div>
              <div className="export-split-buttons">
                <span className="export-label">{t("exportImport.datasetSplit")}</span>
                <button
                  className="export-btn export-train-btn"
                  onClick={() => handleDownloadAudioFiles("train")}
                  disabled={audioDownloadLoading}
                  title={t("exportImport.downloadTrainTitle")}
                >
                  📚 {t("fileList.train")} ZIP ({filteredFiles.filter(f => f.dataset_type === "train").length})
                </button>
                <button
                  className="export-btn export-test-btn"
                  onClick={() => handleDownloadAudioFiles("test")}
                  disabled={audioDownloadLoading}
                  title={t("exportImport.downloadTestTitle")}
                >
                  🧪 {t("fileList.test")} ZIP ({filteredFiles.filter(f => f.dataset_type === "test").length})
                </button>
                <button
                  className="export-btn export-validation-btn"
                  onClick={() => handleDownloadAudioFiles("validation")}
                  disabled={audioDownloadLoading}
                  title={t("exportImport.downloadValidationTitle")}
                >
                  ✅ {t("fileList.validation")} ZIP ({filteredFiles.filter(f => f.dataset_type === "validation").length})
                </button>
              </div>
            </div>

            {/* Dataset Split CSV Export */}
            <div className="export-group">
              <h3 className="export-group-title">📊 {t("exportImport.datasetSplitCSVExport")}</h3>
              <div className="export-split-buttons">
                <span className="export-label">{t("exportImport.csvLabel")}</span>
                <button
                  className="export-btn export-train-btn"
                  onClick={() => handleExportCSV("train")}
                  title={t("exportImport.exportTrainTitle")}
                >
                  📚 {t("fileList.train")} CSV
                </button>
                <button
                  className="export-btn export-test-btn"
                  onClick={() => handleExportCSV("test")}
                  title={t("exportImport.exportTestTitle")}
                >
                  🧪 {t("fileList.test")} CSV
                </button>
                <button
                  className="export-btn export-validation-btn"
                  onClick={() => handleExportCSV("validation")}
                  title={t("exportImport.exportValidationTitle")}
                >
                  ✅ {t("fileList.validation")} CSV
                </button>
              </div>
            </div>

            <div className="import-info">
              <p className="import-help-text">
                💡 <strong>{t("exportImport.importCSV")}:</strong> {t("exportImport.importHelp")}
              </p>
              <p className="import-help-text" style={{ marginTop: "10px" }}>
                💡 <strong>{t("exportImport.exportAudio")}:</strong> {t("exportImport.downloadHelp")}
              </p>
            </div>
          </div>
        </div>

        {/* Dosya yükleme formu */}
        <FileUpload onUploadSuccess={handleUploadSuccess} />

        {/* Dosya listesi */}
        <div className="files-section">
          <div className="files-header">
            <h2>{t("fileList.title")}</h2>
            <div className="filter-controls">
              <div className="basic-filters">
                <label htmlFor="emotion-filter">{t("filters.emotionFilter")}</label>
                <select
                  id="emotion-filter"
                  value={emotionFilter}
                  onChange={(e) => setEmotionFilter(e.target.value)}
                  className="emotion-filter-select"
                >
                  <option value="">{t("filters.allEmotions")}</option>
                  {emotions.map((emotion) => (
                    <option key={emotion} value={emotion}>
                      {t(`emotions.${emotion}`)}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                className="advanced-filters-toggle"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? "🔽" : "🔍"} {t("filters.advancedFilters")}
                {activeFilterCount > 0 && (
                  <span className="filter-badge">{activeFilterCount}</span>
                )}
              </button>

              {activeFilterCount > 0 && (
                <button className="clear-filters-btn" onClick={clearFilters}>
                  ✕ {t("filters.clearFilters")}
                </button>
              )}
            </div>
          </div>

          {/* Gelişmiş Filtreler */}
          {showAdvancedFilters && (
            <div className="advanced-filters">
              <h3>🔍 {t("filters.advancedFilters")}</h3>
              <div className="filters-grid">
                {/* Süre Filtresi */}
                <div className="filter-group">
                  <label>{t("filters.duration")}</label>
                  <div className="range-inputs">
                    <input
                      type="number"
                      placeholder={t("filters.minDuration")}
                      value={durationMin}
                      onChange={(e) => setDurationMin(e.target.value)}
                      min="0"
                      step="0.1"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      placeholder={t("filters.maxDuration")}
                      value={durationMax}
                      onChange={(e) => setDurationMax(e.target.value)}
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Sample Rate Filtresi */}
                <div className="filter-group">
                  <label>{t("filters.sampleRate")}</label>
                  <select
                    value={sampleRateFilter}
                    onChange={(e) => setSampleRateFilter(e.target.value)}
                  >
                    <option value="">{t("filters.allEmotions")}</option>
                    <option value="16000">16,000 {t("fileList.hz")} (Telefon)</option>
                    <option value="22050">22,050 {t("fileList.hz")}</option>
                    <option value="44100">44,100 {t("fileList.hz")} (CD Kalitesi)</option>
                    <option value="48000">48,000 {t("fileList.hz")} (Profesyonel)</option>
                  </select>
                </div>

                {/* Kanal Filtresi */}
                <div className="filter-group">
                  <label>{t("filters.channels")}</label>
                  <select
                    value={channelsFilter}
                    onChange={(e) => setChannelsFilter(e.target.value)}
                  >
                    <option value="">{t("filters.allEmotions")}</option>
                    <option value="Mono">{t("fileList.mono")} (1 {t("filters.channels")})</option>
                    <option value="Stereo">{t("fileList.stereo")} (2 {t("filters.channels")})</option>
                  </select>
                </div>

                {/* Dosya Boyutu Filtresi */}
                <div className="filter-group">
                  <label>{t("filters.fileSize")}</label>
                  <div className="range-inputs">
                    <input
                      type="number"
                      placeholder={t("filters.minFileSize")}
                      value={fileSizeMin}
                      onChange={(e) => setFileSizeMin(e.target.value)}
                      min="0"
                      step="0.1"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      placeholder={t("filters.maxFileSize")}
                      value={fileSizeMax}
                      onChange={(e) => setFileSizeMax(e.target.value)}
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filtre Bilgisi */}
          {activeFilterCount > 0 && (
            <div className="filter-results-info">
              <span>
                {filteredFiles.length} dosya gösteriliyor (toplam {files.length} dosyadan)
              </span>
            </div>
          )}

          {/* Toplu İşlemler Kontrol Paneli */}
          {filteredFiles.length > 0 && (
            <div className="bulk-actions-panel">
              <div className="bulk-actions-header">
                <div className="select-all-controls">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                    onChange={toggleSelectAll}
                    className="bulk-checkbox"
                  />
                  <label htmlFor="select-all">
                    {t("common.selectAll")} ({selectedFiles.size}/{filteredFiles.length})
                  </label>
                </div>
                {selectedFiles.size > 0 && (
                  <div className="bulk-action-buttons">
                    <button
                      className="bulk-action-btn bulk-delete-btn"
                      onClick={handleBulkDelete}
                    >
                      🗑️ {t("bulkActions.bulkDelete")} ({selectedFiles.size})
                    </button>
                    <div className="bulk-dataset-buttons">
                      <button
                        className="bulk-action-btn bulk-dataset-btn train-btn"
                        onClick={() => handleBulkDatasetAssignment("train")}
                        title={t("fileList.train")}
                      >
                        📚 {t("fileList.train")}
                      </button>
                      <button
                        className="bulk-action-btn bulk-dataset-btn test-btn"
                        onClick={() => handleBulkDatasetAssignment("test")}
                        title={t("fileList.test")}
                      >
                        🧪 {t("fileList.test")}
                      </button>
                      <button
                        className="bulk-action-btn bulk-dataset-btn validation-btn"
                        onClick={() => handleBulkDatasetAssignment("validation")}
                        title={t("fileList.validation")}
                      >
                        ✅ {t("fileList.validation")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {filesLoading ? (
            <p>{t("common.loading")}</p>
          ) : files.length === 0 ? (
            <p className="no-files">{t("fileList.noFiles")}</p>
          ) : filteredFiles.length === 0 ? (
            <p className="no-files">
              {t("fileList.noFilteredFiles")}
            </p>
          ) : (
            <div className="files-list">
              {filteredFiles.map((file) => {
                // Signed URL'i al (eğer varsa)
                const audioUrl = audioUrls[file.id];

                return (
                  <div key={file.id} className="file-item">
                    <div className="file-info">
                      <div className="file-header">
                        <div className="file-header-left">
                          <input
                            type="checkbox"
                            id={`file-${file.id}`}
                            checked={selectedFiles.has(file.id)}
                            onChange={() => toggleFileSelection(file.id)}
                            className="file-checkbox"
                          />
                          <h3>{file.original_filename}</h3>
                          {file.dataset_type && (
                            <span className={`dataset-badge dataset-${file.dataset_type}`}>
                              {file.dataset_type === "train" && `📚 ${t("fileList.train")}`}
                              {file.dataset_type === "test" && `🧪 ${t("fileList.test")}`}
                              {file.dataset_type === "validation" && `✅ ${t("fileList.validation")}`}
                            </span>
                          )}
                        </div>
                        <div className="file-header-actions">
                          {editingFileId === file.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(file.id)}
                                className="edit-button save-button"
                                disabled={editLoading}
                                title={t("fileEdit.save")}
                              >
                                {editLoading ? "⏳" : "✅"} {t("fileEdit.save")}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="edit-button cancel-button"
                                disabled={editLoading}
                                title={t("fileEdit.cancel")}
                              >
                                ❌ {t("fileEdit.cancel")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditFile(file)}
                                className="edit-button"
                                title={t("fileEdit.edit")}
                              >
                                ✏️ {t("fileEdit.edit")}
                              </button>
                              <button
                                onClick={() => handleDeleteFile(file)}
                                className="delete-button"
                                title={t("common.delete")}
                              >
                                🗑️ {t("common.delete")}
        </button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {editingFileId === file.id ? (
                        <div className="file-edit-form">
                          <div className="edit-form-row">
                            <div className="edit-form-group">
                              <label>{t("fileUpload.emotionLabel")}</label>
                              <select
                                value={editEmotion}
                                onChange={(e) => setEditEmotion(e.target.value)}
                                disabled={editLoading}
                              >
                                <option value="">{t("fileUpload.selectEmotion")}</option>
                                {emotions.map((emotion) => (
                                  <option key={emotion} value={emotion}>
                                    {t(`emotions.${emotion}`)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="edit-form-group">
                              <label>{t("exportImport.datasetSplit")}</label>
                              <select
                                value={editDatasetType}
                                onChange={(e) => setEditDatasetType(e.target.value)}
                                disabled={editLoading}
                              >
                                <option value="">{t("common.none")}</option>
                                <option value="train">📚 {t("fileList.train")}</option>
                                <option value="test">🧪 {t("fileList.test")}</option>
                                <option value="validation">✅ {t("fileList.validation")}</option>
                              </select>
                            </div>
                          </div>
                          <div className="edit-form-group">
                            <label>{t("fileUpload.descriptionLabel")}</label>
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              disabled={editLoading}
                              rows="3"
                              placeholder={t("fileUpload.descriptionPlaceholder")}
                            />
                          </div>
                        </div>
                      ) : (
                        <p>
                          <strong>{t("fileList.uploadedBy")}</strong> {file.uploaded_by} |{" "}
                          <strong>{t("fileList.emotion")}</strong> {file.emotion ? t(`emotions.${file.emotion}`) : t("common.none")} |{" "}
                          <strong>{t("fileList.version")}</strong> {file.current_version} |{" "}
                          <strong>{t("fileList.fileSize")}</strong>{" "}
                          {(file.file_size / 1024 / 1024).toFixed(2)} {t("fileList.mb")}
                        </p>
                      )}
                      
                      {/* Metadata Bilgileri (AI Model Eğitimi İçin) */}
                      {(file.duration || file.sample_rate || file.channels || file.audio_level) && (
                        <div className="audio-metadata">
                          <h4>📊 {t("fileList.duration")}:</h4>
                          <div className="metadata-grid">
                            {file.duration && (
                              <div className="metadata-item">
                                <span className="metadata-label">{t("fileList.duration")}:</span>
                                <span className="metadata-value">{file.duration.toFixed(2)} {t("fileList.seconds")}</span>
                              </div>
                            )}
                            {file.sample_rate && (
                              <div className="metadata-item">
                                <span className="metadata-label">{t("fileList.sampleRate")}:</span>
                                <span className="metadata-value">{file.sample_rate.toLocaleString()} {t("fileList.hz")}</span>
                              </div>
                            )}
                            {file.channels && (
                              <div className="metadata-item">
                                <span className="metadata-label">{t("fileList.channels")}:</span>
                                <span className="metadata-value">
                                  {file.channels === 1 ? t("fileList.mono") : file.channels === 2 ? t("fileList.stereo") : `${file.channels} ${t("filters.channels")}`}
                                </span>
                              </div>
                            )}
                            {file.audio_level !== null && file.audio_level !== undefined && (
                              <div className="metadata-item">
                                <span className="metadata-label">{t("audioPlayer.volume")}:</span>
                                <span className="metadata-value">{file.audio_level.toFixed(1)} dB</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {file.description && (
                        <p className="file-description">{file.description}</p>
                      )}
                      
                      {/* Ses Oynatıcı */}
                      {audioUrl ? (
                        <AudioPlayer 
                          key={`${file.id}-${file.file_path}-${file.current_version}`}
                          audioUrl={audioUrl} 
                          fileName={file.original_filename} 
                        />
                      ) : (
                        <div className="audio-player-container">
                          <p style={{ color: "#999", fontSize: "14px" }}>
                            {t("common.loading")}
        </p>
      </div>
                      )}

                      {/* Versiyon Kontrolü */}
                      <VersionControl 
                        file={file} 
                        onVersionUpdate={async () => {
                          await loadFiles(); // Dosyaları ve URL'leri yeniden yükle
                          setStatsRefreshKey((prev) => prev + 1);
                        }} 
                      />

                      <p className="file-date">
                        {new Date(file.created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

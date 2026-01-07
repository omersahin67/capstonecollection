// Veri seti export utility'si
// AI model eğitimi için veri setini CSV/JSON formatında dışa aktarır

/**
 * Dosyaları CSV formatına çevirir
 * @param {Array} files - Export edilecek dosyalar
 * @returns {string} - CSV formatında string
 */
export function exportToCSV(files) {
  // CSV başlıkları
  const headers = [
    "ID",
    "Orijinal Dosya Adı",
    "Dosya Yolu",
    "Dosya Boyutu (MB)",
    "Orijinal Format",
    "Yükleyen",
    "Duygu",
    "Açıklama",
    "Süre (saniye)",
    "Sample Rate (Hz)",
    "Kanallar",
    "Ses Seviyesi (dB)",
    "Dataset Type",
    "Yüklenme Tarihi",
    "Versiyon",
  ];

  // CSV satırları
  const rows = files.map((file) => {
    return [
      file.id,
      file.original_filename,
      file.file_path,
      file.file_size ? (file.file_size / 1024 / 1024).toFixed(2) : "",
      file.original_format || "",
      file.uploaded_by,
      file.emotion || "",
      file.description || "",
      file.duration ? file.duration.toFixed(2) : "",
      file.sample_rate || "",
      file.channels || "",
      file.audio_level ? file.audio_level.toFixed(1) : "",
      file.dataset_type || "",
      file.created_at ? new Date(file.created_at).toLocaleString("tr-TR") : "",
      file.current_version || 1,
    ];
  });

  // CSV formatına çevir
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        // Hücre içinde virgül veya tırnak varsa tırnak içine al
        const cellStr = String(cell || "");
        if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(",")
    ),
  ].join("\n");

  return csvContent;
}

/**
 * Dosyaları JSON formatına çevirir
 * @param {Array} files - Export edilecek dosyalar
 * @returns {string} - JSON formatında string
 */
export function exportToJSON(files) {
  const jsonData = {
    export_date: new Date().toISOString(),
    total_files: files.length,
    files: files.map((file) => ({
      id: file.id,
      original_filename: file.original_filename,
      file_path: file.file_path,
      file_size_bytes: file.file_size,
      file_size_mb: file.file_size ? (file.file_size / 1024 / 1024).toFixed(2) : null,
      original_format: file.original_format,
      uploaded_by: file.uploaded_by,
      emotion: file.emotion,
      description: file.description,
      duration: file.duration,
      sample_rate: file.sample_rate,
      channels: file.channels,
      audio_level: file.audio_level,
      dataset_type: file.dataset_type,
      created_at: file.created_at,
      updated_at: file.updated_at,
      current_version: file.current_version,
    })),
  };

  return JSON.stringify(jsonData, null, 2);
}

/**
 * CSV dosyasını indirir
 * @param {string} csvContent - CSV içeriği
 * @param {string} filename - Dosya adı
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * JSON dosyasını indirir
 * @param {string} jsonContent - JSON içeriği
 * @param {string} filename - Dosya adı
 */
export function downloadJSON(jsonContent, filename) {
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Dataset type'a göre dosyaları filtreler
 * @param {Array} files - Tüm dosyalar
 * @param {string} datasetType - Dataset tipi ('train', 'test', 'validation' veya null)
 * @returns {Array} - Filtrelenmiş dosyalar
 */
export function filterByDatasetType(files, datasetType) {
  if (!datasetType) return files;
  // dataset_type tam olarak eşleşmeli (null değil)
  return files.filter((file) => file.dataset_type && file.dataset_type.toLowerCase() === datasetType.toLowerCase());
}

/**
 * CSV dosyasını parse eder
 * @param {string} csvText - CSV içeriği
 * @returns {Array} - Parse edilmiş veriler
 */
export function parseCSV(csvText) {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let currentValue = "";
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      const nextChar = lines[i][j + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          j++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      data.push(row);
    }
  }

  return data;
}

/**
 * Ses dosyalarını ZIP olarak indirir
 * @param {Array} files - İndirilecek dosyalar
 * @param {string} zipFilename - ZIP dosya adı
 * @param {Function} supabase - Supabase client
 * @param {Function} onProgress - İlerleme callback'i (optional)
 * @returns {Promise<void>}
 */
export async function downloadAudioFilesAsZip(files, zipFilename, supabase, onProgress) {
  // JSZip'i dinamik olarak import et
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const totalFiles = files.length;
  let processedFiles = 0;

  try {
    // Her dosyayı Storage'dan çek ve ZIP'e ekle
    for (const file of files) {
      try {
        // Storage'dan dosyayı indir
        const { data, error } = await supabase.storage
          .from("audio-files")
          .download(file.file_path);

        if (error) {
          console.error(`Dosya indirme hatası (${file.original_filename}):`, error);
          continue;
        }

        // Dosyayı ZIP'e ekle (orijinal dosya adıyla)
        zip.file(file.original_filename, data);

        processedFiles++;
        if (onProgress) {
          onProgress(processedFiles, totalFiles);
        }
      } catch (error) {
        console.error(`Dosya işleme hatası (${file.original_filename}):`, error);
      }
    }

    // ZIP dosyasını oluştur
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // ZIP dosyasını indir
    const link = document.createElement("a");
    const url = URL.createObjectURL(zipBlob);

    link.setAttribute("href", url);
    link.setAttribute("download", zipFilename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // URL'i temizle
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("ZIP oluşturma hatası:", error);
    throw error;
  }
}

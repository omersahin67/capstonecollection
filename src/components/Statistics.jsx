// İstatistikler component'i
// Toplam dosya sayısı ve kişi bazında istatistikleri gösterir

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import "./Statistics.css";

function Statistics({ refreshKey = 0 }) {
  const { t } = useLanguage();
  // Takım üyeleri listesi
  const teamMembers = ["Ömer", "Hüseyin", "Hossein", "Celina", "Faruk"];

  // Duygu seçenekleri
  const emotions = ["Mutlu", "Üzgün", "Kızgın", "Korkulu", "Şaşkın", "Nötr"];

  // Hedef: 250 klip
  const TARGET_CLIPS = 250;

  // State'ler
  const [stats, setStats] = useState({
    totalFiles: 0,
    memberStats: {}, // Kişi bazında toplam dosya sayısı
    memberEmotionStats: {}, // Kişi bazında duygu dağılımı
    emotionStats: {}, // Genel duygu istatistikleri
  });
  const [loading, setLoading] = useState(true);

  // İstatistikleri yükle
  useEffect(() => {
    loadStatistics();
  }, [refreshKey]); // refreshKey değiştiğinde yeniden yükle

  const loadStatistics = async () => {
    setLoading(true);
    try {
      // Tüm dosyaları çek (uploaded_by ve emotion bilgileriyle)
      const { data: files, error } = await supabase
        .from("audio_files")
        .select("uploaded_by, emotion");

      if (error) throw error;

      // Toplam dosya sayısı
      const totalFiles = files?.length || 0;

      // Kişi bazında toplam sayım
      const memberStats = {};
      teamMembers.forEach((member) => {
        memberStats[member] = 0;
      });

      // Kişi bazında duygu dağılımı
      const memberEmotionStats = {};
      teamMembers.forEach((member) => {
        memberEmotionStats[member] = {
          Mutlu: 0,
          Üzgün: 0,
          Kızgın: 0,
          Korkulu: 0,
          Şaşkın: 0,
          Nötr: 0,
        };
      });

      // Genel duygu istatistikleri
      const emotionStats = {
        Mutlu: 0,
        Üzgün: 0,
        Kızgın: 0,
        Korkulu: 0,
        Şaşkın: 0,
        Nötr: 0,
      };

      // Her dosyayı say
      files?.forEach((file) => {
        const uploader = file.uploaded_by?.trim();
        const emotion = file.emotion?.trim();

        // Kişi bazında toplam sayım
        if (uploader && memberStats.hasOwnProperty(uploader)) {
          memberStats[uploader]++;
        }

        // Kişi bazında duygu sayımı
        if (uploader && emotion && memberEmotionStats[uploader]) {
          if (memberEmotionStats[uploader].hasOwnProperty(emotion)) {
            memberEmotionStats[uploader][emotion]++;
          }
        }

        // Genel duygu sayımı
        if (emotion && emotionStats.hasOwnProperty(emotion)) {
          emotionStats[emotion]++;
        }
      });

      setStats({
        totalFiles,
        memberStats,
        memberEmotionStats,
        emotionStats,
      });
    } catch (error) {
      console.error("İstatistikler yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="statistics-container">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  // Hedef progress hesaplama
  const progressPercentage = Math.min(
    (stats.totalFiles / TARGET_CLIPS) * 100,
    100
  );
  const remainingClips = Math.max(TARGET_CLIPS - stats.totalFiles, 0);

  return (
    <div className="statistics-container">
      <h2>📊 {t("statistics.title")}</h2>

      {/* Hedef Progress Bar */}
      <div className="target-progress-section">
        <div className="target-header">
          <h3>🎯 {t("statistics.targetClips")}</h3>
          <div className="target-numbers">
            <span className="current-count">{stats.totalFiles}</span>
            <span className="separator">/</span>
            <span className="target-count">{TARGET_CLIPS}</span>
          </div>
        </div>
        <div className="target-progress-bar">
          <div
            className="target-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          >
            <span className="progress-text">
              %{progressPercentage.toFixed(1)}
            </span>
          </div>
        </div>
        <p className="remaining-text">
          {remainingClips > 0
            ? `${t("common.loading")}: ${remainingClips} ${t("statistics.files")}`
            : "🎉 " + t("statistics.targetClips") + "!"}
        </p>
      </div>

      {/* Toplam dosya sayısı */}
      <div className="stat-card total-card">
        <div className="stat-icon">📁</div>
        <div className="stat-content">
          <h3>{t("statistics.totalFiles")}</h3>
          <p className="stat-number">{stats.totalFiles}</p>
        </div>
      </div>

      {/* Genel Duygu İstatistikleri */}
      <div className="emotion-stats-section">
        <h3>🎭 {t("statistics.generalEmotionStats")}</h3>
        <div className="emotion-stats-grid">
          {emotions.map((emotion) => {
            const count = stats.emotionStats[emotion] || 0;
            const percentage =
              stats.totalFiles > 0
                ? ((count / stats.totalFiles) * 100).toFixed(1)
                : 0;

            return (
              <div key={emotion} className="emotion-stat-card">
                <div className="emotion-name">{t(`emotions.${emotion}`)}</div>
                <div className="emotion-count">
                  <span className="count-number">{count}</span>
                  <span className="count-label">{t("statistics.files")}</span>
                </div>
                <div className="emotion-percentage">%{percentage}</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kişi bazında istatistikler */}
      <div className="member-stats-section">
        <h3>{t("statistics.memberStats")}</h3>
        <div className="member-stats-grid">
          {teamMembers.map((member) => {
            const count = stats.memberStats[member] || 0;
            const percentage =
              stats.totalFiles > 0
                ? ((count / stats.totalFiles) * 100).toFixed(1)
                : 0;

            // Kişinin duygu dağılımı
            const memberEmotions = stats.memberEmotionStats[member] || {};

            // Duygu emojileri
            const emotionEmojis = {
              Mutlu: "😊",
              Üzgün: "😢",
              Kızgın: "😠",
              Korkulu: "😨",
              Şaşkın: "😲",
              Nötr: "😐",
            };

            return (
              <div key={member} className="stat-card member-card">
                <div className="member-name">{member}</div>
                <div className="member-count">
                  <span className="count-number">{count}</span>
                  <span className="count-label">{t("statistics.files")}</span>
                </div>
                <div className="member-percentage">
                  %{percentage} ({count}/{stats.totalFiles})
                </div>
                
                {/* Duygu Detayları - Tüm 6 Duygu */}
                <div className="member-emotion-details">
                  {emotions.map((emotion) => {
                    const emotionCount = memberEmotions[emotion] || 0;
                    return (
                      <div key={emotion} className="emotion-detail-item">
                        <span className="emotion-label">
                          {emotionEmojis[emotion]} {t(`emotions.${emotion}`)}:
                        </span>
                        <span className="emotion-value">{emotionCount}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Statistics;

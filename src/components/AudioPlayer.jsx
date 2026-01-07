// Ses oynatıcı component'i
// Ses dosyalarını oynatmak, ses seviyesini kontrol etmek ve waveform görselleştirme için

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  extractWaveform,
  drawWaveformProgress,
} from "../utils/audioVisualization";
import "./AudioPlayer.css";

function AudioPlayer({ audioUrl, fileName }) {
  const { t } = useLanguage();
  const audioRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const waveformContainerRef = useRef(null);
  const [volume, setVolume] = useState(1); // 0-1 arası (0 = sessiz, 1 = maksimum)
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveform, setWaveform] = useState(null);
  const [waveformLoading, setWaveformLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Ses seviyesini güncelle
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Waveform yükleme
  useEffect(() => {
    if (!audioUrl) return;

    setWaveformLoading(true);
    setWaveform(null);
    
    extractWaveform(audioUrl, 300)
      .then((data) => {
        setWaveform(data);
        setWaveformLoading(false);
      })
      .catch((error) => {
        console.error("Waveform yükleme hatası:", error);
        setWaveformLoading(false);
      });
  }, [audioUrl]);

  // Audio zamanlayıcı güncellemesi
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (waveform && waveformCanvasRef.current) {
        const progress = duration > 0 ? audio.currentTime / duration : 0;
        drawWaveformProgress(waveformCanvasRef.current, waveform, progress);
      }
    };

    const updateDuration = () => {
      setDuration(audio.duration || 0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [waveform, duration]);

  // Waveform çizme (ilk yükleme ve duration yüklendiğinde)
  useEffect(() => {
    if (waveform && waveformCanvasRef.current) {
      const audio = audioRef.current;
      let progress = 0;
      if (audio && duration > 0) {
        progress = audio.currentTime / duration;
      }
      // Waveform yüklendiğinde hemen çiz (progress 0 ile)
      drawWaveformProgress(waveformCanvasRef.current, waveform, progress);
    }
  }, [waveform, duration]);

  // Oynatma durumunu takip et
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Play/Pause toggle
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  // Waveform'a tıklayınca seek
  const handleWaveformClick = (e) => {
    const audio = audioRef.current;
    const container = waveformContainerRef.current;
    if (!audio || !container || duration === 0) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Zaman formatı (mm:ss)
  const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Ses arttırma
  const increaseVolume = () => {
    setVolume((prev) => Math.min(1, prev + 0.1));
  };

  // Ses azaltma
  const decreaseVolume = () => {
    setVolume((prev) => Math.max(0, prev - 0.1));
  };

  // Audio element'i sıfırla (her yeni URL için)
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(0);
    }
  }, [audioUrl]);

  return (
    <div className="audio-player-wrapper">
      <div className="audio-player-container">
        {/* Gizli audio element (controls yok) */}
        <audio 
          ref={audioRef} 
          className="audio-player-hidden"
          key={audioUrl}
          preload="metadata"
        >
          <source src={audioUrl} type="audio/wav" />
          <source src={audioUrl} type="audio/mpeg" />
          {t("audioPlayer.audioNotSupported")}
        </audio>

        {/* Custom Waveform Progress Bar */}
        <div className="custom-player-controls">
          {/* Play/Pause Butonu */}
          <button 
            className="play-pause-button"
            onClick={togglePlayPause}
            aria-label={isPlaying ? t("audioPlayer.pause") : t("audioPlayer.play")}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          {/* Waveform Container */}
          <div 
            className="waveform-progress-container"
            ref={waveformContainerRef}
            onClick={handleWaveformClick}
          >
            {waveformLoading ? (
              <div className="waveform-loading">{t("audioPlayer.waveformLoading")}</div>
            ) : waveform ? (
              <canvas
                ref={waveformCanvasRef}
                className="waveform-progress-canvas"
              />
            ) : (
              <div className="waveform-error">{t("audioPlayer.waveformError")}</div>
            )}
          </div>

          {/* Zaman Göstergesi */}
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span className="time-separator">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      
      {/* Ses Kontrol Butonları */}
      <div className="volume-controls">
          <button
            onClick={decreaseVolume}
            className="volume-button volume-decrease"
            title={t("audioPlayer.decreaseVolume")}
            disabled={volume === 0}
          >
            🔉
          </button>
          <div className="volume-display">
            <span className="volume-label">{t("audioPlayer.volume")}:</span>
            <span className="volume-value">{Math.round(volume * 100)}%</span>
          </div>
          <button
            onClick={increaseVolume}
            className="volume-button volume-increase"
            title={t("audioPlayer.increaseVolume")}
            disabled={volume === 1}
          >
            🔊
          </button>
      </div>
    </div>
  );
}

export default AudioPlayer;

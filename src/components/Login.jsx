// Giriş sayfası component'i
// Kullanıcıların email ve şifre ile giriş yapmasını sağlar

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../contexts/LanguageContext";
import LanguageSelector from "./LanguageSelector";
import "./Login.css";

function Login({ onLoginSuccess }) {
  const { t } = useLanguage();
  // Form state'leri (input değerleri)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // Yükleme durumu
  const [error, setError] = useState(""); // Hata mesajı

  // Giriş yapma fonksiyonu
  const handleLogin = async (e) => {
    e.preventDefault(); // Form'un varsayılan submit davranışını engelle
    setLoading(true);
    setError("");

    try {
      // Supabase ile giriş yap
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error; // Hata varsa fırlat

      // Başarılı giriş
      console.log("Giriş başarılı:", data);
      onLoginSuccess(); // Ana sayfaya yönlendir
    } catch (error) {
      // Hata durumu
      console.error("Giriş hatası:", error);
      setError(error.message || t("login.error"));
    } finally {
      setLoading(false); // Yükleme durumunu kapat
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <LanguageSelector />
        <h1>{t("fileList.title")}</h1>
        <h2>{t("login.title")}</h2>

        {/* Hata mesajı göster */}
        {error && <div className="error-message">{error}</div>}

        {/* Giriş formu */}
        <form onSubmit={(e) => { e.preventDefault(); }}>
          <div className="form-group">
            <label htmlFor="email">{t("login.email")}:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t("login.password")}:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login.passwordPlaceholder")}
              required
              disabled={loading}
            />
          </div>

          <button type="button" onClick={handleLogin} disabled={loading} className="login-button">
            {loading ? t("login.loggingIn") : t("login.loginButton")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;

// Dil seçici component
import { useLanguage } from "../contexts/LanguageContext";
import "./LanguageSelector.css";

function LanguageSelector() {
  const { language, changeLanguage, t } = useLanguage();

  return (
    <div className="language-selector">
      <label htmlFor="language-select">{t("language.selectLanguage")}:</label>
      <select
        id="language-select"
        value={language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-select"
      >
        <option value="tr">{t("language.turkish")}</option>
        <option value="en">{t("language.english")}</option>
      </select>
    </div>
  );
}

export default LanguageSelector;

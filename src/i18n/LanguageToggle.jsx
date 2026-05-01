import React from "react";
import { useLanguage } from "./LanguageContext";
import "./LanguageToggle.css";

/**
 * Compact EN/AR pill toggle. Click to switch.
 * Place anywhere; styled to fit alongside topbar action buttons.
 */
export default function LanguageToggle({ className = "" }) {
  const { lang, toggleLang } = useLanguage();
  const isAr = lang === "ar";

  return (
    <button
      type="button"
      className={`lang-toggle ${className}`}
      data-no-translate="true"
      onClick={toggleLang}
      aria-label={isAr ? "Switch to English" : "تبديل إلى العربية"}
      title={isAr ? "Switch to English" : "Switch to Arabic"}
    >
      <span className={`lang-toggle-pill ${isAr ? "lang-toggle-pill--ar" : ""}`}>
        <span className="lang-toggle-opt lang-toggle-opt--en">EN</span>
        <span className="lang-toggle-opt lang-toggle-opt--ar">ع</span>
        <span className="lang-toggle-knob" />
      </span>
    </button>
  );
}

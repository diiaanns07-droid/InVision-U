"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint =
        mode === "register" ? "/api/auth/register" : "/api/auth/login";

      const payload =
        mode === "register"
          ? { email, password, fullName }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка");
        setLoading(false);
        return;
      }

      localStorage.setItem("userId", data.user.id);
      localStorage.setItem("userEmail", data.user.email ?? "");
      localStorage.setItem("userName", data.user.profile?.fullName ?? "");

      router.push("/");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setError("");
    setFullName("");
    setEmail("");
    setPassword("");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .au-root {
          min-height: 100svh;
          background: #f5f4f0;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .au-bg-circle1 {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: #CDFF00;
          opacity: 0.10;
          top: -220px;
          left: -170px;
          pointer-events: none;
        }

        .au-bg-circle2 {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          background: #000;
          opacity: 0.04;
          bottom: -120px;
          right: -100px;
          pointer-events: none;
        }

        .au-header {
          position: relative;
          z-index: 10;
          padding: 20px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(245,244,240,0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(0,0,0,0.07);
        }

        .au-logo {
          display: flex;
          align-items: baseline;
          gap: 1px;
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .au-logo-black { color: #0a0a0a; }
        .au-logo-lime { color: #CDFF00; }

        .au-header-tag {
          font-size: 12px;
          font-weight: 500;
          color: rgba(0,0,0,0.4);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

         .au-main {
        flex: 1;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 48px 24px 40px;
        position: relative;
        z-index: 1;
      }

        .au-grid {
          display: grid;
          width: 100%;
          max-width: 1180px;
          gap: 24px;
          grid-template-columns: 1fr;
          align-items: stretch;
        }

        @media (min-width: 980px) {
          .au-grid {
            grid-template-columns: 460px minmax(0, 1fr);
          }
        }

        .au-panel {
          background: #CDFF00;
          border-radius: 32px;
          padding: 40px;
          position: relative;
          overflow: hidden;
          min-height: 520px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transform: translateY(${mounted ? "0" : "16px"});
          opacity: ${mounted ? "1" : "0"};
          transition: transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.6s ease;
        }

        .au-panel-deco {
          position: absolute;
          top: -60px;
          right: -60px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          border: 40px solid rgba(0,0,0,0.06);
          pointer-events: none;
        }

        .au-panel-deco2 {
          position: absolute;
          bottom: 30px;
          right: 30px;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.12);
          pointer-events: none;
        }

        .au-panel-deco3 {
          position: absolute;
          bottom: 50px;
          right: 58px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(0,0,0,0.08);
          pointer-events: none;
        }

        .au-panel-tag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.5);
          margin-bottom: 18px;
          position: relative;
          z-index: 1;
        }

        .au-panel-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(44px, 5vw, 64px);
          font-weight: 800;
          line-height: 0.95;
          letter-spacing: -0.05em;
          color: #0a0a0a;
          position: relative;
          z-index: 1;
          max-width: 360px;
          word-break: keep-all;
        }

        .au-panel-desc {
          margin-top: 22px;
          font-size: 16px;
          line-height: 1.65;
          color: rgba(0,0,0,0.68);
          max-width: 330px;
          position: relative;
          z-index: 1;
        }

        .au-panel-card {
          margin-top: 32px;
          background: rgba(255,255,255,0.38);
          border: 1px solid rgba(0,0,0,0.08);
          backdrop-filter: blur(4px);
          border-radius: 22px;
          padding: 18px 22px;
          position: relative;
          z-index: 1;
        }

        .au-panel-card-label {
          font-size: 12px;
          color: rgba(0,0,0,0.5);
          font-weight: 500;
          margin-bottom: 6px;
        }

        .au-panel-card-value {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #0a0a0a;
          letter-spacing: -0.03em;
        }

        .au-panel-footer {
          margin-top: 28px;
          font-size: 13px;
          color: rgba(0,0,0,0.45);
          position: relative;
          z-index: 1;
        }

        .au-form-card {
          background: #fff;
          border-radius: 32px;
          border: 1px solid rgba(0,0,0,0.07);
          padding: 36px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
          transform: translateY(${mounted ? "0" : "16px"});
          opacity: ${mounted ? "1" : "0"};
          transition: transform 0.6s 0.1s cubic-bezier(0.16,1,0.3,1), opacity 0.6s 0.1s ease;
        }

        .au-tabs {
          background: #f2f1ee;
          border-radius: 100px;
          padding: 4px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin-bottom: 28px;
        }

        .au-tab {
          border: none;
          background: transparent;
          border-radius: 100px;
          padding: 12px 20px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
          color: rgba(0,0,0,0.5);
        }

        .au-tab:hover {
          color: rgba(0,0,0,0.8);
        }

        .au-tab.active {
          background: #0a0a0a;
          color: #fff;
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        }

        .au-form-heading {
          font-family: 'Syne', sans-serif;
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #0a0a0a;
          line-height: 1;
          margin-bottom: 8px;
        }

        .au-form-sub {
          font-size: 14px;
          color: rgba(0,0,0,0.45);
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .au-field {
          position: relative;
          margin-bottom: 16px;
        }

        .au-field label {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: rgba(0,0,0,0.38);
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
          padding: 0 4px;
          background: transparent;
          z-index: 1;
          font-weight: 400;
        }

        .au-field.has-value label,
        .au-field.is-focused label {
          top: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: rgba(0,0,0,0.55);
          background: #fff;
        }

        .au-field.is-focused label {
          color: #0a0a0a;
        }

        .au-input {
          width: 100%;
          border: 1.5px solid rgba(0,0,0,0.1);
          border-radius: 16px;
          background: #fafaf9;
          padding: 18px 18px 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          color: #0a0a0a;
          outline: none;
          transition: all 0.2s ease;
          appearance: none;
        }

        .au-input:hover {
          border-color: rgba(0,0,0,0.2);
          background: #f7f7f5;
        }

        .au-input:focus {
          border-color: #0a0a0a;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(0,0,0,0.06);
        }

        .au-error {
          background: #fff1f0;
          border: 1px solid rgba(220,60,40,0.18);
          border-radius: 14px;
          padding: 12px 16px;
          font-size: 13px;
          color: #c0392b;
          margin-bottom: 16px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .au-error::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #c0392b;
          flex-shrink: 0;
        }

        .au-btn {
          width: 100%;
          border: none;
          background: #0a0a0a;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 700;
          border-radius: 100px;
          padding: 17px 28px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
          position: relative;
          overflow: hidden;
          letter-spacing: -0.01em;
          margin-top: 4px;
        }

        .au-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: #CDFF00;
          opacity: 0;
          transition: opacity 0.25s ease;
          border-radius: inherit;
        }

        .au-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.22);
        }

        .au-btn:hover:not(:disabled)::after {
          opacity: 0.08;
        }

        .au-btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .au-btn-inner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .au-btn-loader {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .au-form-hint {
          margin-top: 14px;
          font-size: 12px;
          color: rgba(0,0,0,0.35);
          text-align: center;
          line-height: 1.5;
        }

        @media (max-width: 979px) {
          .au-panel {
            min-height: auto;
          }

          .au-panel-title {
            max-width: 100%;
            font-size: clamp(40px, 10vw, 56px);
          }

          .au-panel-desc {
            max-width: 100%;
          }
        }
      `}</style>

      <div className="au-root">
        <div className="au-bg-circle1" />
        <div className="au-bg-circle2" />

        <header className="au-header">
          <div className="au-logo">
            <span className="au-logo-black">inVision</span>
            <span className="au-logo-lime">U</span>
          </div>
          <span className="au-header-tag">Admissions Portal</span>
        </header>

        <main className="au-main">
          <div className="au-grid">
            <div className="au-panel">
              <div className="au-panel-deco" />
              <div className="au-panel-deco2" />
              <div className="au-panel-deco3" />

              <div>
                <p className="au-panel-tag">
                  {mode === "register" ? "Новый аккаунт" : "Добро пожаловать"}
                </p>

                <h1 className="au-panel-title">
                  {mode === "register" ? (
                    <>
                      Создай
                      <br />
                      аккаунт
                    </>
                  ) : (
                    <>
                      Вход
                      <br />
                      в аккаунт
                    </>
                  )}
                </h1>

                <p className="au-panel-desc">
                  {mode === "register"
                    ? "Начни подачу заявки в inVision U и открой доступ к следующему этапу своей карьеры."
                    : "Войди в свой аккаунт и продолжи заявку с того места, где остановился."}
                </p>
              </div>

              <div>
                <div className="au-panel-card">
                  <p className="au-panel-card-label">
                    {mode === "register" ? "Следующий шаг" : "Твоя заявка ждёт"}
                  </p>
                  <p className="au-panel-card-value">
                    {mode === "register" ? "Подача материалов →" : "Личный кабинет →"}
                  </p>
                </div>
                <p className="au-panel-footer">inVision U — future starts here</p>
              </div>
            </div>

            <div className="au-form-card">
              <div className="au-tabs">
                <button
                  type="button"
                  className={`au-tab${mode === "register" ? " active" : ""}`}
                  onClick={() => switchMode("register")}
                >
                  Регистрация
                </button>
                <button
                  type="button"
                  className={`au-tab${mode === "login" ? " active" : ""}`}
                  onClick={() => switchMode("login")}
                >
                  Вход
                </button>
              </div>

              <h2 className="au-form-heading">
                {mode === "register" ? "Регистрация" : "Вход"}
              </h2>

              <p className="au-form-sub">
                {mode === "register"
                  ? "Заполни данные, чтобы создать аккаунт"
                  : "Введи свои данные, чтобы войти"}
              </p>

              <form onSubmit={handleSubmit}>
                {mode === "register" && (
                  <div
                    className={`au-field${fullName ? " has-value" : ""}${focused === "name" ? " is-focused" : ""}`}
                  >
                    <label htmlFor="fullName">Имя</label>
                    <input
                      id="fullName"
                      type="text"
                      className="au-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onFocus={() => setFocused("name")}
                      onBlur={() => setFocused(null)}
                      required
                    />
                  </div>
                )}

                <div
                  className={`au-field${email ? " has-value" : ""}${focused === "email" ? " is-focused" : ""}`}
                >
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="au-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    required
                  />
                </div>

                <div
                  className={`au-field${password ? " has-value" : ""}${focused === "pwd" ? " is-focused" : ""}`}
                >
                  <label htmlFor="password">Пароль</label>
                  <input
                    id="password"
                    type="password"
                    className="au-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused("pwd")}
                    onBlur={() => setFocused(null)}
                    required
                  />
                </div>

                {error && <div className="au-error">{error}</div>}

                <button type="submit" disabled={loading} className="au-btn">
                  <span className="au-btn-inner">
                    {loading && <span className="au-btn-loader" />}
                    {loading
                      ? "Загрузка..."
                      : mode === "register"
                      ? "Создать аккаунт"
                      : "Войти"}
                  </span>
                </button>

                <p className="au-form-hint">
                  {mode === "register"
                    ? "После регистрации ты сразу перейдёшь к подаче заявки."
                    : "После входа ты вернёшься к своей заявке."}
                </p>
              </form>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
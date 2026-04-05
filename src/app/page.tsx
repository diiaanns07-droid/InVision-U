"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [showFloating, setShowFloating] = useState(false);
  const [userName, setUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const currentHero = heroRef.current;
    if (!currentHero) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloating(!entry.isIntersecting);
      },
      {
        threshold: 0.1,
      }
    );

    observer.observe(currentHero);

    return () => {
      observer.unobserve(currentHero);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch("/api/me", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          setUserName("");
          setIsAdmin(false);
          return;
        }

        const data = await res.json();

        setUserName(data.user?.fullName || data.user?.email || "");
        setIsAdmin(data.user?.role === "ADMIN");
      } catch (error) {
        console.error("fetchMe error:", error);
        setUserName("");
        setIsAdmin(false);
      }
    };

    fetchMe();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("logout error:", error);
    }

    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("user");

    setUserName("");
    setIsAdmin(false);
    router.push("/");
  };

  const handleApplyClick = () => {
    if (!userName) {
      router.push("/register");
      return;
    }

    if (isAdmin) {
      router.push("/admin");
    } else {
      router.push("/applications");
    }
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-black">inVision</span>
            <span className="text-xl font-bold text-[#CDFF00]">U</span>
            <span className="text-[10px] text-gray-500 ml-1 leading-tight">
              Initiative of Arsen Tomsky
              <br />
              powered by inDrive
            </span>
          </div>

          <div className="flex items-center gap-4">
            {userName ? (
              <>
                <span className="hidden md:block text-black font-semibold">
                  {userName}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-black px-4 py-2 text-sm font-medium text-black hover:bg-black hover:text-white transition"
                >
                  Выйти
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push("/register")}
                className="rounded-full border border-black px-4 py-2 text-sm font-medium text-black hover:bg-black hover:text-white transition"
              >
                Войти
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="relative w-full h-[500px] md:h-[600px] overflow-hidden rounded-3xl bg-black">
            <video
              src="/videos/1920x1080_beginIt_loop_10s_IM-837_updtd.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover z-0"
            />

            <div className="absolute inset-0 bg-black/10 z-10" />

            <div
              ref={heroRef}
              className="absolute bottom-5 left-4 max-w-[90%] sm:max-w-[500px] bg-[#CDFF00] p-3 md:p-4 rounded-2xl z-20 shadow-2xl"
            >
              <h1 className="text-2xl md:text-3xl font-black text-black mb-2 leading-tight">
                Открыт прием заявок на программы
              </h1>

              <p className="text-2xl md:text-3xl font-black text-black mb-4 leading-tight">
                <span className="underline">Бакалавриата</span> и{" "}
                <span className="underline">Foundation</span>
              </p>

              <button
                onClick={handleApplyClick}
                className="bg-black text-white px-8 md:px-12 py-4 md:py-5 rounded-full text-lg md:text-xl font-bold hover:scale-105 transition-transform"
              >
                {isAdmin ? "Проверить анкеты" : "Подать заявку"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Big Title */}
      <section className="py-8 px-6 overflow-hidden">
        <div className="max-w-[1400px] mx-auto">
          <h2 className="text-[80px] md:text-[250px] lg:text-[280px] font-bold leading-none tracking-tight">
            <span className="text-[#CDFF00]">inVision</span>{" "}
            <span className="text-[#CDFF00]">U</span>
          </h2>
        </div>
      </section>

      {/* About + Highlights */}
      <section className="py-16 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="flex flex-col md:flex-row gap-6">
              <Image
                src="https://ext.same-assets.com/2108389832/4229503161.png"
                alt="Arsen Tomsky"
                width={140}
                height={140}
                className="rounded-2xl object-cover w-[120px] h-[120px] md:w-[140px] md:h-[140px] shrink-0"
              />

              <div>
                <p className="text-2xl md:text-3xl font-semibold text-black leading-snug mb-4">
                  inVision U — инициатива Арсена Томского, основателя и
                  генерального директора inDrive.
                </p>

                <p className="text-gray-600 text-lg leading-relaxed mb-6 max-w-2xl">
                  Проект создан для подготовки нового поколения лидеров,
                  предпринимателей и создателей решений, которые будут менять
                  свои сообщества и регионы к лучшему.
                </p>

                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-sm text-black">
                    Грантовое обучение
                  </span>
                  <span className="inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-sm text-black">
                    Международное сообщество
                  </span>
                  <span className="inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-sm text-black">
                    Реальные проекты
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#CDFF00] rounded-3xl p-6 md:p-8 shadow-sm">
              <p className="text-sm uppercase tracking-wide text-black/70 mb-4">
                Ключевые возможности
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-4xl md:text-5xl font-black text-black">
                    100%
                  </p>
                  <p className="text-black/70 mt-2">грант на обучение</p>
                </div>

                <div>
                  <p className="text-4xl md:text-5xl font-black text-black">
                    1 год
                  </p>
                  <p className="text-black/70 mt-2">Foundation</p>
                </div>

                <div>
                  <p className="text-4xl md:text-5xl font-black text-black">
                    4 года
                  </p>
                  <p className="text-black/70 mt-2">бакалавриат</p>
                </div>

                <div>
                  <p className="text-4xl md:text-5xl font-black text-black">
                    ∞
                  </p>
                  <p className="text-black/70 mt-2">идей для impact-проектов</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-black/15">
                <p className="text-black text-lg leading-relaxed">
                  Тысячи студентов inVision U из разных стран мира смогут
                  реализовать инновационные идеи на благо своих сообществ.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-8">
            <Image
              src="https://ext.same-assets.com/2108389832/1510151446.svg"
              alt="inDrive logo"
              width={100}
              height={40}
              className="h-8 w-auto"
            />
            <Image
              src="https://ext.same-assets.com/2108389832/1312093559.svg"
              alt="Partner"
              width={100}
              height={40}
              className="h-8 w-auto"
            />
            <Image
              src="https://ext.same-assets.com/2108389832/4248745512.svg"
              alt="Partner"
              width={100}
              height={40}
              className="h-8 w-auto"
            />
          </div>

          <div className="mt-14 grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { label: "Сбор-отбор", value: "-" },
              { label: "Начало обучения для всех студентов", value: "-" },
              { label: "Грант", value: "100%" },
              { label: "Foundation", value: "1 год" },
              { label: "Бакалавриат", value: "4 года" },
            ].map((item, index) => (
              <div key={index} className="border-l-2 border-[#CDFF00] pl-4">
                <p className="text-sm text-gray-500 mb-1">{item.label}</p>
                <p className="text-2xl font-bold text-black">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Students Will Get */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-black mb-8 leading-tight">
                Студенты
                <br />
                получат
              </h2>

              <div className="w-full h-px bg-black mb-8" />

              <p className="text-gray-600 leading-relaxed text-lg mb-10 max-w-xl">
                Грантовое обучение и возможность претендовать на стипендию,
                покрывающую проживание, питание, проезд, а также поддержку
                малообеспеченных студентов.
              </p>

              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 p-6 bg-white hover:shadow-md transition-shadow">
                  <div className="inline-block border border-gray-300 rounded-full px-4 py-2 text-sm mb-4">
                    Наш выпускник
                  </div>
                  <h3 className="text-2xl font-bold text-black mb-3">
                    Лидер, стремящийся к развитию своего сообщества
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Выпускники программы получают не только академические
                    знания, но и навыки лидерства, командной работы и запуска
                    проектов с реальным общественным эффектом.
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 p-6 bg-[#f8f8f8] hover:shadow-md transition-shadow">
                  <div className="inline-block border border-gray-300 rounded-full px-4 py-2 text-sm mb-4">
                    Постоянная поддержка выпускников
                  </div>
                  <h3 className="text-2xl font-bold text-black mb-3">
                    Гранты до 18 месяцев после окончания обучения
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    После окончания обучения будут доступны гранты для проектов
                    с положительным влиянием на развитие региона, чтобы лучшие
                    идеи не остались только на уровне концепции.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <Image
                src="https://cdn.prod.website-files.com/6798ba0f2cbf12d58d36f439/690ca96e4162d50e2a4d2d82_Mask%20group%402x.webp"
                alt="Student speaking"
                width={700}
                height={450}
                className="rounded-3xl object-cover w-full h-[320px] md:h-[360px]"
              />

              <Image
                src="https://ext.same-assets.com/2108389832/959711246.webp"
                alt="inVision U badge"
                width={700}
                height={450}
                className="rounded-3xl object-cover w-full h-[320px] md:h-[360px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-10">
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
              Планы
            </h2>
            <div className="w-full h-px bg-black mb-8" />
            <p className="text-xl md:text-2xl font-semibold text-black max-w-3xl leading-snug">
              В будущем мы планируем открыть сеть из более чем 5 кампусов по
              всему миру, в которых будет обучаться более 2000 студентов
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {[
              "Студенты будут работать в командах и совместно решать региональные и глобальные проблемы.",
              "Используя самые передовые методы обучения, включая проектное обучение, проектирование и критическое мышление, AR/VR-технологии.",
              "Помимо профессиональных и социальных навыков они получат сильные жизненные ценности.",
              "Выпускники останутся в своих странах и регионах, чтобы внести вклад в их развитие.",
            ].map((text, index) => (
              <div
                key={index}
                className="rounded-2xl border border-gray-200 p-5 bg-white hover:shadow-md transition-shadow"
              >
                <p className="text-sm text-[#CDFF00] font-bold mb-3">
                  0{index + 1}
                </p>
                <p className="text-gray-700 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-8 items-center">
            <div className="rounded-3xl bg-[#f8f8f8] p-6 md:p-8">
              <Image
                src="https://ext.same-assets.com/2108389832/3589413537.svg"
                alt="World map"
                width={700}
                height={450}
                className="w-full max-w-[700px]"
              />
            </div>

            <div className="bg-[#CDFF00] rounded-3xl p-8 md:p-10">
              <p className="text-sm uppercase tracking-wide text-black/70 mb-6">
                Планы на будущее
              </p>

              <div className="space-y-8">
                <div>
                  <p className="text-5xl md:text-6xl font-black text-black">
                    5<sup className="text-white">+</sup>
                  </p>
                  <p className="text-black/70 mt-2 text-lg">
                    кампусов по всему миру
                  </p>
                </div>

                <div>
                  <p className="text-5xl md:text-6xl font-black text-black">
                    &gt;2000
                  </p>
                  <p className="text-black/70 mt-2 text-lg">студентов</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-black/10">
                <p className="text-black leading-relaxed">
                  Международная сеть кампусов позволит объединить студентов из
                  разных регионов и формировать решения, которые будут иметь
                  реальное влияние на местные сообщества.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-[0.6fr_1.4fr] gap-12 items-start mb-14">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-black mb-6">
                Миссия
              </h2>
              <div className="w-24 h-px bg-black" />
            </div>

            <div>
              <p className="text-lg md:text-xl text-gray-700 leading-relaxed max-w-4xl">
                inVision U предоставляет грантовое обучение на бакалавриате,
                основанное на проблемно-ориентированном обучении для молодежи из
                всех социально-экономических слоев. inVision U опирается на
                широкий спектр подходов — от гуманитарных и творческих до
                инженерии и дизайна, формируя выпускников, способных развивать и
                выражать идеи, основанные на реальных проблемах, с которыми
                сталкивается общество, и обладающих инструментами, желанием и
                ценностями для улучшения мира как индивидуумы и как часть
                мультидисциплинарных команд.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <Image
              src="/images/690ca96ce1592f7961436f78_Mask group3@2x.webp"
              alt="Team photo"
              width={700}
              height={450}
              className="rounded-3xl object-cover w-full h-[320px] md:h-[420px]"
            />

            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-200 p-6 md:p-8 bg-white">
                <p className="text-sm uppercase tracking-wide text-gray-500 mb-4">
                  После обучения
                </p>
                <p className="text-2xl md:text-3xl font-bold text-black leading-snug mb-4">
                  Выпускники получают поддержку, чтобы превращать идеи в реальные
                  проекты
                </p>
                <p className="text-gray-600 leading-relaxed">
                  После окончания университета выпускники могут получить
                  финансовую поддержку и наставничество, чтобы превратить свои
                  идеи в коммерческие компании или некоммерческие проекты. Так
                  они получают возможность оставаться в своих сообществах и
                  развивать их.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-[#f8f8f8] p-5">
                  <p className="text-sm text-gray-500 mb-2">Фокус</p>
                  <p className="text-xl font-bold text-black">
                    Реальные проблемы
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f8f8f8] p-5">
                  <p className="text-sm text-gray-500 mb-2">Результат</p>
                  <p className="text-xl font-bold text-black">Impact-проекты</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Section */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="lg:w-1/2">
              <Image
                src="https://ext.same-assets.com/2108389832/2678943143.jpeg"
                alt="Team photo"
                width={600}
                height={400}
                className="rounded-2xl object-cover w-full"
              />
            </div>
            <div className="lg:w-1/2">
              <p className="text-gray-600 leading-relaxed mb-4">
                После окончания университета выпускники могут получить финансовую
                поддержку и наставничество, чтобы превратить свои идеи в
                коммерческие компании или некоммерческие проекты. Так они
                получат возможность оставаться в своих сообществах и развивать
                их.
              </p>
            </div>
          </div>

          <div className="mt-20">
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
              Партнёрство
              <br />с Satbayev University
            </h2>
            <div className="w-full h-px bg-black mb-8" />

            <div className="flex flex-col lg:flex-row gap-12 items-start">
              <div className="lg:w-2/3">
                <p className="text-gray-600 leading-relaxed">
                  inVision U — автономный инновационный факультет Института
                  управления проектами имени Э. Туркебаева в Satbayev University.
                  В тесном сотрудничестве со всеми другими институтами Satbayev
                  University факультет выпускает основателей проектов, будущих
                  общественных лидеров и ведущих предпринимателей. Они
                  придумывают и воплощают идеи, основанные на актуальных
                  проблемах людей, и обладают инструментами, мотивацией и
                  ценностями, чтобы менять мир, работая в составе
                  междисциплинарных команд или самостоятельно.
                </p>
              </div>
              <div className="lg:w-1/3">
                <Image
                  src="/images/67b325b8548fb08260904575_logo_eng 1.webp"
                  alt="Satbayev University logo"
                  width={300}
                  height={100}
                  className="w-full max-w-[250px]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Five Components of Mission */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Пять составляющих
            <br />
            миссии
          </h2>
          <div className="w-full h-px bg-black mb-12" />

          <div className="space-y-12">
            {[
              {
                num: "01",
                title: "Доступность",
                text: "Грантовое обучение для всех студентов. Бесплатное проживание, питание и стипендия для тех, кто в этом нуждается. Полностью финансируемый Foundation Year для студентов из малообеспеченных семей и регионов.",
              },
              {
                num: "02",
                title: "Думать по-другому",
                text: "Основная учебная программа строится на обучении через решение практических задач и групповые проекты, сочетая личное развитие с совместным обучением.",
              },
              {
                num: "03",
                title: "Применять знания",
                text: "Пять взаимосвязанных программ объединяют теорию и практику. В выпускном командном проекте студенты должны предложить решение реальной проблемы в обществе.",
              },
              {
                num: "04",
                title: "Сохранять местные таланты",
                text: "Большинство студентов и преподавателей — из того региона, в котором проходит обучение. Поддержка выпускников в постдипломных проектах помогает сохранять кадры, а взаимодействие с другими кампусами inVision U (очно и с помощью AR/VR) даёт связь со всем миром.",
              },
              {
                num: "05",
                title: "Объединить преподавание и исследования",
                text: "Преподаватели и студенты изучают местные и региональные проблемы, создавая решения, которые могут повлиять на политику.",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row gap-8 border-b border-gray-200 pb-8"
              >
                <div className="md:w-48">
                  <p className="text-sm text-gray-400 mb-2">{item.num}</p>
                  <h3 className="text-xl font-bold text-black">{item.title}</h3>
                </div>
                <div className="flex-1">
                  <p className="text-gray-600 leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Are Section */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Кто мы
          </h2>
          <div className="w-full h-px bg-black mb-12" />

          <div className="bg-[#CDFF00] rounded-2xl p-8 md:p-12 mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-black mb-8">
              Ключевая роль
              <br />
              Satbayev University
            </h3>
            <div className="bg-[#CDFF00] border-t border-black/20 pt-8">
              <div className="flex items-start gap-4">
                <span className="text-5xl font-bold text-black leading-none">
                  "
                </span>
                <div>
                  <p className="text-lg font-semibold text-black mb-4">
                    Университет для основателей проектов и будущих общественных
                    лидеров из регионов, где не хватает инновационных
                    образовательных проектов
                  </p>
                  <p className="text-sm text-black/70 mb-6">
                    Арсен Томский, основатель и генеральный директор inDrive
                  </p>
                  <button className="border border-black rounded-full px-6 py-2 text-black font-medium hover:bg-black hover:text-white transition-colors flex items-center gap-2">
                    <span>Смотреть видео</span>
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-16">
            {[
              {
                name: "Эндрю Вахтель",
                role: "Президент",
                img: "/images/67b32e232a376ea5d316a222_67a5ecf52dffc1fb3b8046d8_001.webp",
              },
              {
                name: "Анель Кулахметова",
                role: "Проректор",
                img: "/images/682c76ab14f9cd1015ed7316_provost.webp",
              },
              {
                name: "Анастасия Аммосова",
                role: "Главный операционный директор",
                img: "/images/67b32e2351c2bd1ee26a1b68_67a5ed272974f77f1797c2a3_003.webp",
              },
              {
                name: "Нуркен Аубакир",
                role: "Директор Foundation",
                img: "/images/67b32e23558107e98d5e814f_67a5ed53683db7f0c9a0bbab_004 (1).webp",
              },
              {
                name: "Нурхан Омарбеков",
                role: "Директор по подбору студентов",
                img: "/images/67b32e2365e4641de9c8bcdd_67a5ed7711c2850c6e38f5f4_005 (1).webp",
              },
            ].map((person, index) => (
              <div key={index} className="group relative">
                <div className="relative overflow-hidden rounded-xl">
                  <Image
                    src={person.img}
                    alt={person.name}
                    width={300}
                    height={400}
                    className="w-full aspect-[3/4] object-cover"
                  />
                  <button className="absolute top-4 right-4 w-8 h-8 rounded-full border border-white/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
                <div className="mt-4">
                  <h4 className="font-bold text-black">{person.name}</h4>
                  <p className="text-sm text-gray-500">{person.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Expert Council */}
      <section className="py-20 px-6">
        <div className="max-w-[1400px] mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Совет экспертов
          </h2>
          <div className="w-full h-px bg-black mb-12" />

          <Image
            src="https://ext.same-assets.com/2108389832/562987824.webp"
            alt="Expert council group photo"
            width={1200}
            height={600}
            className="w-full rounded-2xl object-cover mb-16"
          />

          <div className="space-y-12">
            {[
              {
                name: "Зехра Сейерс",
                desc: "Зехра — турецко-британский структурный биолог. Ранее она занимала должность временного президента Университета Сабанджи и сопредседательствовала в научном консультативном комитете проекта «Синхротронное излучение для экспериментальной науки и приложений на Ближнем Востоке» (SESAME).",
              },
              {
                name: "Стефан Де Спигелейр",
                desc: "Стефан Де Спигелейр почти 10 лет работал аналитиком по вопросам обороны и безопасности в корпорации RAND, а затем занял должность директора по вопросам обороны и безопасности в RAND Europe.",
              },
              {
                name: "Ахмет Эвин",
                desc: "Доктор Эвин — старший научный сотрудник Стамбульского политического центра, профессор Университета Сабанчи, факультета искусств и социальных наук.",
              },
              {
                name: "Дарья Козлова",
                desc: "Дарья — первый проректор Университета ИТМО. Она координирует программу развития университета в рамках Проекта 5-100 и создание системы международной академической деятельности.",
              },
            ].map((expert, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row gap-8 border-b border-gray-200 pb-8"
              >
                <div className="md:w-1/3">
                  <h3 className="text-xl font-bold text-black">
                    {expert.name}
                  </h3>
                </div>
                <div className="md:w-2/3">
                  <p className="text-gray-600 leading-relaxed">{expert.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-20 px-6">
        <div className="max-w-[1400px] mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">
            Свяжитесь с нами любым
            <br />
            удобным способом
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div>
              <p className="text-gray-400 text-sm mb-2">Телефон</p>
              <a
                href="tel:+77710707370"
                className="text-lg font-semibold hover:text-[#CDFF00] transition-colors"
              >
                +7 771 070 73 70
              </a>
              <p className="text-gray-500 text-sm mt-1">
                (на What'sApp принимаются только письменные обращения)
              </p>
              <p className="text-white mt-4">
                Нурхан Омарбеков,
                <br />
                директор по подбору студентов
              </p>
              <p className="text-gray-400 text-sm mt-4">Рабочее время</p>
              <p className="text-white">с 09:00 - 18:00</p>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2">Электронная почта</p>
              <a
                href="mailto:info@invisionu.education"
                className="text-lg font-semibold hover:text-[#CDFF00] transition-colors"
              >
                info@invisionu.education
              </a>
              <p className="text-gray-400 text-sm mt-6 mb-2">
                Следите за нами в социальных сетях
              </p>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:border-[#CDFF00] hover:text-[#CDFF00] transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:border-[#CDFF00] hover:text-[#CDFF00] transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-2">Адрес</p>
              <p className="text-lg font-semibold">
                Кампус университета Сатпаева, ул. Каныша Сатпаева, 22/1
              </p>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <a href="#" className="block hover:text-[#CDFF00] transition-colors">
                  Foundation
                </a>
                <a href="#" className="block hover:text-[#CDFF00] transition-colors">
                  Бакалавриат
                </a>
                <a href="#" className="block hover:text-[#CDFF00] transition-colors">
                  Политика приватности
                </a>
              </div>
              <a
                href="#"
                className="flex items-center gap-2 hover:text-[#CDFF00] transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
                <span>Вернуться наверх</span>
              </a>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-gray-400 text-sm">
              2025 inVision U. Все права защищены.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              inVision U осуществляет образовательную деятельность на основании
              действующей лицензии.
            </p>
          </div>
        </div>
      </footer>

      {/* Floating Apply Button */}
      {showFloating && (
        <div className="fixed bottom-8 right-8 z-50 animate-[fadeInUp_0.3s_ease-out]">
          <button
            onClick={handleApplyClick}
            className="bg-[#CDFF00] text-black px-6 py-3 rounded-full font-bold shadow-lg hover:bg-[#b8e600] transition-all hover:scale-105 flex items-center gap-2"
          >
            <span>{isAdmin ? "Проверить анкеты" : "Подать заявку"}</span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}
    </main>
  );
}
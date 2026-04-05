"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ApplicationModalProps {
  children: React.ReactNode;
}

export default function ApplicationModal({ children }: ApplicationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    program: "bachelor",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSubmitted(true);

    // Reset after showing success
    setTimeout(() => {
      setIsOpen(false);
      setIsSubmitted(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        program: "bachelor",
        message: "",
      });
    }, 2000);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-white p-0 overflow-hidden border-0 rounded-2xl">
        {isSubmitted ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#CDFF00] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black mb-2">
              Заявка отправлена!
            </h3>
            <p className="text-gray-600">
              Мы свяжемся с вами в ближайшее время
            </p>
          </div>
        ) : (
          <>
            <div className="bg-[#CDFF00] px-6 py-5">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-black">
                  Подать заявку
                </DialogTitle>
                <DialogDescription className="text-black/70 mt-1">
                  Заполните форму и мы свяжемся с вами
                </DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-black">
                  Имя и фамилия *
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Введите ваше имя"
                  required
                  className="border-gray-300 focus:border-[#CDFF00] focus:ring-[#CDFF00] rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-black">
                  Электронная почта *
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@mail.com"
                  required
                  className="border-gray-300 focus:border-[#CDFF00] focus:ring-[#CDFF00] rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-black">
                  Телефон *
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+7 (___) ___ __ __"
                  required
                  className="border-gray-300 focus:border-[#CDFF00] focus:ring-[#CDFF00] rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="program" className="text-sm font-medium text-black">
                  Программа обучения
                </Label>
                <select
                  id="program"
                  name="program"
                  value={formData.program}
                  onChange={handleChange}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-white text-black focus:outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00]"
                >
                  <option value="bachelor">Бакалавриат</option>
                  <option value="foundation">Foundation</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium text-black">
                  Сообщение
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Ваш вопрос или комментарий..."
                  rows={3}
                  className="border-gray-300 focus:border-[#CDFF00] focus:ring-[#CDFF00] rounded-lg resize-none"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black hover:bg-black/90 text-white font-semibold py-3 rounded-full transition-all duration-200 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Отправка...
                  </span>
                ) : (
                  "Отправить заявку"
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

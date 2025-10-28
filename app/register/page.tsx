"use client";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";

import { auth, db } from "@/lib/firebaseConfig";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import type { FirebaseError } from "firebase/app";

// ---------- helpers ----------
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const isValidEmail = (value: string): boolean => emailRegex.test(value);
const MIN_PASSWORD_LEN = 6;

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  gender?: string;
  file?: string;
};

export default function RegisterPage() {
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const router = useRouter();

  const clientValidate = (): boolean => {
    const next: FieldErrors = {};

    if (!fullName.trim()) next.fullName = "กรุณากรอกชื่อ-สกุล";
    if (!email.trim()) next.email = "กรุณากรอกอีเมล";
    else if (!isValidEmail(email.trim())) next.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!password) next.password = "กรุณากรอกรหัสผ่าน";
    else if (password.length < MIN_PASSWORD_LEN)
      next.password = `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LEN} ตัวอักษร`;
    if (!gender) next.gender = "กรุณาเลือกเพศ";
    if (fileError) next.file = fileError;

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientValidate()) return;

    setSubmitting(true);

    let imageUrl: string | null = null;

 
    try {
      if (imageFile) {
        const safeName = imageFile.name.replace(/\s+/g, "_");
        const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const objectName = `${unique}_${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from("user_bk")
          .upload(objectName, imageFile, {
            upsert: true,
            contentType: imageFile.type,
            cacheControl: "3600",
          });
        if (uploadErr) throw uploadErr;

        const { data: pub } = supabase.storage.from("user_bk").getPublicUrl(objectName);
        imageUrl = pub?.publicUrl ?? null;
      }
    } catch (err) {
      const error = err as Error;
      console.warn("Upload image error:", error?.message || error);
      
    }

    try {
     
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      
      await updateProfile(cred.user, {
        displayName: fullName.trim(),
        photoURL: imageUrl || undefined,
      });

     
      await setDoc(doc(db, "user_tb", cred.user.uid), {
        userId: cred.user.uid,
        fullname: fullName.trim(),
        email: email.trim(),
        gender,
        user_image_url: imageUrl,
        createdAt: serverTimestamp(),
      });

      alert("ลงทะเบียนสำเร็จ");
      router.push("/login");
    } catch (e) {
      const err = e as FirebaseError;
    
      let msg = "เกิดข้อผิดพลาดระหว่างลงทะเบียน";
      switch (err.code) {
        case "auth/email-already-in-use":
          msg = "อีเมลนี้ถูกใช้แล้ว";
          break;
        case "auth/invalid-email":
          msg = "รูปแบบอีเมลไม่ถูกต้อง";
          break;
        case "auth/weak-password":
          msg = `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LEN} ตัวอักษร`;
          break;
        case "auth/operation-not-allowed":
          msg = "ยังไม่ได้เปิด Email/Password ใน Firebase Auth";
          break;
        case "auth/network-request-failed":
          msg = "เครือข่ายขัดข้อง ลองใหม่อีกครั้ง";
          break;
        default:
          msg = err.message || msg;
      }
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);
    setErrors((prev) => ({ ...prev, file: undefined }));

    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        const msg = "ขนาดไฟล์ต้องไม่เกิน 10 MB";
        setFileError(msg);
        setImagePreview(null);
        setImageFile(null);
        setErrors((prev) => ({ ...prev, file: msg }));
        return;
      }
      if (!["image/png", "image/jpeg"].includes(file.type)) {
        const msg = "รองรับเฉพาะไฟล์ PNG และ JPG";
        setFileError(msg);
        setImagePreview(null);
        setImageFile(null);
        setErrors((prev) => ({ ...prev, file: msg }));
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
      setImageFile(null);
    }
  };

  const handleClearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    setFileError(null);
    setErrors((prev) => ({ ...prev, file: undefined }));
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 p-4 font-sans text-center text-gray-100">
      <div className="relative flex w-full max-w-lg flex-col items-center justify-center rounded-2xl bg-gray-800/60 p-8 shadow-2xl backdrop-blur-md">
        <Link
          href="/"
          className="absolute left-4 top-4 text-gray-300 transition-colors hover:text-gray-100"
          aria-label="Back to Home"
        >
          <ArrowLeft size={24} />
        </Link>

        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-gray-100 sm:text-4xl">
          Register
        </h1>

        <form onSubmit={handleRegister} className="w-full space-y-4">
          <div>
            <input
              type="text"
              placeholder="ชื่อ-สกุล"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }));
              }}
              className="w-full rounded-md border border-gray-600 bg-gray-700/70 px-4 py-3 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
            {errors.fullName && <p className="mt-1 text-sm text-rose-300">{errors.fullName}</p>}
          </div>

          <div>
            <input
              type="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              className="w-full rounded-md border border-gray-600 bg-gray-700/70 px-4 py-3 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
            {errors.email && <p className="mt-1 text-sm text-rose-300">{errors.email}</p>}
          </div>

          <div>
            <input
              type="password"
              placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
              }}
              className="w-full rounded-md border border-gray-600 bg-gray-700/70 px-4 py-3 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
            {errors.password && <p className="mt-1 text-sm text-rose-300">{errors.password}</p>}
          </div>

          <div>
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                if (errors.gender) setErrors((p) => ({ ...p, gender: undefined }));
              }}
              className="w-full rounded-md border border-gray-600 bg-gray-700/70 px-4 py-3 font-medium text-gray-100 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            >
              <option value="" disabled className="bg-gray-700 text-gray-300">
                เลือกเพศ
              </option>
              <option value="male" className="bg-gray-700 text-gray-100">ชาย</option>
              <option value="female" className="bg-gray-700 text-gray-100">หญิง</option>
              <option value="other" className="bg-gray-700 text-gray-100">อื่นๆ</option>
            </select>
            {errors.gender && <p className="mt-1 text-sm text-rose-300">{errors.gender}</p>}
          </div>

          <div className="flex flex-col items-center justify-center space-y-2">
            {imagePreview ? (
              <div className="relative">
                <Image
                  src={imagePreview}
                  alt="Profile Preview"
                  width={112}
                  height={112}
                  className="h-28 w-28 rounded-full border-4 border-gray-300 object-cover shadow-lg"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute right-0 top-0 rounded-full bg-rose-500 p-1 text-white hover:bg-rose-600 focus:outline-none"
                  aria-label="Cancel image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                       strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-dashed border-gray-500/70 bg-gray-700/40 text-gray-200 shadow-lg">
                  <span className="text-sm font-semibold text-gray-300 text-center">เลือกรูปภาพ</span>
                </div>
              </label>
            )}

            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept="image/png, image/jpeg"
              onChange={handleImageChange}
            />
            {(fileError || errors.file) && (
              <p className="text-sm font-medium text-rose-300">
                {errors.file || fileError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full transform rounded-full px-8 py-3 font-semibold text-gray-100 shadow-md transition duration-300 ease-in-out hover:scale-105 ${
              submitting ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-500 hover:bg-indigo-600"
            }`}
          >
            {submitting ? "กำลังสมัคร..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-300">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="font-semibold text-indigo-400 hover:underline">
            เข้าสู่ระบบที่นี่
          </Link>
        </p>
      </div>
    </main>
  );
}

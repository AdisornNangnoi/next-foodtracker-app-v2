"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseConfig";
import {
  onAuthStateChanged,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

type Gender = "male" | "female" | "other" | "";

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [newPassword, setNewPassword] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [oldImageUrl, setOldImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUserId(u.uid);
      const snap = await getDoc(doc(db, "user_tb", u.uid));
      const data = snap.exists() ? snap.data() : null;
      const fn = (data?.fullname as string) ?? u.displayName ?? "";
      const em = (data?.email as string) ?? u.email ?? "";
      const gd = ((data?.gender as Gender) ?? "") as Gender;
      const img = (data?.user_image_url as string | null) ?? u.photoURL ?? null;
      setFullName(fn);
      setEmail(em);
      setGender(gd);
      setPreviewImage(img ?? null);
      setOldImageUrl(img ?? null);
    });
    return () => unsub();
  }, [router]);

  const urlToPath = (publicUrl: string): string | null => {
    try {
      const u = new URL(publicUrl);
      const marker = `/object/public/user_bk/`;
      const idx = u.pathname.indexOf(marker);
      if (idx === -1) return null;
      return decodeURIComponent(u.pathname.slice(idx + marker.length));
    } catch {
      return null;
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    setImageFile(f);
    setPreviewImage(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!fullName.trim()) {
      alert("กรุณากรอกชื่อ-สกุล");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      alert("รหัสผ่านใหม่ต้องอย่างน้อย 6 ตัว");
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl: string | null = oldImageUrl ?? null;
      let uploadedObjectName: string | null = null;

      if (imageFile) {
        const safe = imageFile.name.replace(/\s+/g, "_");
        const unique = `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from("user_bk")
          .upload(unique, imageFile, {
            upsert: true,
            cacheControl: "3600",
            contentType: imageFile.type,
          });
        if (upErr) {
          alert("อัปโหลดรูปไม่สำเร็จ: " + upErr.message);
          setSaving(false);
          return;
        }
        uploadedObjectName = unique;
        const { data: pub } = supabase.storage
          .from("user_bk")
          .getPublicUrl(unique);
        finalImageUrl = pub.publicUrl;
        if (oldImageUrl) {
          const oldPath = urlToPath(oldImageUrl);
          if (oldPath) await supabase.storage.from("user_bk").remove([oldPath]);
        }
      }

      const user = auth.currentUser;
      if (!user) {
        alert("กรุณาเข้าสู่ระบบใหม่");
        setSaving(false);
        return;
      }

      await updateProfile(user, {
        displayName: fullName.trim(),
        photoURL: finalImageUrl ?? undefined,
      });

      if (newPassword) {
        await updatePassword(user, newPassword);
      }

      await setDoc(
        doc(db, "user_tb", userId),
        {
          userId,
          fullname: fullName.trim(),
          email,
          gender,
          user_image_url: finalImageUrl,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      localStorage.setItem("fullname", fullName.trim());
      if (finalImageUrl) localStorage.setItem("user_image_url", finalImageUrl);
      else localStorage.removeItem("user_image_url");

      setOldImageUrl(finalImageUrl);
      setShowSaveMessage(true);
      setTimeout(() => {
        setShowSaveMessage(false);
        router.push("/dashboard");
      }, 700);
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 p-4 font-sans text-gray-100">
      <div className="absolute left-4 top-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-gray-300 hover:text-gray-100 transition-colors font-semibold"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={20} />
          Back to dashboard
        </Link>
      </div>

      <div className="flex w-full max-w-lg flex-col items-center rounded-2xl bg-gray-800/60 p-8 shadow-2xl backdrop-blur-md border border-gray-700">
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-gray-100 sm:text-4xl">
          Update Profile
        </h1>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="relative">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ชื่อ-สกุล"
              className="w-full rounded-full border border-gray-600 bg-gray-700/70 px-6 py-4 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล"
              className="w-full rounded-full border border-gray-600 bg-gray-700/70 px-6 py-4 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              disabled
            />
          </div>

          <div className="relative">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              className="w-full rounded-full border border-gray-600 bg-gray-700/70 px-6 py-4 font-medium text-gray-100 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="" className="bg-gray-800 text-gray-100" disabled>
                เลือกเพศ
              </option>
              <option value="male" className="bg-gray-800 text-gray-100">
                ชาย
              </option>
              <option value="female" className="bg-gray-800 text-gray-100">
                หญิง
              </option>
              <option value="other" className="bg-gray-800 text-gray-100">
                อื่นๆ
              </option>
            </select>
          </div>

          <div className="relative">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว ถ้าต้องการเปลี่ยน)"
              className="w-full rounded-full border border-gray-600 bg-gray-700/70 px-6 py-4 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex flex-col items-center space-y-4">
            <label className="cursor-pointer">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Profile Preview"
                  className="h-28 w-28 rounded-full border-4 border-gray-300 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-dashed border-gray-500/70 bg-gray-700/40 text-gray-200 shadow-lg">
                  <ImageIcon className="h-10 w-10 opacity-70" />
                </div>
              )}
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full transform rounded-full bg-indigo-500 px-8 py-4 font-semibold text-gray-100 shadow-md transition duration-300 ease-in-out hover:scale-105 hover:bg-indigo-600 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Save size={20} />
            {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
          </button>
        </form>

        {showSaveMessage && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-900/70">
            <div className="rounded-lg bg-indigo-600 px-8 py-6 text-white text-center shadow-lg">
              <p className="font-bold">บันทึกสำเร็จ!</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

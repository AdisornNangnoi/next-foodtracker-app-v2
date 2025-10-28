"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

// ⬇️ Firebase
import { auth, db } from "@/lib/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// ⬇️ Supabase: ใช้แค่ช่วยแปลงเป็น public URL ถ้าเคสเก่าเก็บเป็น objectName
import { supabase } from "@/lib/supabaseClient";

const isExternalUrl = (u?: string | null) => !!u && /^https?:\/\//i.test(u);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLoginClick = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    try {
      // 1) ล็อกอินด้วย Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // 2) โหลดโปรไฟล์จาก Firestore (เก็บไว้ที่ collection: user_tb, docId = uid)
      const snap = await getDoc(doc(db, "user_tb", uid));
      const profile = snap.exists() ? snap.data() : null;

      const fullname = profile?.fullname ?? cred.user.displayName ?? "";

      // 3) จัดการรูปโปรไฟล์
      // - ใน flow สมัครสมาชิกที่เราให้ไป เราเก็บเป็น public URL แล้ว (ใช้ได้ทันที)
      // - เผื่อเคสเก่าที่เก็บเป็น objectName ใน supabase เราจะแปลงเป็น public URL ให้
      let finalAvatarUrl: string | null = profile?.user_image_url ?? null;

      if (finalAvatarUrl && !isExternalUrl(finalAvatarUrl)) {
        // finalAvatarUrl เป็น objectName ของไฟล์ใน bucket "user_bk" -> แปลงเป็น public URL
        const { data: pub } = supabase.storage
          .from("user_bk")
          .getPublicUrl(finalAvatarUrl);
        finalAvatarUrl = pub?.publicUrl || null;
        // ถ้าต้องการ อัปเดต Firestore ให้เป็น publicUrl ถาวร (ไม่บังคับ)
        // await setDoc(doc(db, "user_tb", uid), { user_image_url: finalAvatarUrl }, { merge: true });
      }

      // 4) เก็บลง localStorage (หรือย้ายไปใช้ Context ก็ได้)
      localStorage.setItem("user_id", uid);
      localStorage.setItem("fullname", fullname);
      if (finalAvatarUrl) {
        localStorage.setItem("user_image_url", finalAvatarUrl);
      } else {
        localStorage.removeItem("user_image_url");
      }

      router.push("/dashboard");
    } catch (err) {
      const error = err as Error;
      console.error("Login error:", error?.message || error);
      alert(`ล็อกอินไม่สำเร็จ: ${error?.message || error}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 p-4 font-sans text-center text-gray-100">
      <div className="flex w-full max-w-lg flex-col items-center justify-center rounded-2xl bg-gray-800/60 p-8 shadow-2xl backdrop-blur-md">
        {/* Back to Home Button */}
        <Link
          href="/"
          className="absolute left-4 top-4 text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back to Home"
        >
          <ArrowLeft size={24} />
        </Link>

        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-gray-100 sm:text-4xl">
          Login
        </h1>

        <form onSubmit={handleLoginClick} className="w-full space-y-5">
          <input
            type="email"
            placeholder="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-gray-600 bg-gray-700/70 px-4 py-3 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border border-gray-600 bg-gray-700/70 px-4 py-3 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            className="w-full transform rounded-full bg-indigo-500 px-8 py-3 font-semibold text-gray-100 shadow-md transition duration-300 ease-in-out hover:scale-105 hover:bg-indigo-600"
          >
            Login
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-300">
          ไม่มีบัญชีใช่ไหม?{" "}
          <Link
            href="/register"
            className="font-semibold text-indigo-400 hover:underline"
          >
            ลงทะเบียนที่นี่
          </Link>
        </p>
      </div>
    </main>
  );
}

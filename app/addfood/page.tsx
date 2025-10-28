"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { auth, db } from "@/lib/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function AddFoodPage() {
  const router = useRouter();

  const [foodName, setFoodName] = useState("");
  const [mealType, setMealType] = useState("อาหารเช้า");
  const [foodImage, setFoodImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const mealMap: Record<string, "Breakfast" | "Lunch" | "Dinner" | "Snack"> = {
    "อาหารเช้า": "Breakfast",
    "อาหารกลางวัน": "Lunch",
    "อาหารเย็น": "Dinner",
    "ของว่าง": "Snack",
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
      } else {
        setUserId(u.uid);
      }
    });
    return () => unsub();
  }, [router]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFoodImage(file);
      setPreviewImage(URL.createObjectURL(file));
    } else {
      setFoodImage(null);
      setPreviewImage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!foodName) {
      alert("กรุณากรอกชื่ออาหาร");
      return;
    }
    if (!userId) {
      alert("ยังไม่พบผู้ใช้ กรุณาเข้าสู่ระบบอีกครั้ง");
      return;
    }
    setSaving(true);

    try {
      let imageUrl: string | null = null;
      if (foodImage) {
        const safeName = foodImage.name.replace(/\s+/g, "_");
        const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const objectName = `${unique}_${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from("food_bk")
          .upload(objectName, foodImage, {
            upsert: true,
            contentType: foodImage.type,
            cacheControl: "3600",
          });
        if (uploadErr) {
          alert("อัปโหลดรูปไม่สำเร็จ: " + uploadErr.message);
          setSaving(false);
          return;
        }
        const { data: pub } = supabase.storage.from("food_bk").getPublicUrl(objectName);
        imageUrl = pub.publicUrl || null;
      }

      const today = new Date().toISOString().slice(0, 10);
      await addDoc(collection(db, "food_tb"), {
        foodname: foodName,
        meal: mealMap[mealType] ?? "Breakfast",
        fooddate_at: today,
        food_image_url: imageUrl,
        user_id: userId,
        created_at: serverTimestamp(),
      });

      setShowSaveMessage(true);
      setTimeout(() => {
        setShowSaveMessage(false);
        router.push("/dashboard");
      }, 1000);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e) {
        alert("เกิดข้อผิดพลาด: " + (e as { message: string }).message);
      } else {
        alert("เกิดข้อผิดพลาด: " + String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 p-4 font-sans text-gray-100">
      <div className="absolute left-4 top-4">
        <a
          href="/dashboard"
          className="flex items-center gap-2 text-gray-300 hover:text-gray-100 transition-colors font-semibold"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={20} />
          Back to dashboard
        </a>
      </div>

      <div className="flex w-full max-w-lg flex-col items-center rounded-2xl bg-gray-800/60 p-8 shadow-2xl backdrop-blur-md border border-gray-700">
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-gray-100 sm:text-4xl">
          Add Food list
        </h1>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="relative">
            <input
              type="text"
              id="foodName"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="ชื่ออาหาร"
              className="w-full rounded-full border border-gray-600 bg-gray-700/70 px-6 py-4 font-medium text-gray-100 placeholder-gray-400 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          <div className="relative">
            <select
              id="mealType"
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className="w-full rounded-full border border-gray-600 bg-gray-700/70 px-6 py-4 font-medium text-gray-100 transition duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="อาหารเช้า" className="bg-gray-800 text-gray-100">อาหารเช้า</option>
              <option value="อาหารกลางวัน" className="bg-gray-800 text-gray-100">อาหารกลางวัน</option>
              <option value="อาหารเย็น" className="bg-gray-800 text-gray-100">อาหารเย็น</option>
              <option value="ของว่าง" className="bg-gray-800 text-gray-100">ของว่าง</option>
            </select>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <label htmlFor="foodImage" className="cursor-pointer">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Food Preview"
                  className="h-40 w-40 rounded-2xl border-4 border-gray-300 object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-2xl border-4 border-dashed border-gray-500/70 bg-gray-700/40 text-gray-200 shadow-lg">
                  <span className="text-sm font-semibold text-gray-300 text-center">
                    เลือกรูปภาพ
                  </span>
                </div>
              )}
              <input
                id="foodImage"
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
            {saving ? "กำลังบันทึก..." : "บันทึก"}
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

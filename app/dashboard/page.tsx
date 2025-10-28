"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  PlusCircle,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import profile from "./../images/profile.png";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

// 🔁 Firebase
import { auth, db } from "@/lib/firebaseConfig";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
} from "firebase/firestore";

// --- Types ---
interface FoodLog {
  id: string;
  date: string;
  imageUrl: string;
  name: string;
  meal: "Breakfast" | "Lunch" | "Dinner" | "Snack";
}

type FSRow = {
  id: string;
  foodname?: string;
  meal?: string;
  fooddate_at?: string;
  food_image_url?: string | null;
  user_id?: string;
  created_at?: string;
};

const isExternalUrl = (u?: string | null) => !!u && /^https?:\/\//i.test(u);

export default function Page() {
  const router = useRouter();

  // ===== User (header) =====
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // ===== Foods  =====
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // 🔁 เก็บข้อมูลดิบทั้งหมดจาก Firestore ไว้ทำ client-side search & pagination
  const [allRows, setAllRows] = useState<FoodLog[]>([]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  // ===== Load user (Firebase) =====
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUserId(u.uid);

      let name = localStorage.getItem("fullname") || u.displayName || "User";
      let avatar = localStorage.getItem("user_image_url") || u.photoURL;

      if (!avatar) {
        const snap = await getDoc(doc(db, "user_tb", u.uid));
        if (snap.exists()) {
          const d = snap.data() as {
            fullname?: string;
            user_image_url?: string | null;
          };
          name = d?.fullname ?? name;
          avatar = d?.user_image_url ?? avatar ?? null;
        }
        localStorage.setItem("fullname", name || "");
        if (avatar) localStorage.setItem("user_image_url", avatar);
      }

      setUserName(name);
      setUserAvatar(avatar || null);
    });
    return () => unsub();
  }, [router]);

  // ===== Fetch foods from Firestore, then filter & paginate on client toคง UI เดิม =====
  useEffect(() => {
    if (!userId) return;

    (async () => {
      setLoading(true);
      try {
        // ดึงล่าสุดจำนวนหนึ่ง (เช่น 1000 แรก) ตามวันที่และเวลาสร้าง เพียงพอสำหรับ UI/ค้นหา/แบ่งหน้า
        const qRef = query(
          collection(db, "food_tb"),
          where("user_id", "==", userId),
          orderBy("fooddate_at", "desc"),
          orderBy("created_at", "desc"),
          limit(1000)
        );
        const snap = await getDocs(qRef);

        const list: FoodLog[] = [];
        for (const d of snap.docs) {
          const r = d.data() as FSRow;
          const rawUrl: string | null = r.food_image_url ?? null;
          let imageUrl = "";
          if (isExternalUrl(rawUrl)) {
            imageUrl = rawUrl!;
          } else if (rawUrl) {
            const { data: p } = supabase.storage
              .from("food_bk")
              .getPublicUrl(rawUrl);
            imageUrl = p.publicUrl;
          }
          const dateStr =
            r.fooddate_at ?? new Date().toISOString().slice(0, 10);
          list.push({
            id: d.id,
            date: r.fooddate_at ?? new Date().toISOString().slice(0, 10),
            imageUrl: imageUrl,
            name: r.foodname || "",
            meal: (r.meal as FoodLog["meal"]) || "Breakfast",
          });
        }

        setAllRows(list);
      } catch (e) {
        const err = e as Error;
        console.error("fetch foods (firestore) error:", err?.message || err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ===== Apply search & pagination to keep UI logic เดิม =====
  useEffect(() => {
    const s = searchQuery.trim().toLowerCase();
    const filtered = s
      ? allRows.filter((r) => r.name.toLowerCase().includes(s))
      : allRows;

    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    setTotal(filtered.length);
    setFoods(filtered.slice(from, to));
  }, [allRows, searchQuery, page, pageSize]);

  // ===== Logout (Firebase) =====
  const handleLogout = async () => {
    try {
      await fbSignOut(auth);
    } catch {}
    localStorage.removeItem("user_id");
    localStorage.removeItem("fullname");
    localStorage.removeItem("user_image_url");
    router.push("/login");
  };

  // ===== Delete and refresh current page (Firestore + Supabase Storage) =====
  const handleDelete = async (id: string, oldImageUrl: string | null) => {
    if (!confirm("ต้องการลบหรือไม่?")) return;

    const prevFoods = foods;
    const prevTotal = total;
    const willBeEmptyAfterDelete = foods.length === 1;
    const shouldGoPrevPage = willBeEmptyAfterDelete && page > 1;

    setFoods((list) => list.filter((f) => f.id !== id));
    setAllRows((list) => list.filter((f) => f.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (shouldGoPrevPage) setPage((p) => p - 1);

    try {
      await deleteDoc(doc(db, "food_tb", id));
    } catch (error) {
      console.error("delete food error:", error);
      setFoods(prevFoods);
      setAllRows((list) => {
        // นำ item ที่เพิ่งลบออกไปกลับเข้ามา
        const removed = prevFoods.find((f) => f.id === id);
        return removed ? [removed, ...list] : list;
      });
      setTotal(prevTotal);
      if (shouldGoPrevPage) setPage((p) => p + 1);
      return;
    }

    // ลบไฟล์รูปใน Supabase bucket ถ้ามี
    if (oldImageUrl) {
      let path = oldImageUrl;
      if (/^https?:\/\//i.test(oldImageUrl)) {
        try {
          const u = new URL(oldImageUrl);
          const marker = `/object/public/food_bk/`;
          const idx = u.pathname.indexOf(marker);
          path =
            idx !== -1
              ? decodeURIComponent(u.pathname.slice(idx + marker.length))
              : "";
        } catch {
          path = "";
        }
      }
      if (path) {
        const { error: rmErr } = await supabase.storage
          .from("food_bk")
          .remove([path]);
        if (rmErr) console.warn("remove file error:", rmErr.message);
      }
    }
  };

  // avatar
  const avatarNode =
    isExternalUrl(userAvatar) && userAvatar ? (
      <Image
        src={userAvatar}
        alt="User profile picture"
        width={40}
        height={40}
        className="rounded-full object-cover w-10 h-10 ring-1 ring-gray-600"
        unoptimized
      />
    ) : (
      <Image
        src={profile}
        alt="User profile picture"
        width={40}
        height={40}
        className="rounded-full object-cover w-10 h-10 ring-1 ring-gray-600"
      />
    );

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 text-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-300 hover:text-rose-400 transition-colors"
          aria-label="Logout"
        >
          <LogOut size={20} />
          <span className="hidden sm:inline">Logout</span>
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 text-center">
          My Food Diary
        </h1>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline font-semibold text-gray-300">
            {userName}
          </span>

          {/* ไปหน้า profile */}
          <Link
            href="/profile"
            aria-label="Go to profile"
            className="rounded-full ring-1 ring-transparent hover:ring-indigo-400 transition-shadow"
            title="เปิดหน้าโปรไฟล์"
          >
            {avatarNode}
          </Link>
        </div>
      </div>

      {/* Card */}
      <div className="max-w-7xl mx-auto bg-gray-800/60 backdrop-blur-md rounded-3xl shadow-2xl p-6 border border-gray-700">
        {/* Add + Search */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <Link
            href="/addfood"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-500 text-gray-100 font-bold rounded-lg hover:bg-indigo-600 transition-colors"
          >
            Add Food
            <PlusCircle size={20} />
          </Link>

          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search"
              className="w-full p-3 pl-10 rounded-lg border border-gray-600 bg-gray-700/70 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-900/40">
              <tr>
                <th className="p-3 font-semibold text-gray-200">Date</th>
                <th className="p-3 font-semibold text-gray-200">Food</th>
                <th className="p-3 font-semibold text-gray-200">Meal</th>
                <th className="p-3 text-right font-semibold text-gray-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-6 text-center text-gray-300" colSpan={4}>
                    Loading...
                  </td>
                </tr>
              ) : foods.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-400" colSpan={4}>
                    No food logs found.
                  </td>
                </tr>
              ) : (
                foods.map((food) => (
                  <tr
                    key={food.id}
                    className="border-b border-gray-700/60 hover:bg-gray-700/30"
                  >
                    <td className="p-3 text-gray-200">{food.date}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {/* รูปอาหาร */}
                        {food.imageUrl ? (
                          <Image
                            src={food.imageUrl}
                            alt={food.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-md object-cover ring-1 ring-gray-600"
                            unoptimized
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-700 rounded-md" />
                        )}
                        <span className="font-medium text-gray-100">
                          {food.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-200">{food.meal}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/updatefood/${food.id}`}
                          className="p-2 text-gray-300 hover:text-indigo-400"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(food.id, food.imageUrl)}
                          className="p-2 text-gray-300 hover:text-rose-400"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination + PageSize */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-6">
          <div className="text-sm text-gray-300">
            Showing{" "}
            <span className="font-semibold">
              {foods.length ? (page - 1) * pageSize + 1 : 0}
            </span>
            {"–"}
            <span className="font-semibold">
              {(page - 1) * pageSize + foods.length}
            </span>{" "}
            of <span className="font-semibold">{total}</span>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-gray-600 bg-gray-700/70 text-gray-100 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              title="Items per page"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/70 text-gray-100 border border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-700"
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <span className="text-sm text-gray-300">
                Page <span className="font-semibold">{page}</span> of{" "}
                <span className="font-semibold">{totalPages}</span>
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700/70 text-gray-100 border border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-700"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["100","200","300","400","500","600","700","800","900"],
});

export const metadata: Metadata = {
  title: "Food Tracker App",
  description: "Food Tracker for everybody",
  keywords: ["Food", "Tracker", "อาหาร", "ติดตาม"],
  icons: { icon: "/next.svg", shortcut: "/shortcut.png" },
  authors: [{ name: "Adisorn Nangnoi", url: "https://github.com/AdisornNangnoi" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* ใช้ flex column + min-h-screen เพื่อ “ยึด” footer ไว้ล่างเมื่อคอนเทนต์สั้น โดยไม่ทับคอนเทนต์ */}
      <body className={`${prompt.className} flex min-h-screen flex-col bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 text-gray-100`}>
        {/* ไม่ต้องมี padding-bottom พิเศษแล้ว เพราะ footer ไม่ลอยทับ */}
        <main className="flex-1">{children}</main>

        {/* footer แบบ static: ไม่ sticky / ไม่ fixed ⇒ จะไม่บังคอนเทนต์ทั้งตอนบน/ล่าง */}
        <footer className="mt-auto h-16 md:h-20 flex flex-col justify-center text-center
                           text-base md:text-lg text-gray-300
                           bg-gradient-to-t from-gray-900/70 to-transparent
                           border-t border-gray-700">
          Created by Adisorn Nangnoi
          <br />
          Copyright &copy; 2025 Southeast Asia University
        </footer>
      </body>
    </html>
  );
}

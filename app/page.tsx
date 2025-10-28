import Image from "next/image";
import foodbanner from "./images/foodbanner.jpg";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 p-4 font-sans text-center text-gray-100">
      {/* Heading */}
      <h1 className="text-5xl md:text-6xl font-extrabold drop-shadow-lg text-gray-100">
        Welcome to Food Tracker
      </h1>

      <p className="mb-8 mt-4 text-lg font-medium text-gray-300 sm:text-xl">
        Track your meal!!!
      </p>

      {/* Content Card */}
      <div className="flex w-full max-w-lg flex-col items-center justify-center rounded-2xl bg-gray-800/60 border border-gray-700 p-8 shadow-2xl backdrop-blur-md">
        {/* Food Tracker image */}
        <div className="mb-10 w-48 sm:w-64 overflow-hidden rounded-full border-4 border-indigo-500 shadow-lg">
          <Image
            src={foodbanner}
            alt="Food Tracker"
            width={300}
            height={200}
            className="object-cover"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Link
            href="/register"
            className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-gray-100 font-semibold rounded-full shadow-md transition-transform transform hover:scale-105 duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            Register
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-sky-500 hover:bg-sky-600 text-gray-100 font-semibold rounded-full shadow-md transition-transform transform hover:scale-105 duration-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}

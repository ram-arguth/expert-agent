export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Expert Agent Platform</h1>
      <p className="text-lg text-gray-600 mb-8">
        AI-powered domain expertise at your fingertips
      </p>
      <div className="flex gap-4">
        <a
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Get Started
        </a>
        <a
          href="/agents"
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          Explore Agents
        </a>
      </div>
    </main>
  );
}

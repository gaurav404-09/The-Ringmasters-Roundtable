// src/pages/AuthPage.jsx
import { useState } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { FaSignInAlt, FaUserPlus } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";

const AuthPage = () => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const isLogin = mode === "login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    setIsGoogleLoading(false);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Successfully logged in!");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Account created! Welcome aboard.");
      }
      navigate("/");
    } catch (err) {
      console.error("Auth error:", err);
      const errorMessage = err.message.includes("email-already-in-use")
        ? "This email is already registered. Try logging in instead."
        : err.message.includes("wrong-password")
        ? "Incorrect password. Please try again."
        : err.message.includes("user-not-found")
        ? "No account found with this email."
        : "An error occurred. Please try again.";
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setIsGoogleLoading(true);
    setIsLoading(false);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Signed in with Google!");
      navigate("/");
    } catch (err) {
      console.error("Google sign-in error:", err);
      const errorMessage = err.code === "auth/popup-closed-by-user"
        ? "Google sign-in cancelled."
        : "Failed to sign in with Google. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_65%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(124,58,237,0.2),_transparent_70%)]" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 sm:px-8 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center text-white"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
            The Ringmaster's Roundtable
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl">
            {isLogin ? "Step back into the arena." : "Join the Roundtable."}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/60">
            {isLogin
              ? "Log in to continue orchestrating showstopping itineraries with live comparisons, data-rich dashboards, and curated travel duels."
              : "Create an account to unlock curated travel duels, live insights, and collaborative tour planning."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
          className="mt-12 w-full max-w-xl rounded-3xl border border-white/10 bg-white/10 p-[1px] shadow-[0_35px_80px_rgba(15,23,42,0.55)]"
        >
          <div className="rounded-3xl bg-slate-950/80 p-10 backdrop-blur-xl">
            <div className="mb-8 text-left text-white">
              <h2 className="text-3xl font-semibold">
                {isLogin ? "Welcome back, maestro." : "Let's craft your debut."}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                {isLogin
                  ? "Enter your credentials to resume planning your next legendary tour."
                  : "Set your credentials to start composing unforgettable itineraries."}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-[0.35em] text-white/60 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-white/40 shadow-[0_20px_45px_rgba(15,23,42,0.45)] outline-none transition focus:border-cyan-400/60 focus:bg-white/10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-[0.35em] text-white/60 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-white/40 shadow-[0_20px_45px_rgba(15,23,42,0.45)] outline-none transition focus:border-violet-400/60 focus:bg-white/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-8 py-4 text-sm font-semibold uppercase tracking-[0.4em] text-white shadow-[0_30px_70px_rgba(14,165,233,0.4)] transition hover:shadow-[0_35px_85px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{isLogin ? "Signing in" : "Creating"}</span>
                  </>
                ) : (
                  <>
                    {isLogin ? <FaSignInAlt className="h-4 w-4" /> : <FaUserPlus className="h-4 w-4" />}
                    <span>{isLogin ? "Login" : "Sign Up"}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-8 py-4 text-sm font-semibold uppercase tracking-[0.35em] text-white/90 shadow-[0_25px_60px_rgba(15,23,42,0.45)] transition hover:border-white/30 hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGoogleLoading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Connecting</span>
                  </>
                ) : (
                  <>
                    <FcGoogle className="h-5 w-5" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="flex flex-col items-center gap-3 text-xs text-white/60">
                <span>{isLogin ? "New around here?" : "Already have an account?"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode(isLogin ? "signup" : "login");
                    setError("");
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  {isLogin ? (
                    <>
                      <FaUserPlus className="h-3.5 w-3.5" />
                      <span>Create your account</span>
                    </>
                  ) : (
                    <>
                      <FaSignInAlt className="h-3.5 w-3.5" />
                      <span>Return to login</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
import express from "express";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  verifyOTPAndRegister,
  googleCallback,
  forgotPassword,
  resetPassword,
  onboarding,
  validateToken,
} from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import passport from "passport";

const authRouter = express.Router();

authRouter
  .post("/register", registerUser)
  .post("/verify-otp", verifyOTPAndRegister)
  .post("/login", loginUser)
  .post("/logout", auth, logoutUser)
  .post("/refresh-token", refreshAccessToken)
  .get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] }),
  )
  .get("/google/callback", googleCallback)
  .post("/onboarding", auth, onboarding)
  .post("/forgot-password", forgotPassword)
  .post("/reset-password", resetPassword)
  .get("/validate-token", validateToken);

export default authRouter;

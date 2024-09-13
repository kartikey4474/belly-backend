import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { auth } from "../middlewares/auth.middleware.js";
import {
  createRecommendation,
  fetchAllRecommendations,
  fetchUserRecommendations,
  fetchSingleRecommendation,
  updateRecommendation,
  deleteRecommendation,
} from "./recommendation.controller.js";

const router = Router();

router.use(auth);
router.post("/create", upload.single("thumbnail"), createRecommendation);
router.get("/all", fetchAllRecommendations);
router.get("/user", fetchUserRecommendations);
router.get("/:id", fetchSingleRecommendation);
router.patch("/:id", upload.single("thumbnail"), updateRecommendation);
router.delete("/:id", deleteRecommendation);

export default router;
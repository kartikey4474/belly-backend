import { Router } from "express";
import {
  createAffiliationController,
  getAffiliationProductController,
  getProductsAffiliatedByUser,
  deleteAffiliationController,
  getInfluencerIdController,
} from "./affiliation_controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const publicAffiliationRouter = Router();
const affiliationRouter = Router();

affiliationRouter
  .get(
    "/get-affiliation-product/:affiliationId",
    getAffiliationProductController,
  )
  .get("/get-influencer-id/:affiliationId", getInfluencerIdController);
affiliationRouter.use(auth);

affiliationRouter
  .post("/create-affiliation", createAffiliationController)
  .get("/get-user-affiliated-products", getProductsAffiliatedByUser)
  .get("/delete-affiliation/:id", deleteAffiliationController);

export { publicAffiliationRouter, affiliationRouter };

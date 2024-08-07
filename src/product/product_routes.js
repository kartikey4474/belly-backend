import { Router } from "express";
import {
  createProduct,
  getAllProducts,
  getMostViewedProductsController,
  getProductDetails,
  getProductsByUser,
} from "./product_controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const productRouter = Router();
productRouter.use(auth);

productRouter
  .get("/get-all-products", getAllProducts)
  .get("/get-product-details", getProductDetails)
  .get("/get-most-viewed-products", getMostViewedProductsController)
  .post("/create-product", upload.array("imageUrls"), createProduct)
  .get("/get-products-by-user", getProductsByUser);

export default productRouter;

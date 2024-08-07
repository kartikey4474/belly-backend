import { increaseAffiliationClickCount } from "./affiliation_service.js";
import { fetchProductById } from "../product/product_service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { accountType } from "../common/common_constants.js";
import { Affiliation } from "./affiliation_model.js";
import { ApiError } from "../utils/APIError.js";
import { ApiResponse } from "../utils/APIResponse.js";

const getAffiliationProductController = asyncHandler(async (req, res, next) => {
  try {
    const affiliationId = req.body.affiliationId;
    const productId = req.body.productId;

    const product = await fetchProductById(productId);

    await increaseAffiliationClickCount(affiliationId, 1);

    return res
      .status(200)
      .json(new ApiResponse(200, product, "product fetched successfully"));
  } catch (err) {
    return next(err);
  }
});

const createAffiliationController = asyncHandler(async (req, res, next) => {
  try {
    if (req.user.accountType != accountType.INFLUENCER) {
      throw ApiError(403, "account type should be influencer");
    }

    const influencerId = req.user._id;
    const productId = req.body.productId;

    const affiliation = await Affiliation.create({
      productId,
      influencerId,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, affiliation, "affiliation created successfully"),
      );
  } catch (err) {
    return next(err);
  }
});

export { getAffiliationProductController, createAffiliationController };

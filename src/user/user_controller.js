import { ApiError } from "../utils/APIError.js";
import { ApiResponse } from "../utils/APIResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  fetchBrandDetailsAndProducts,
  updateUserByUserId,
  fetchUsers,
} from "../user/user_service.js";
import { getInfluencerProfile } from "../user/user_service.js";
import { uploadOnCloudinary } from "../pkg/cloudinary/cloudinary_service.js";
import { accountType } from "../common/common_constants.js";
import { increasePageViewCount } from "../analytics/analytics_service.js";
import { Affiliation } from "../affiliation/affiliation_model.js";
import { Product } from "../product/product.model.js";

const getUserDetailsController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    return res
      .status(200)
      .json(new ApiResponse(200, user, "user fetched successfully"));
  } catch (err) {
    return next(err);
  }
});

const updateUserDetailsController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;

    // const { userName, categories, fullName, bio } = req.body;
    // console.log(req.body, userName, categories, fullName, bio);
    // const existingUser = await fetchUsers({ username: userName });
    // console.log(existingUser);
    // if (existingUser) {
    //   throw ApiError(409, "username already exists");
    // }

    const { userName, categories, fullName, bio } = req.body;
    console.log(userName);
    const existingUser = await fetchUsers({ username: userName });
    console.log(existingUser);
    if (userName && existingUser.length > 0) {
      throw ApiError(409, "username already exists");
    }

    const updates = {};

    if (userName) updates.username = userName;
    if (categories) updates.categories = categories;
    if (fullName) updates.fullName = fullName;
    if (bio) updates.bio = bio;
    const updatedUser = await updateUserByUserId(user._id, updates);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedUser,
          "account details updated successfully",
        ),
      );
  } catch (err) {
    return next(err);
  }
});

const updateUserAvatarController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;

    const avatarLocalPath = req.file?.path;
    console.log(req.file);
    if (!avatarLocalPath) {
      throw ApiError(400, "avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) {
      throw ApiError(400, "error while uploading avatar");
    }

    const updates = { avatar: avatar.url };
    const updatedUser = await updateUserByUserId(user._id, updates);

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedUser, "avatar image updated successfully"),
      );
  } catch (err) {
    return next(err);
  }
});

const updateUserCoverImageController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    const coverImage = req.file?.path;
    if (!coverImage) {
      throw ApiError(400, "cover image file is missing");
    }

    const coverImageUrl = await uploadOnCloudinary(coverImage);
    if (!coverImageUrl.url) {
      throw ApiError(400, "error while uploading cover image");
    }

    const updates = { coverImage: coverImageUrl.url };
    const updatedUser = await updateUserByUserId(user._id, updates);

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedUser, "cover image updated successfully"),
      );
  } catch (err) {
    return next(err);
  }
});

const updateAdditionalLinksController = asyncHandler(async (req, res, next) => {
  const user = req.user;
  try {
    // const { additionalLinks } = req.body;
    const { host, url, isActive } = req.body;
    const thumbnail = req.file?.path;
    const additionalLinks = [
      {
        host,
        url,
        thumbnail,
        isActive: isActive ? isActive : true,
      },
    ];
    if (additionalLinks) {
      for (const newLink of additionalLinks) {
        const existingLinkIndex = user.additionalLinks.findIndex(
          (link) => link.host === newLink.host,
        );

        if (newLink.thumbnail && !newLink.thumbnail.startsWith("http")) {
          // Upload new thumbnail to Cloudinary if it's a new file path
          newLink.thumbnail = (await uploadOnCloudinary(newLink.thumbnail)).url;
        }

        if (existingLinkIndex !== -1) {
          user.additionalLinks[existingLinkIndex].url = newLink;
          user.additionalLinks[existingLinkIndex].thumbnail =
            newLink.thumbnail.url.toString();
          user.additionalLinks[existingLinkIndex].isActive = newLink.isActive;
        } else {
          user.additionalLinks.push(newLink);
        }
      }
      // Save the updated user
      // console.log(user);
      const updatedUser = await user.save();
      return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "Links updated successfully"));
    } else {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "No links provided"));
    }
  } catch (err) {
    return next(err);
  }
});

const getAllBrandsController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;

    if (user.accountType !== accountType.INFLUENCER) {
      throw ApiError(403, "user should be an influencer");
    }

    const allBrands = await fetchUsers({ accountType: accountType.BRAND });

    return res
      .status(200)
      .json(new ApiResponse(200, allBrands, "all brands fetched successfully"));
  } catch (err) {
    return next(err);
  }
});

const getBrandDetailsAndProductsController = asyncHandler(
  async (req, res, next) => {
    try {
      const user = req.user;
      const brandId = req.body.brandId;

      if (
        user.accountType !== accountType.INFLUENCER &&
        user.accountType !== accountType.BRAND
      ) {
        throw ApiError(403, "user should be an influencer or a brand");
      } else if (
        user.accountType === accountType.BRAND &&
        user._id !== brandId
      ) {
        throw ApiError(
          403,
          "brand is trying to access details of any other brand",
        );
      }

      const resp = await fetchBrandDetailsAndProducts(brandId);
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            resp,
            "brand details and products fetched successfully",
          ),
        );
    } catch (err) {
      return next(err);
    }
  },
);

const getInfluencerPageController = asyncHandler(async (req, res, next) => {
  try {
    const influencerId = req.body.influencerId;
    const influencer = await getInfluencerProfile(influencerId, {
      _id: 1,
      fullName: 1,
      username: 1,
      bio: 1,
      avatar: 1,
      coverImage: 1,
      additionalLinks: 1,
      accountType: 1,
    });

    const products = await Product.find({ brandId: influencer._id });

    if (!influencer) {
      throw ApiError(404, "influencer not found");
    }

    if (influencer.accountType !== accountType.INFLUENCER) {
      throw ApiError(404, "influencer not found");
    }
    const payload = {
      links: influencer.additionalLinks,
      products: products,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(200, payload, "influencer page fetched successfully"),
      );

    // const affiliations = await Affiliation.aggregate([
    //   {
    //     $match: { influencerId: influencer._id },
    //   },
    //   {
    //     $lookup: {
    //       from: "products",
    //       localField: "productId",
    //       foreignField: "_id",
    //       as: "productDetails",
    //     },
    //   },
    //   {
    //     $unwind: "$productDetails",
    //   },
    //   {
    //     $project: {
    //       _id: 1,
    //       productDetails: 1,
    //     },
    //   },
    // ]);
    // console.log(affiliations);
    // const influencerPageInfo = {
    // influencerInfo: influencer,
    // affiliations,
    // };
    // const lastVisitTimeCookieKey = `lastVisitTime::${influencerId}`;
    // const lastVisitTime = req.cookies[lastVisitTimeCookieKey];
    // if (!lastVisitTime) {
    //   await increasePageViewCount(influencerId, 1);
    //   res.cookie(lastVisitTimeCookieKey, Date.now(), {
    //     httpOnly: true,
    //     secure: process.env.NODE_ENV === "production",
    //     maxAge: 1000 * 60 * 60, // can make configurable in case of multiple usecases
    //   });
    // }

    // return res
    //   .status(200)
    //   .json(
    //     new ApiResponse(
    //       200,
    //       influencerPageInfo,
    //       "influencer page fetched successfully",
    //     ),
    //   );
  } catch (err) {
    return next(err);
  }
});

const getAdditionalLinksController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          user.additionalLinks,
          "Links fetched successfully",
        ),
      );
  } catch (err) {
    return next(err);
  }
});

export {
  getUserDetailsController,
  updateUserDetailsController,
  updateUserAvatarController,
  updateUserCoverImageController,
  updateAdditionalLinksController,
  getAllBrandsController,
  getBrandDetailsAndProductsController,
  getInfluencerPageController,
  getAdditionalLinksController,
};

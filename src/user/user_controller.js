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
import { User } from "./user.model.js";
import stripe from "stripe";

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

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

    const { userName, categories, fullName, bio, theme } = req.body;
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
    if (theme) updates.theme = theme;
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
    const { id, host, url, isActive } = req.body;
    const thumbnail = req.file ? req.file.path : req.body.thumbnail;
    let existingLinkIndex = -1;
    if (id) {
      existingLinkIndex = user.additionalLinks.findIndex(
        (link) => link._id.toString() === id,
      );
    } else {
      existingLinkIndex = user.additionalLinks.findIndex(
        (link) => link.host === host,
      );
    }
    let processedThumbnail = thumbnail;
    if (thumbnail && !thumbnail.startsWith("http")) {
      const uploadedThumbnail = await uploadOnCloudinary(thumbnail);
      processedThumbnail = uploadedThumbnail.url
        ? uploadedThumbnail.url.toString()
        : uploadedThumbnail;
    }

    if (existingLinkIndex !== -1) {
      user.additionalLinks[existingLinkIndex] = {
        ...user.additionalLinks[existingLinkIndex],
        host,
        url,
        thumbnail: processedThumbnail,
        isActive:
          isActive !== undefined
            ? isActive
            : user.additionalLinks[existingLinkIndex].isActive,
      };
    } else {
      user.additionalLinks.push({
        host,
        url,
        thumbnail: processedThumbnail,
        isActive: isActive !== undefined ? isActive : true,
      });
    }
    const updatedUser = await user.save();
    return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "Links updated successfully"));
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
const getAllInfluencerController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;

    if (user.accountType !== accountType.BRAND) {
      throw ApiError(403, "user should be an brnad");
    }

    const allInfluencer = await fetchUsers({
      accountType: accountType.INFLUENCER,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          allInfluencer,
          "all influencers fetched successfully",
        ),
      );
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
    const affiliations = await Affiliation.aggregate([
      {
        $match: { influencerId: influencer._id },
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: "$productDetails",
      },
      {
        $project: {
          _id: 1,
          productDetails: 1,
        },
      },
    ]);
    const influencerPageInfo = {
      influencerInfo: influencer,
      affiliations,
    };
    // await increasePageViewCount(influencerId, 1);

    const lastVisitTimeCookieKey = `lastVisitTime::${influencerId}`;
    const lastVisitTime = req.cookies[lastVisitTimeCookieKey];
    if (!lastVisitTime) {
      await increasePageViewCount(influencerId, 1);
      res.cookie(lastVisitTimeCookieKey, Date.now(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "PRODUCTION",
        maxAge: 1000 * 60 * 60,
      });
    }
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          influencerPageInfo,
          "influencer page fetched successfully",
        ),
      );
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

const updateSocialsController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    const { socials } = req.body;

    if (!Array.isArray(socials) || socials.length === 0) {
      throw ApiError(400, "No updates provided");
    }

    const validPlatforms = [
      "twitter",
      "facebook",
      "instagram",
      "linkedin",
      "youtube",
      "tiktok",
    ];

    const updates = {};

    socials.forEach(({ platform, url }) => {
      if (!platform || !url) {
        throw ApiError(
          400,
          "Platform and URL must be provided for all updates",
        );
      }

      if (!validPlatforms.includes(platform)) {
        throw ApiError(400, `Invalid platform: ${platform}`);
      }

      updates[`socials.${platform}`] = url;
    });

    const updatedUser = await updateUserByUserId(user._id, updates);

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedUser, `Social links updated successfully`),
      );
  } catch (err) {
    return next(err);
  }
});

const handleLinkOrder = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    const { linkIds } = req.body;

    if (!user || user.accountType !== "influencer") {
      throw new ApiError(401, "Unauthorized");
    }

    // Create a map of existing links for quick lookup
    const linkMap = new Map(
      user.additionalLinks.map((link) => [link._id.toString(), link]),
    );

    // Rearrange links based on the provided order
    const rearrangedLinks = linkIds.map((id) => {
      const link = linkMap.get(id);
      if (!link) {
        throw new ApiError(400, `Link with id ${id} not found`);
      }
      return link;
    });

    // Update the user with rearranged links
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: { additionalLinks: rearrangedLinks } },
      { new: true, runValidators: true },
    );

    return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "Links rearranged successfully"));
  } catch (error) {
    next(error);
  }
});

const deleteLink = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;
    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $pull: { additionalLinks: { _id: id } },
      },
      {
        new: true,
      },
    );

    return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "Link deleted successfully"));
  } catch (error) {
    next(error);
  }
});

const updateFeedLinkController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw ApiError(404, "Unauthorized request");

    const { identifier, title, url } = req.body;
    if (!identifier) throw ApiError(400, "Identifier is required");

    // Validate the URL
    if (!url) throw ApiError(400, "URL is required");

    // Update the feed based on the identifier
    if (identifier === "youtube") {
      // Ensure feed and youtubeLinks are initialized
      if (!user.feed) {
        user.feed = {};
        user.feed.youtubeLinks = [];
        user.feed.musicLinks = [];
        user.feed.affiliateLinks = [];
      }

      user.feed.youtubeLinks.push({ title, link: url });
    } else if (identifier === "music") {
      user.feed.musicLinks.push({ title, link: url });
    } else if (identifier === "affiliate") {
      user.feed.affiliateLinks.push({ title, link: url });
    } else {
      throw ApiError(400, "Invalid identifier");
    }

    const updatedUser = await user.save();
    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedUser, "Feed link updated successfully"),
      );
  } catch (error) {
    next(error);
  }
});

const connectStripeController = asyncHandler(async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) throw ApiError(404, "Unauthorized request");
    if (user.stripeAccountId) {
      // User already has a Stripe account, return the account link
      const accountLink = await stripeClient.accountLinks.create({
        account: user.stripeAccountId,
        refresh_url: `${process.env.CLIENT_URL}/connect-stripe`,
        return_url: `${process.env.CLIENT_URL}/connect-stripe`,
        type: "account_onboarding",
      });

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            accountLink,
            "Stripe account connected successfully",
          ),
        );
    }
    console.log("start");
    const account = await stripeClient.accounts.create({
      type: "express",
      email: user.email,
      metadata: {
        userId: user._id.toString(),
      },
    });
    user.stripeAccountId = account.id;
    await user.save();
    console.log("account created");
    const accountLink = await stripeClient.accountLinks.create({
      account: account.id,
      refresh_url: `https://${process.env.CLIENT_URL}/connect-stripe`,
      return_url: `https://${process.env.CLIENT_URL}/connect-stripe`,
      type: "account_onboarding",
    });
    console.log("account link created");
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          accountLink,
          "Stripe account connected successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
});

export {
  getUserDetailsController,
  updateUserDetailsController,
  updateUserAvatarController,
  updateUserCoverImageController,
  updateAdditionalLinksController,
  updateSocialsController,
  getAllBrandsController,
  getAllInfluencerController,
  getBrandDetailsAndProductsController,
  getInfluencerPageController,
  getAdditionalLinksController,
  handleLinkOrder,
  deleteLink,
  updateFeedLinkController,
  connectStripeController,
};

import { User } from "../user/user.model.js";
import { verifyToken } from "../services/token.service.js";
import { ApiError } from "../utils/APIError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.NODE_ENV === "PRODUCTION"
          ? `${process.env.LIVE_URL}/auth/google/callback`
          : `${process.env.LOCAL_URL}/auth/google/callback`,
      scope: ["profile", "email"],
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
          user = new User({
            fullName: profile.displayName,
            email: profile.emails[0].value,
            username: profile.emails[0].value.split("@")[0], // Use email prefix as username
            password: Math.random().toString(36).slice(-8), // Generate a random password
            // accountType: "default",
            categories: [],
            avatar: profile.photos[0].value,
          });
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export const initializePassport = () => {
  return passport.initialize();
};

export const sessionPassport = () => {
  return passport.session();
};

export const auth = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return next(ApiError(403, "Unauthorized request"));
  }
  try {
    const decodedToken = verifyToken(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      return next(ApiError(401, "Invalid Access Token"));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
});

export const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decodedToken = verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      return next(new Error("Authentication error: Invalid token"));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Authentication error: " + error.message));
  }
};

import { Router, raw } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import Sponsorship from "./sponsorship.model.js";
import SponsorshipTerms from "./sponsorshipTerms.model.js";
import Stripe from "stripe";
import { Product } from "../product/product.model.js";
import { User } from "../user/user.model.js";

// Initialize Stripe properly
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

// Sponsorship Terms
const createSponsorshipTerms = async (req, res) => {
  const { duration, termsAndConditions } = req.body;
  const influencerId = req.user._id;

  const terms = await SponsorshipTerms.create({
    influencerId,
    duration,
    termsAndConditions,
  });

  res.status(201).json({ terms });
};

const sponsorRouter = Router();

// Sponsorship Creation
const createSponsorship = async (req, res) => {
  const { influencerId, productId, amount } = req.body;
  const brandId = req.user._id;

  const terms = await SponsorshipTerms.findOne({
    influencerId,
    isActive: true,
  });

  if (!terms) {
    return res.status(404).json({ message: "Sponsorship terms not found" });
  }

  const sponsorship = await Sponsorship.create({
    influencerId,
    brandId,
    productId,
    amount,
    duration: terms.duration,
    status: "pending",
  });

  res.status(201).json({ sponsorship });
};

// Update Sponsorship Status
const updateSponsorshipStatus = async (req, res) => {
  const { sponsorshipId, status } = req.body;
  const userId = req.user._id;

  const sponsorship = await Sponsorship.findOne({ _id: sponsorshipId });

  if (!sponsorship) {
    return res.status(404).json({ message: "Sponsorship not found" });
  }

  if (sponsorship.influencerId.toString() !== userId.toString()) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  if (status === "approved" && sponsorship.paymentStatus !== "completed") {
    return res.status(400).json({ message: "Payment must be completed first" });
  }

  if (status === "approved") {
    sponsorship.startDate = new Date();
    sponsorship.endDate = new Date(
      Date.now() + sponsorship.duration * 24 * 60 * 60 * 1000,
    );
  }

  sponsorship.status = status;
  await sponsorship.save();

  res.status(200).json({ sponsorship });
};

// Handle Payment
const handlePayment = async (req, res) => {
  const { sponsorshipId } = req.body;
  const userId = req.user._id;

  try {
    const sponsorship = await Sponsorship.findOne({ _id: sponsorshipId });

    if (!sponsorship) {
      return res.status(404).json({ message: "Sponsorship not found" });
    }

    if (sponsorship.brandId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (sponsorship.paymentStatus === "completed") {
      return res.status(400).json({ message: "Payment already completed" });
    }

    // Create Stripe payment session
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Sponsorship Payment",
              description: `Sponsorship payment for influencer collaboration`,
            },
            unit_amount: sponsorship.amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/brands/sponsorship/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/sponsorship/cancel`,
      metadata: {
        sponsorshipId: sponsorship._id.toString(),
      },
    });

    // Save the session ID to the sponsorship
    sponsorship.paymentSessionId = session.id;
    await sponsorship.save();

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ message: "Payment processing failed" });
  }
};

// Handle Success Page
const handleSuccessPage = async (req, res) => {
  const { session_id } = req.query;

  try {
    // Verify the session with Stripe
    const session = await stripeClient.checkout.sessions.retrieve(session_id);
    console.log("test1");
    if (session.payment_status === "paid") {
      console.log("test2");
      const sponsorshipId = session.metadata.sponsorshipId;
      console.log("test3");
      const sponsorship = await Sponsorship.findById(sponsorshipId);
      console.log("test4");
      if (sponsorship) {
        sponsorship.paymentStatus = "completed";
        sponsorship.status = "pending";
        await sponsorship.save();
        return res.status(200).json({ success: true, sponsorship });
      }
    }

    return res
      .status(400)
      .json({ success: false, message: "Payment not completed" });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Payment verification failed" });
  }
};

// Routes
sponsorRouter.get("/terms/:influencerId", async (req, res) => {
  const influencerId = req.params.influencerId;
  if (!influencerId) {
    return res.status(400).json({ message: "Influencer ID is required" });
  }
  const terms = await SponsorshipTerms.findOne({
    influencerId,
    isActive: true,
  });

  if (!terms) {
    return res
      .status(404)
      .json({ message: "No active sponsorship terms found" });
  }

  res.status(200).json({ terms });
});

sponsorRouter.get("/sponsorproducts/:influencerId", async (req, res) => {
  const influencerId = req.params.influencerId;
  if (!influencerId) {
    return res.status(400).json({ message: "Influencer ID is required" });
  }
  try {
    const sponsorships = await Sponsorship.find({
      influencerId,
      status: "approved",
    }).populate("productId");

    res.status(200).json({ sponsorships });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

sponsorRouter.use(auth);
sponsorRouter.post("/create-terms", createSponsorshipTerms);
sponsorRouter.post("/create-sponsorship", createSponsorship);
sponsorRouter.put("/sponsorship-status", updateSponsorshipStatus);
sponsorRouter.post("/payment", auth, handlePayment);

sponsorRouter.get("/sponsorship/:sponsorshipId", auth, async (req, res) => {
  const sponsorship = await Sponsorship.findById(req.params.sponsorshipId);
  // .populate("influencerId", "name email")
  // .populate("brandId", "name")
  // .populate("productId", "name description");

  if (!sponsorship) {
    return res.status(404).json({ message: "Sponsorship not found" });
  }

  res.status(200).json({ sponsorship });
});

sponsorRouter.get(
  "/influencer/:influencerId/brand/:brandId",
  auth,
  async (req, res) => {
    const { influencerId, brandId } = req.params;

    try {
      const sponsorships = await Sponsorship.find({
        influencerId,
        brandId,
      }).populate("productId");

      res.status(200).json({ sponsorships });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
);
sponsorRouter.get("/get-user-sponsorships", auth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const userId = req.user._id;

  try {
    const sponsorships = await Sponsorship.find({
      $or: [{ brandId: userId }, { influencerId: userId }],
    })
      .populate("brandId")
      .populate("influencerId");
    console.log(sponsorships);
    res.status(200).json({ sponsorships });
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.log(error);
  }
});

sponsorRouter.get("/payment/success", handleSuccessPage);

export default sponsorRouter;
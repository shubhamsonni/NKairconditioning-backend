import express from "express";
import cors from "cors";
import mongoose, { Schema } from "mongoose";
import "dotenv/config";

const notificationEmail = process.env.BOOKING_NOTIFICATION_EMAIL ?? "nkairconditioning94@gmail.com";
const emailSenderAddress = process.env.EMAIL_SENDER_ADDRESS ?? notificationEmail;
const emailSenderName = process.env.EMAIL_SENDER_NAME ?? "N K Airconditioning Website";
const emailApiConfigured = Boolean(process.env.BREVO_API_KEY && emailSenderAddress);

async function sendBookingNotification(booking: { id: string; name: string; phone: string; email?: string; service: string; preferredDate?: string; location?: string; message?: string }) {
  if (!emailApiConfigured) throw new Error("Brevo email API is not configured on the server.");
  const text = [
    "New booking request received",
    "",
    `Name: ${booking.name}`,
    `Phone: ${booking.phone}`,
    `Email: ${booking.email || "Not provided"}`,
    `Service: ${booking.service}`,
    `Preferred date: ${booking.preferredDate || "Not provided"}`,
    `Location: ${booking.location || "Not provided"}`,
    `Problem: ${booking.message || "Not provided"}`,
    `Booking ID: ${booking.id}`,
  ].join("\n");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: emailSenderName, email: emailSenderAddress },
      to: [{ email: notificationEmail, name: "N K Airconditioning" }],
      ...(booking.email ? { replyTo: { email: booking.email, name: booking.name } } : {}),
      subject: `New AC booking: ${booking.service} — ${booking.name}`,
      textContent: text,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const providerMessage = await response.text();
    throw new Error(`Brevo API returned ${response.status}: ${providerMessage.slice(0, 500)}`);
  }

  const result = await response.json() as { messageId?: string };
  return {
    sent: true as const,
    messageId: result.messageId,
  };
}

const app = express();
const configuredOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, "");
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalized);
    if (isLocal || configuredOrigins.includes(normalized)) return callback(null, true);
    callback(new Error(`CORS blocked request from ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json());

const reviewSchema = new Schema({ name:String, comment:String, serviceSatisfaction:{type:Number,min:1,max:5,required:true}, behaviour:{type:Number,min:1,max:5,required:true} },{timestamps:true});
const Review = mongoose.model("Review",reviewSchema);

app.get("/api/health", (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected", email: emailApiConfigured ? "configured" : "not_configured", service: "N K Airconditioning API" }));
app.post("/api/bookings", async (req, res) => {
  try {
    const { name, phone, email, service, preferredDate, location, message } = req.body;
    if (!String(name ?? "").trim()) return res.status(422).json({ ok: false, message: "Please enter your name." });
    if (!/^[+]?[0-9\s-]{10,15}$/.test(String(phone ?? "").trim())) return res.status(422).json({ ok: false, message: "Please enter a valid 10-digit phone number." });
    if (!String(service ?? "").trim()) return res.status(422).json({ ok: false, message: "Please select an AC service." });
    if (!emailApiConfigured) return res.status(503).json({ ok: false, message: "The booking email service is not configured. Please call +91 94669 80984." });
    const requestId = `NK-${Date.now().toString(36).toUpperCase()}`;
    try {
      await sendBookingNotification({ id: requestId, name: String(name).trim(), phone: String(phone).trim(), email: email ? String(email).trim() : undefined, service: String(service).trim(), preferredDate: preferredDate ? String(preferredDate) : undefined, location: location ? String(location).trim() : undefined, message: message ? String(message).trim() : undefined });
      res.status(200).json({ ok: true, id: requestId, emailSent: true, stored: false, message: "Email sent successfully." });
    } catch (emailError) {
      console.error(`Callback request ${requestId} email delivery failed:`, emailError instanceof Error ? emailError.message : emailError);
      res.status(502).json({ ok: false, emailSent: false, stored: false, message: "The callback request email could not be delivered. Please try again or call +91 94669 80984." });
    }
  } catch (error) {
    console.error("Booking submission failed:", error instanceof Error ? error.message : error);
    res.status(500).json({ ok: false, stored: false, message: "We could not process your callback request. Please try again or call +91 94669 80984." });
  }
});
app.get("/api/reviews",async(_req,res)=>{try{const reviews=await Review.find().sort({createdAt:-1}).limit(20);res.json({ok:true,reviews})}catch{res.status(500).json({ok:false,message:"Unable to load reviews"})}});
app.post("/api/reviews",async(req,res)=>{if(mongoose.connection.readyState!==1)return res.status(503).json({ok:false,message:"The database is temporarily unavailable. Please try again shortly."});try{const serviceSatisfaction=Number(req.body.serviceSatisfaction);const behaviour=Number(req.body.behaviour);if(!Number.isInteger(serviceSatisfaction)||serviceSatisfaction<1||serviceSatisfaction>5||!Number.isInteger(behaviour)||behaviour<1||behaviour>5)return res.status(422).json({ok:false,message:"Please select both service satisfaction and technician behaviour ratings."});const review=await Review.create({...req.body,serviceSatisfaction,behaviour});res.status(201).json({ok:true,id:review.id,message:"Thank you. Your review has been submitted."})}catch(error){console.error("Review submission failed:",error instanceof Error?error.message:error);res.status(500).json({ok:false,message:"We could not save your review. Please try again."})}});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API request failed:", error.message);
  res.status(error.message.startsWith("CORS") ? 403 : 500).json({ ok: false, message: error.message.startsWith("CORS") ? "This website is not allowed to access the API. Check FRONTEND_URL." : "Unexpected server error." });
});

const port = Number(process.env.PORT ?? 5000);
async function start() {
  if (process.env.MONGODB_URI) {
    try { await mongoose.connect(process.env.MONGODB_URI); console.log("MongoDB connected"); }
    catch (error) { console.error("MongoDB connection failed:", error instanceof Error ? error.message : error); }
  }
  app.listen(port, () => { console.log(`API running on http://localhost:${port}`); console.log(emailApiConfigured ? `Brevo booking emails enabled for ${notificationEmail}` : "Booking emails disabled: set BREVO_API_KEY and EMAIL_SENDER_ADDRESS"); });
}
start();

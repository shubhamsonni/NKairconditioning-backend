import express from "express";
import cors from "cors";
import mongoose, { Schema } from "mongoose";
import "dotenv/config";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }));
app.use(express.json());

const bookingSchema = new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  service: { type: String, required: true },
  preferredDate: String,
  location: String,
  message: String,
}, { timestamps: true });
const Booking = mongoose.model("Booking", bookingSchema);
const reviewSchema = new Schema({ name:String, comment:String, serviceSatisfaction:{type:Number,min:1,max:5,required:true}, behaviour:{type:Number,min:1,max:5,required:true} },{timestamps:true});
const Review = mongoose.model("Review",reviewSchema);

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "N K Airconditioning API" }));
app.post("/api/bookings", async (req, res) => {
  try {
    const booking = await Booking.create(req.body);
    res.status(201).json({ ok: true, id: booking.id, message: "Booking request received" });
  } catch (error) {
    res.status(400).json({ ok: false, message: "Please check the required fields", error: error instanceof Error ? error.message : "Unknown error" });
  }
});
app.get("/api/reviews",async(_req,res)=>{try{const reviews=await Review.find().sort({createdAt:-1}).limit(20);res.json({ok:true,reviews})}catch{res.status(500).json({ok:false,message:"Unable to load reviews"})}});
app.post("/api/reviews",async(req,res)=>{try{const review=await Review.create(req.body);res.status(201).json({ok:true,id:review.id})}catch(error){res.status(400).json({ok:false,message:"Please select both ratings",error:error instanceof Error?error.message:"Unknown error"})}});

const port = Number(process.env.PORT ?? 5000);
async function start() {
  if (process.env.MONGODB_URI) {
    try { await mongoose.connect(process.env.MONGODB_URI); console.log("MongoDB connected"); }
    catch { console.warn("MongoDB unavailable; API is waiting for a database connection"); }
  }
  app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}
start();

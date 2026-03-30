import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import admin from "firebase-admin";
import ical from "ical-generator";
import nodeIcal from "node-ical";
import axios from "axios";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  const firestore = admin.firestore();

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // iCal Export Endpoint
  app.get("/api/rooms/:roomId/export.ics", async (req, res) => {
    try {
      const { roomId } = req.params;
      const dbInstance = firestore;
      
      const roomDoc = await dbInstance.collection("rooms").doc(roomId).get();
      if (!roomDoc.exists) {
        return res.status(404).send("Room not found");
      }
      
      const roomData = roomDoc.data();
      const bookingsSnap = await dbInstance.collection("bookings")
        .where("roomId", "==", roomId)
        .where("status", "in", ["Confirmed", "CheckedIn", "External"])
        .get();
        
      const calendar = ical({ name: `Room ${roomData?.number} Bookings` });
      
      bookingsSnap.forEach(doc => {
        const booking = doc.data();
        calendar.createEvent({
          start: new Date(booking.checkIn),
          end: new Date(booking.checkOut),
          summary: booking.status === "External" ? `External Booking (${booking.externalSource})` : "Reserved",
          description: `Booking ID: ${doc.id}`,
        });
      });
      
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="room_${roomData?.number}.ics"`);
      res.send(calendar.toString());
    } catch (error) {
      console.error("iCal Export Error:", error);
      res.status(500).send("Error generating iCal");
    }
  });

  // iCal Sync Endpoint
  app.post("/api/rooms/:roomId/sync", async (req, res) => {
    try {
      const { roomId } = req.params;
      const dbInstance = firestore;
      
      const roomDoc = await dbInstance.collection("rooms").doc(roomId).get();
      if (!roomDoc.exists) {
        return res.status(404).send("Room not found");
      }
      
      const roomData = roomDoc.data();
      const urls = [
        { url: roomData?.bookingComIcalUrl, source: "Booking.com" },
        { url: roomData?.lekkeSlaapIcalUrl, source: "LekkeSlaap.co.za" }
      ].filter(item => item.url);
      
      if (urls.length === 0) {
        return res.status(400).send("No iCal URLs configured for this room");
      }
      
      let newBookingsCount = 0;
      const now = new Date();
      
      for (const { url, source } of urls) {
        const response = await axios.get(url);
        const data = nodeIcal.parseICS(response.data);
        
        for (const k in data) {
          const event = data[k];
          if (event.type !== 'VEVENT') continue;
          
          const start = new Date(event.start as Date);
          const end = new Date(event.end as Date);
          
          // Skip past events
          if (isBefore(end, startOfDay(now))) continue;
          
          // Check if booking already exists for this room and dates from this source
          const existingSnap = await dbInstance.collection("bookings")
            .where("roomId", "==", roomId)
            .where("checkIn", "==", start.toISOString())
            .where("checkOut", "==", end.toISOString())
            .where("externalSource", "==", source)
            .get();
            
          if (existingSnap.empty) {
            // Create external booking
            await dbInstance.collection("bookings").add({
              roomId,
              guestId: "external_guest", // Placeholder
              checkIn: start.toISOString(),
              checkOut: end.toISOString(),
              status: "External",
              externalSource: source,
              rateType: "Single", // Default
              totalAmount: 0,
              isPaid: true,
              createdAt: now.toISOString()
            });
            newBookingsCount++;
          }
        }
      }
      
      await dbInstance.collection("rooms").doc(roomId).update({
        lastSyncAt: now.toISOString()
      });
      
      res.json({ success: true, newBookingsCount });
    } catch (error) {
      console.error("iCal Sync Error:", error);
      res.status(500).send("Error syncing iCal");
    }
  });

  // No redirect needed, serving from root
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite dev server...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true
      },
      appType: "spa",
      base: '/'
    });
    app.use(vite.middlewares);
    console.log("Vite dev server initialized.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve static files from root
    app.use('/', express.static(distPath));
    
    // Fallback for SPA
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`App available at http://localhost:${PORT}/`);
  });
}

startServer();

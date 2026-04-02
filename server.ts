import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import ical from "ical-generator";
import nodeIcal from "node-ical";
import axios from "axios";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config
const configPath = path.join(__dirname, "firebase-applet-config.json");
console.log(`Loading config from: ${configPath}`);
if (!fs.existsSync(configPath)) {
  console.error(`Config file NOT FOUND at ${configPath}`);
}
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

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

  let firestore: admin.firestore.Firestore;
  try {
    const dbId = firebaseConfig.firestoreDatabaseId;
    if (dbId && dbId !== "(default)") {
      firestore = getFirestore(admin.app(), dbId);
      console.log(`Firestore initialized with named database: ${dbId}`);
    } else {
      firestore = getFirestore(admin.app());
      console.log("Firestore initialized with default database");
    }
  } catch (fsError) {
    console.error("Failed to initialize Firestore:", fsError);
    firestore = getFirestore(admin.app());
  }

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
    } catch (error: any) {
      console.error("iCal Export Error:", error);
      res.status(500).json({ success: false, message: error.message || "Error generating iCal" });
    }
  });

  // iCal Sync Endpoint
  app.post("/api/rooms/:roomId/sync", async (req, res) => {
    console.log(`Starting sync for room: ${req.params.roomId}`);
    try {
      const { roomId } = req.params;
      const dbInstance = firestore;
      
      const roomDoc = await dbInstance.collection("rooms").doc(roomId).get();
      if (!roomDoc.exists) {
        console.error(`Room ${roomId} not found`);
        return res.status(404).send("Room not found");
      }
      
      const roomData = roomDoc.data();
      const urls = [
        { url: roomData?.bookingComIcalUrl, source: "Booking.com" },
        { url: roomData?.lekkeSlaapIcalUrl, source: "LekkeSlaap.co.za" },
        { url: roomData?.externalIcalUrl, source: "External" }
      ].filter(item => item.url);
      
      console.log(`Found ${urls.length} URLs to sync`);
      if (urls.length === 0) {
        return res.status(400).send("No iCal URLs configured for this room");
      }
      
      let newBookingsCount = 0;
      const now = new Date();
      const syncErrors: string[] = [];
      
      for (const { url, source } of urls) {
        console.log(`Fetching iCal from ${source}: ${url}`);
        try {
          const response = await axios.get(url, { 
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          console.log(`Response status from ${source}: ${response.status}`);
          if (!response.data || typeof response.data !== 'string') {
            syncErrors.push(`${source}: Invalid response data`);
            continue;
          }
          
          if (response.data.trim().startsWith('<!DOCTYPE html>') || response.data.trim().startsWith('<html')) {
            syncErrors.push(`${source}: URL returned a web page instead of iCal data. Please ensure you are using the direct iCal export link.`);
            continue;
          }
          
          let data;
          try {
            data = nodeIcal.parseICS(response.data);
          } catch (err) {
            syncErrors.push(`${source}: Failed to parse iCal data`);
            continue;
          }
          
          console.log(`Parsed ${Object.keys(data).length} items from ${source}`);
          
          for (const k in data) {
            const event = data[k];
            if (event.type !== 'VEVENT') continue;
            
            const start = event.start as Date;
            const end = event.end as Date;
            const uid = event.uid as string;
            
            if (!start || !end || !uid) continue;
            
            // Skip past events
            if (isBefore(end, startOfDay(now))) {
              continue;
            }
            
            const checkInStr = format(start, 'yyyy-MM-dd');
            const checkOutStr = format(end, 'yyyy-MM-dd');
            
            // Check if booking already exists by externalUid
            const existingSnap = await dbInstance.collection("bookings")
              .where("roomId", "==", roomId)
              .where("externalUid", "==", uid)
              .get();
              
            if (existingSnap.empty) {
              console.log(`Creating new external booking from ${source}: ${checkInStr} to ${checkOutStr} (UID: ${uid})`);
              // Create external booking
              await dbInstance.collection("bookings").add({
                roomId,
                guestId: "external_guest", // Placeholder
                checkIn: checkInStr,
                checkOut: checkOutStr,
                status: "External",
                externalSource: source,
                externalUid: uid,
                rateType: "Single", // Default
                totalAmount: 0,
                isPaid: true,
                createdAt: now.toISOString()
              });
              newBookingsCount++;
            } else {
              // Update existing external booking if dates changed
              const existingDoc = existingSnap.docs[0];
              const existingData = existingDoc.data();
              if (existingData.checkIn !== checkInStr || existingData.checkOut !== checkOutStr) {
                console.log(`Updating external booking dates for UID ${uid}: ${existingData.checkIn} -> ${checkInStr}`);
                await existingDoc.ref.update({
                  checkIn: checkInStr,
                  checkOut: checkOutStr,
                  updatedAt: now.toISOString()
                });
              }
            }
          }
        } catch (fetchError: any) {
          console.error(`Error syncing from ${source}:`, fetchError.message);
          syncErrors.push(`${source}: ${fetchError.message}`);
        }
      }
      
      console.log(`Sync complete for room ${roomId}. New bookings: ${newBookingsCount}`);
      
      // Update lastSyncAt for the room
      await dbInstance.collection("rooms").doc(roomId).update({
        lastSyncAt: now.toISOString()
      });
      
      res.json({ 
        success: true, 
        newBookingsCount,
        errors: syncErrors.length > 0 ? syncErrors : undefined
      });
    } catch (error: any) {
      console.error("iCal Sync Error:", error);
      res.status(500).json({ success: false, message: error.message || "Error syncing iCal" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite dev server...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 100
        }
      },
      appType: "spa",
      base: '/'
    });
    app.use(vite.middlewares);
    
    // SPA fallback for dev
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) return next();
      
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        console.error("Vite transform error:", e);
        res.status(500).end(e.stack);
      }
    });
    console.log("Vite dev server initialized with SPA fallback.");
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

startServer().catch((err) => {
  console.error("CRITICAL ERROR during server startup:", err);
  process.exit(1);
});

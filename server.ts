import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Route: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "PEA Meter AI Service" });
  });

  // API Route: Chat with Gemini AI
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, recordStats, conversationHistory } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "ข้อความไม่ถูกต้อง" });
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // Fallback response when GEMINI_API_KEY is not set
        return res.json({
          reply: `สแกนข้อความ: "${message}" นำไปค้นหาในฐานข้อมูลมิเตอร์ให้เรียบร้อยแล้วครับ`,
          extractedQuery: parseMessageLocally(message)
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `คุณคือ "น้อง PEA Bot" ผู้ช่วยสุดร่าเริง รวดเร็ว สนุกสนาน และเป็นกันเอง สังกัดการไฟฟ้าส่วนภูมิภาค (PEA)
ตอบผู้ใช้ด้วยน้ำเสียงเป็นกันเอง เป็นธรรมชาติ สนุกสนาน ไม่เป็นทางการจนเกินไป ยิ้มแย้ม ร่าเริง

หน้าที่ของคุณคือวิเคราะห์ข้อความที่ผู้ใช้ส่งมา แล้วจำแนกประเภทการค้นหา:
1. หากเป็นตัวเลขที่ขึ้นต้นด้วย "200" หรือเลขบัญชีผู้ใช้ไฟ 10-12 หลัก -> CA (เลขผู้ใช้ไฟ)
2. หากเป็นตัวเลขอื่นๆ (เช่น 5-9 หลัก หรือตัวเลขรหัสวัด) -> Meter (เลขเครื่องวัด)
3. หากเป็นข้อความทั่วไป ชื่อ-นามสกุล บ้านเลขที่ หมู่ ถนน ตำบล -> address (ชื่อ/ที่อยู่)

จงวิเคราะห์ข้อความ แล้วส่งคืน JSON สั้นๆ ดังนี้ (ห้ามใส่ markdown block):
{
  "reply": "คำตอบสั้นๆ เป็นกันเอง สนุกสนาน ภาษาพูดธรรมชาติ เช่น 'จัดไปครับ! สแกนเจอพิกัดให้แล้วนะ⚡' หรือ 'ค้นหาพิกัดให้เรียบร้อยครับผม! 😎'",
  "extractedQuery": {
    "meter": "เลขมิเตอร์ที่สกัดได้ (หรือ null)",
    "ca": "เลขผู้ใช้ไฟ CA ที่สกัดได้ (หรือ null)",
    "address": "ชื่อ นามสกุล บ้านเลขที่ หรือข้อความค้นหาที่สกัดได้ (หรือ null)",
    "intent": "search" หรือ "general_qa" หรือ "greeting"
  }
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `ประวัติการสนทนาก่อนหน้า: ${JSON.stringify(conversationHistory || [])}\nข้อความผู้ใช้ล่าสุด: "${message}"`
              }
            ]
          }
        ],
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              extractedQuery: {
                type: Type.OBJECT,
                properties: {
                  meter: { type: Type.STRING, nullable: true },
                  ca: { type: Type.STRING, nullable: true },
                  address: { type: Type.STRING, nullable: true },
                  intent: { type: Type.STRING }
                },
                required: ["intent"]
              }
            },
            required: ["reply", "extractedQuery"]
          }
        }
      });

      const jsonText = response.text?.trim() || "";
      let parsed = null;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        parsed = {
          reply: response.text || "ประมวลผลคำค้นหาเรียบร้อยครับ",
          extractedQuery: parseMessageLocally(message)
        };
      }

      return res.json(parsed);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.json({
        reply: `สแกนข้อความค้นหาข้อมูลในฐานข้อมูลให้โดยอัตโนมัติแล้วครับ`,
        extractedQuery: parseMessageLocally(req.body.message || "")
      });
    }
  });

  // Local fallback parser in case AI fails or key is missing
  function parseMessageLocally(text: string) {
    const raw = text.trim();

    let meter: string | null = null;
    let ca: string | null = null;
    let address: string | null = null;

    const meterMatch = raw.match(/(?:มิเตอร์|meter|เลขเครื่องวัด|เลขวัด)\s*([a-zA-Z0-9\-_]+)/i);
    const caMatch = raw.match(/(?:ca|ผู้ใช้ไฟ|เลขบัญชี|บัญชี)\s*([0-9\-_]+)/i);

    if (meterMatch) {
      meter = meterMatch[1];
    }
    if (caMatch) {
      ca = caMatch[1];
    }

    if (!meter && !ca) {
      const pureDigits = raw.replace(/[^0-9]/g, "");
      // Rules requested by user:
      // If starts with 200 or 10-12 digits -> CA
      if (pureDigits.startsWith("200") || pureDigits.length >= 10) {
        ca = pureDigits;
      } else if (pureDigits.length >= 4 && pureDigits.length <= 9) {
        // Other numbers -> PEA Meter
        meter = pureDigits;
      } else {
        // Text / Names / Address
        address = raw;
      }
    }

    return {
      meter,
      ca,
      address,
      intent: meter || ca || address ? "search" : "greeting"
    };
  }

  // --- Central Storage for Streetlight Transformer Survey ---
  const DATA_DIR = path.join(process.cwd(), "data");
  const SURVEY_FILE = path.join(DATA_DIR, "streetlight_status.json");

  function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  function loadSurveyStatuses(): Record<string, { status: string; updatedAt: number }> {
    ensureDataDir();
    if (!fs.existsSync(SURVEY_FILE)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(SURVEY_FILE, "utf-8");
      return JSON.parse(raw);
    } catch (err) {
      console.error("Error reading survey status file:", err);
      return {};
    }
  }

  function saveSurveyStatuses(data: Record<string, { status: string; updatedAt: number }>) {
    ensureDataDir();
    try {
      fs.writeFileSync(SURVEY_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing survey status file:", err);
    }
  }

  // API Route: GET all transformer survey statuses
  app.get("/api/streetlight/status", (req, res) => {
    try {
      const statuses = loadSurveyStatuses();
      res.json({ success: true, statuses, timestamp: Date.now() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: POST update single transformer status
  app.post("/api/streetlight/status", (req, res) => {
    try {
      const { peano, status, updatedAt } = req.body;
      if (!peano || !status) {
        return res.status(400).json({ error: "Missing peano or status" });
      }
      const statuses = loadSurveyStatuses();
      statuses[peano] = {
        status: status === "สำรวจแล้ว" ? "สำรวจแล้ว" : "ยังไม่สำรวจ",
        updatedAt: typeof updatedAt === "number" ? updatedAt : Date.now(),
      };
      saveSurveyStatuses(statuses);
      res.json({ success: true, peano, item: statuses[peano] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: POST bulk update statuses
  app.post("/api/streetlight/status/bulk", (req, res) => {
    try {
      const { statuses } = req.body;
      if (!statuses || typeof statuses !== "object") {
        return res.status(400).json({ error: "Invalid statuses payload" });
      }
      const current = loadSurveyStatuses();
      const merged = { ...current, ...statuses };
      saveSurveyStatuses(merged);
      res.json({ success: true, count: Object.keys(statuses).length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route: POST reset all statuses
  app.post("/api/streetlight/status/reset", (req, res) => {
    try {
      saveSurveyStatuses({});
      res.json({ success: true, message: "Reset all survey statuses to default" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PEA Meter App running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

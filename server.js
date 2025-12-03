import express from "express";
import multer from "multer";
import cors from "cors";
import morgan from "morgan";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);
const app = express();

const PORT = process.env.PORT || 4000;
const MAX_TARGET_BYTES = 1 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const upload = multer({
  dest: path.join(os.tmpdir(), "pdf-backend-uploads"),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const modeToSetting = {
  "quality-screen": "/screen",
  "quality-ebook": "/ebook",
  "quality-printer": "/printer",
};

function getGsCommand() {
  if (process.env.GS_BIN) return process.env.GS_BIN;
  return process.platform === "win32" ? "gswin64c" : "gs";
}

function buildArgs(inputPath, outputPath, setting) {
  return [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    `-dPDFSETTINGS=${setting}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];
}

async function compressWithSetting(inputPath, outputPath, setting) {
  const cmd = getGsCommand();
  const args = buildArgs(inputPath, outputPath, setting);
  await execFileAsync(cmd, args);
  return fs.readFile(outputPath);
}

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) || "*",
    methods: ["POST", "OPTIONS"],
  }),
);
app.use(morgan("tiny"));

app.get("/healthz", async (_req, res) => {
  try {
    await execFileAsync(getGsCommand(), ["-v"]);
    res.json({ ok: true, gs: true });
  } catch (err) {
    res.status(500).json({ ok: false, gs: false, error: err?.message });
  }
});

app.post("/compress", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "File PDF wajib diunggah" });
  if (req.file.mimetype !== "application/pdf") {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ message: "File harus berformat PDF" });
  }

  const mode = req.body.mode || "quality-ebook";
  const tmpOutput = `${req.file.path}-out.pdf`;
  const altOutput = `${req.file.path}-alt.pdf`;

  try {
    // Check Ghostscript availability once per request
    await execFileAsync(getGsCommand(), ["-v"]);
  } catch (gsErr) {
    await fs.unlink(req.file.path).catch(() => {});
    return res
      .status(500)
      .json({ message: "Ghostscript tidak ditemukan di server.", detail: gsErr?.message });
  }

  let finalBuffer;
  let compressedSize;
  let note;

  if (mode === "max-1mb") {
    const ebookBuffer = await compressWithSetting(req.file.path, tmpOutput, "/ebook");
    compressedSize = ebookBuffer.length;
    finalBuffer = ebookBuffer;

    if (compressedSize > MAX_TARGET_BYTES) {
      const screenBuffer = await compressWithSetting(req.file.path, altOutput, "/screen");
      const chosen =
        screenBuffer.length <= MAX_TARGET_BYTES || screenBuffer.length < compressedSize
          ? screenBuffer
          : ebookBuffer;
      finalBuffer = chosen;
      compressedSize = chosen.length;
      if (compressedSize > MAX_TARGET_BYTES) {
        note = "Ukuran akhir masih di atas 1 MB meskipun sudah dikompres maksimal.";
      }
    }
  } else {
    const setting = modeToSetting[mode] || "/ebook";
    finalBuffer = await compressWithSetting(req.file.path, tmpOutput, setting);
    compressedSize = finalBuffer.length;
  }

  // Match Next.js route naming: keep original base name, append suffix
  const originalName =
    (req.file.originalname && req.file.originalname.replace(/\.pdf$/i, "")) || "document";
  const outputFileName = `${originalName}_compressed_by_myworkspace.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${outputFileName}"`);
  res.setHeader("X-Original-Size", req.file.size.toString());
  res.setHeader("X-Compressed-Size", compressedSize.toString());
  if (note) res.setHeader("X-Note", note);
  res.send(finalBuffer);

  // Best-effort cleanup
  [req.file.path, tmpOutput, altOutput].forEach((p) => fs.unlink(p).catch(() => {}));
});

app.listen(PORT, () => {
  console.log(`PDF backend running on port ${PORT}`);
  console.log(`Ghostscript command: ${getGsCommand()}`);
});

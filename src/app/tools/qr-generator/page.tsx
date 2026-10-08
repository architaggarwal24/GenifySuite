"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("qr-generator")!;

export default function QrGeneratorPage() {
  const [text, setText] = useState("");
  const [rendered, setRendered] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!rendered || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, rendered, {
      width: 240,
      margin: 2,
      color: { dark: "#12151b", light: "#EDEAE1" },
    }).catch(() => setError("Couldn't render that as a QR code."));
  }, [rendered]);

  function handleGenerate() {
    setError(null);
    if (!text.trim()) return;
    setRendered(text.trim());
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "qr-code.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <ToolShell tool={tool}>
      <Card>
        <Label htmlFor="qr-text">Text or URL</Label>
        <Input
          id="qr-text"
          placeholder="https://example.com"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <Button className="mt-4" onClick={handleGenerate} disabled={!text.trim()}>
          Generate QR code
        </Button>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rust">
            {error}
          </p>
        )}

        {rendered && (
          <ResultReveal revealKey={rendered}>
            <div className="mt-5 flex flex-col items-start gap-4">
              <div className="rounded border border-ink-line bg-paper p-3">
                <canvas ref={canvasRef} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" onClick={handleDownload}>
                  Download PNG
                </Button>
                <SaveHistoryButton
                  tool="qr-generator"
                  label={rendered.length > 40 ? `${rendered.slice(0, 40)}…` : rendered}
                  payload={{ text: rendered }}
                />
              </div>
            </div>
          </ResultReveal>
        )}
      </Card>
    </ToolShell>
  );
}

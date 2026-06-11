import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { clearAllCachesAndReload } from "@/utils/clear-cache";
import * as m from "@/paraglide/messages";

interface ErrorModalProps {
  open: boolean;
  onClose: () => void;
  error: Error | null;
  errorStep: string;
  diagnosticInfo: Record<string, string>;
}

function parseErrorType(message: string): string {
  if (/^Worker Protocol Error:/.test(message)) return "Worker Protocol Error";
  if (/^Worker Crash:/.test(message)) return "Worker Crash";
  if (/empty response body|Received empty response/i.test(message)) return "Empty Response Error";
  if (/Failed to parse JSON|parse.*JSON/i.test(message)) return "Data Format Error";
  if (/Failed to fetch|NetworkError|fetch|network/i.test(message)) return "Network Error";
  if (/WASM|wasm|panic|unreachable/i.test(message)) return "WASM Error";
  if (/Overpass/gi.test(message)) return "Overpass API Error";
  if (/cache|Cache|indexedDB|IDB/gi.test(message)) return "Cache Error";
  return "Unknown Error";
}

function buildClipboardText(
  error: Error,
  errorStep: string,
  diagnostics: Record<string, string>
): string {
  const lines = [
    "=== Error Report ===",
    `Time: ${new Date().toISOString()}`,
    `User Agent: ${navigator.userAgent}`,
    `Error Type: ${parseErrorType(error.message)}`,
    `Error Message: ${error.message}`,
    `Stack: ${error.stack || "N/A"}`,
    `Failed Step: ${errorStep || "Unknown"}`,
    "--- Diagnostic Info ---",
    ...Object.entries(diagnostics).map(([k, v]) => `${k}: ${v}`),
  ];
  return lines.join("\n");
}

export function ErrorModal({ open, onClose, error, errorStep, diagnosticInfo }: ErrorModalProps) {
  const [showStack, setShowStack] = useState(false);
  // const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const errorType = parseErrorType(error.message);
  const hasStack = !!error.stack && error.stack !== error.message;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildClipboardText(error, errorStep, diagnosticInfo));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = buildClipboardText(error, errorStep, diagnosticInfo);
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    // setShowConfirm(false);
    setShowStack(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{m.error_modal_title()}</DialogTitle>
          <DialogDescription className="font-mono text-xs text-destructive">
            {errorType}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 text-sm">
          {/* Error Message */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {m.error_modal_error_message()}
            </p>
            <pre className="bg-muted p-3 rounded-md text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-24 overflow-y-auto">
              {error.message}
            </pre>
          </div>

          {/* Stack Trace (collapsible) */}
          {hasStack && (
            <div>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-1"
                onClick={() => setShowStack(!showStack)}
              >
                {m.error_modal_error_stack()} {showStack ? "▾" : "▸"}
              </button>
              {showStack && (
                <pre className="bg-muted p-3 rounded-md text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          {/* Failed Step */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {m.error_modal_failed_step()}
            </p>
            <p className="bg-muted p-2 rounded-md text-xs font-mono">{errorStep || "Unknown"}</p>
          </div>

          {/* Diagnostic Info */}
          {Object.keys(diagnosticInfo).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {m.error_modal_diagnostics()}
              </p>
              <div className="bg-muted p-3 rounded-md text-xs font-mono grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
                {Object.entries(diagnosticInfo).map(([key, value]) => (
                  <>
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="break-all">{value}</span>
                  </>
                ))}
              </div>
            </div>
          )}

          {/* Clear cache confirmation */}
          {/* {showConfirm && (
            <div className="border border-destructive/50 rounded-md p-3 space-y-2">
              <p className="text-xs font-semibold text-destructive">
                {m.error_modal_clear_confirm_title()}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.error_modal_clear_confirm_desc()}
              </p>
            </div>
          )} */}
        </div>

        <DialogFooter className="flex-row flex-wrap gap-2 sm:gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? m.error_modal_copy_success() : m.error_modal_copy_details()}
          </Button>
          <Button variant="destructive" size="sm" onClick={clearAllCachesAndReload}>
            {m.error_modal_clear_cache()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ opacity: 0.5, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Something went wrong
          </p>
          <h1 style={{ fontSize: 28, margin: "12px 0" }}>We hit an unexpected error.</h1>
          <p style={{ opacity: 0.55, fontSize: 14, lineHeight: 1.5 }}>
            {error.digest
              ? `Reference: ${error.digest}`
              : "Please try again. If it continues, contact us."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "12px 20px",
              background: "#c41e3a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

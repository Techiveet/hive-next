// app/components/MessageForm.tsx
"use client";
import { useState } from "react";
import { sendWithSync } from "../../lib/sendWithSync";

export default function MessageForm() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending...");
    const result = await sendWithSync("/api/messages", { text });
    if (result?.cached) {
      setStatus("Saved locally — will sync when online");
    } else if (result?.ok) {
      setStatus("Sent");
    } else {
      setStatus("Error");
    }
    setText("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit">Send</button>
      {status && <div>{status}</div>}
    </form>
  );
}
